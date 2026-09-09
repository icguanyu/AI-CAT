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
import { requireAuth, getSupabaseAdmin } from '@/lib/supabase';
import { consumeQuota } from '@/lib/quota';
import { getScenarioVariant } from '@/lib/scenarios';
import { computeLevel } from '@/lib/scoring';
import { detectChallenge, runJudge, runExemplar } from '@/lib/judge';
import { toFamiliarity, type Report, type TrapReveal } from '@/types/exam';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  return handle(req).catch(errJson);
}

async function handle(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
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
  if (state.userId !== auth.userId) {
    return Response.json({ error: '無權存取此場次' }, { status: 403 });
  }

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
  const ruleChallenged = state.injected
    ? detectChallenge(state.history, state.injectAtTurn ?? 2)
    : false;
  const trapEffective = state.injected && state.injectionLanded;

  // 裁判評分與「L5 示範」平行跑，省來回時間
  const [judged, exemplar] = await Promise.all([
    runJudge({
      brief: scenario.brief,
      history: state.history,
      injected: state.injected,
      trapEffective,
      injectionText: state.injectionText,
      verifyHint: scenario.verifyHint,
      familiarity,
      ruleChallenged,
    }),
    runExemplar({
      brief: scenario.brief,
      trapEffective,
      injectionText: state.injectionText,
      correction: scenario.correction,
      verifyHint: scenario.verifyHint,
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

  // Redis 僅為短期 session；正式報告寫入 Supabase 留存
  const { error } = await getSupabaseAdmin().from('exam_reports').insert({
    exam_id: examId,
    user_id: auth.userId,
    scenario_id: state.scenarioId,
    report: {
      ...report,
      weighted_average: average,
      variant_index: state.variantIndex,
      exemplar,
      // 受測者顯示名稱快照（Google 登入當下的 full_name）；結果卡片用。
      user_name: auth.name,
      // 情境的領域分類 + 中文標題快照；個人統整頁以 category 為分組單位、titleZh 顯示。
      category: state.category ?? scenario.category,
      titleZh: scenario.titleZh,
      // 看到 brief 後自評的領域熟悉度；報告頁顯示為分數的脈絡。
      familiarity,
      // 存進 jsonb，讓 /exam/result/:examId 重新整理後能還原陷阱對照；
      // 公開分享頁 /s 讀不到這個欄位（見 getSharedCard 只挑非機密欄位）。
      trap,
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
    await consumeQuota(auth.userId);
  } catch (e) {
    console.error('扣減 user_quota 失敗', e);
  }

  // 這場已結束，清掉 Redis session
  await deleteExam(examId).catch(() => {});

  return Response.json({ success: true, report, trap, exemplar, debug });
}
