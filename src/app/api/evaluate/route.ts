/**
 * 檔案：src/app/api/evaluate/route.ts  →  POST /api/evaluate
 * 角色：API 層 — 裁判評分引擎（核心）
 * 功能：
 *   1. 擋太短的提交（未到注入輪次無法評估批判思考）
 *   2. detectChallenge() 規則判定使用者是否質疑被注入的錯誤資訊
 *   3. runJudge()（見 src/lib/judge.ts）輸出五維度分數與總評
 *   4. computeLevel()：分級由後端依加權分數 + 規則上限決定，不交給裁判
 *   5. 寫入 Supabase、扣次數、清 Redis session
 */
import { getExam, deleteExam } from '@/lib/redis';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resolveActor, ownsExam } from '@/lib/actor';
import { setAnonReport, bumpTrialMetric } from '@/lib/public-pool';
import { consumeQuota } from '@/lib/quota';
import { getScenarioVariant } from '@/lib/scenarios';
import { computeLevel } from '@/lib/scoring';
import { detectChallenge, runJudge, runExemplar } from '@/lib/judge';
import {
  toFamiliarity,
  type AnonReportBlob,
  type Report,
  type TrapReveal,
} from '@/types/exam';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  return handle(req).catch(errJson);
}

async function handle(req: Request): Promise<Response> {
  const actor = await resolveActor(req);
  if ('error' in actor) {
    return Response.json({ error: actor.error }, { status: actor.status });
  }

  const body = (await req.json()) as {
    examId?: string;
    familiarity?: unknown;
  };
  const { examId } = body;
  if (!examId) {
    return Response.json({ error: '缺少 examId' }, { status: 400 });
  }
  // 領域熟悉度：看到 brief 後才自評，提交時一起送（不進 ExamState）。
  const familiarity = toFamiliarity(body.familiarity);

  const state = await getExam(examId);
  if (!state) {
    return Response.json({ error: '找不到該場次的對話紀錄' }, { status: 404 });
  }
  if (!ownsExam(state, actor)) {
    return Response.json({ error: '無權存取此場次' }, { status: 403 });
  }
  const isAnon = actor.kind === 'anon';

  const userTurns = state.history.filter((m) => m.role === 'user').length;
  if (userTurns < 1) {
    return Response.json(
      { error: '尚未開始對話，無法評估。' },
      { status: 400 },
    );
  }

  const scenario = await getScenarioVariant(
    state.scenarioId,
    state.variantIndex,
  );
  const noTrap = scenario.noTrap;
  const ruleChallenged =
    !noTrap && state.injected
      ? detectChallenge(state.history, state.injectAtTurn ?? 2)
      : false;
  const trapEffective = !noTrap && state.injected && state.injectionLanded;

  // 裁判評分（登入 / 試用都用正式版裁判模型）；「L5 示範」只給登入版（省 token）。
  const [judged, exemplar] = await Promise.all([
    runJudge({
      brief: scenario.brief,
      history: state.history,
      injected: state.injected,
      trapEffective,
      injectionText: state.injectionText,
      verifyHint: scenario.verifyHint,
      trapType: scenario.trapType,
      verifyDifficulty: scenario.verifyDifficulty,
      noTrap,
      familiarity,
      ruleChallenged,
    }),
    isAnon
      ? Promise.resolve('')
      : runExemplar({
          brief: scenario.brief,
          trapEffective,
          injectionText: state.injectionText,
          correction: scenario.correction,
          verifyHint: scenario.verifyHint,
          trapType: scenario.trapType,
          noTrap,
        }).catch((e) => {
          console.error('runExemplar 失敗', e);
          return '';
        }),
  ]);

  // 關鍵字漏判時，以裁判在對話裡實際看到的為準
  const challenged = ruleChallenged || judged.user_challenged;

  const { level, average } = computeLevel(judged.scores, {
    trapEffective,
    challenged,
  });

  const report: Report = {
    scores: judged.scores,
    overall_summary: judged.overall_summary,
    user_challenged: challenged,
    did_well: judged.did_well,
    to_improve: judged.to_improve,
    suggested_level: level,
  };

  // 僅本地開發回傳：把這場攤平成 judge:reliability 腳本吃的 fixture 形狀，
  // 讓報告頁能直接「下載 fixture JSON」。正式環境 NODE_ENV==='production'，一律 undefined，不外流。
  const debug =
    process.env.NODE_ENV !== 'production'
      ? {
          label: `${scenario.titleZh} · 變體#${state.variantIndex} · ${level} · ${new Date()
            .toISOString()
            .slice(0, 16)}`,
          scenarioId: state.scenarioId,
          category: state.category ?? scenario.category,
          brief: scenario.brief,
          injected: state.injected,
          injectionLanded: state.injectionLanded,
          injectionText: state.injectionText,
          injectAtTurn: state.injectAtTurn ?? 2,
          verifyHint: scenario.verifyHint,
          trapType: scenario.trapType,
          verifyDifficulty: scenario.verifyDifficulty,
          noTrap,
          familiarity,
          history: state.history,
        }
      : undefined;

  // 提交後才揭露：陷阱生效時給「錯誤 vs 正確」對照
  const trap: TrapReveal | null = trapEffective
    ? {
        injectionText: state.injectionText,
        correction: scenario.correction || null,
        challenged,
      }
    : null;

  // 給後續裁判校準 / 分層分析用：這場抽中變體的陷阱型別、察覺難度、擲中的注入輪次。
  // no-trap 場：trapType / verifyDifficulty 為 null、injectAtTurn 為 0。
  const trapMeta = {
    trapType: scenario.trapType,
    verifyDifficulty: scenario.verifyDifficulty,
    injectAtTurn: state.injectAtTurn ?? 2,
  };

  // ── 免登入試用：不寫 DB、不扣次數，結果只放 Redis（TTL），登入後由 /claim 認領 ──
  if (isAnon) {
    const blob: AnonReportBlob = {
      anonId: actor.anonId,
      scenarioId: state.scenarioId,
      variantIndex: state.variantIndex,
      category: state.category ?? scenario.category,
      titleZh: scenario.titleZh,
      familiarity,
      report,
      weightedAverage: average,
      trap,
      noTrap,
      ...trapMeta,
      ruleChallenged: challenged,
      injected: state.injected,
      history: state.history,
      createdAt: Date.now(),
    };
    await setAnonReport(examId, blob);
    void bumpTrialMetric('completed');
    await deleteExam(examId).catch(() => {});
    return Response.json({
      success: true,
      report,
      trap,
      exemplar: '',
      debug,
      persisted: false,
    });
  }

  // 登入 actor 一定有 userId / name
  const userId = actor.userId;
  const userName = actor.name;

  // Redis 僅為短期 session；正式報告寫入 Supabase 留存
  const { error } = await getSupabaseAdmin().from('exam_reports').insert({
    exam_id: examId,
    user_id: userId,
    scenario_id: state.scenarioId,
    // 完整對話逐字稿：之前只活在 Redis，評分完即刪；留一份供日後分析與裁判評測 / 微調。
    transcript: state.history,
    report: {
      ...report,
      weighted_average: average,
      variant_index: state.variantIndex,
      exemplar,
      // 受測者顯示名稱快照（Google 登入當下的 full_name）；結果卡片用。
      user_name: userName,
      // 情境的領域分類 + 中文標題快照；個人統整頁以 category 為分組單位、titleZh 顯示。
      category: state.category ?? scenario.category,
      titleZh: scenario.titleZh,
      // 看到 brief 後自評的領域熟悉度；報告頁顯示為分數的脈絡。
      familiarity,
      // 存進 jsonb，讓 /exam/result/:examId 重新整理後能還原陷阱對照；
      // 公開分享頁 /s 讀不到這個欄位（見 getSharedCard 只挑非機密欄位）。
      trap,
      // 這題本身就沒有陷阱（no-trap 題）；用來和「有陷阱但沒觸發」區分。
      noTrap,
      // 抽中變體的陷阱型別 / 察覺難度 / 擲中的注入輪次；給後續裁判校準 / 分層分析。
      ...trapMeta,
      ...(debug ? { debug } : {}),
    },
    rule_challenged: challenged,
    injected: state.injected,
  });
  if (error) {
    // exam_id 有 unique 限制：重複提交同一場不再重複扣次數
    console.error('寫入 exam_reports 失敗（可能為重複提交）', error);
    return Response.json({
      success: true,
      report,
      trap,
      exemplar,
      debug,
      duplicate: true,
    });
  }

  // 提交成功才扣一次免費次數；扣點失敗不影響已產生的報告
  try {
    await consumeQuota(userId);
  } catch (e) {
    console.error('扣減 user_quota 失敗', e);
  }

  // 這場已結束，清掉 Redis session
  await deleteExam(examId).catch(() => {});

  return Response.json({ success: true, report, trap, exemplar, debug });
}
