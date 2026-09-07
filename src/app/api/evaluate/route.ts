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
import { detectChallenge, runJudge } from '@/lib/judge';
import type { Report, TrapReveal } from '@/types/exam';
import { INJECT_AT_TURN } from '@/config/constants';
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

  const { examId } = (await req.json()) as { examId?: string };
  if (!examId) {
    return Response.json({ error: '缺少 examId' }, { status: 400 });
  }

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

  const scenario = getScenarioVariant(state.scenarioId, state.variantIndex);
  const challenged = state.injected
    ? detectChallenge(state.history, INJECT_AT_TURN)
    : false;
  const trapEffective = state.injected && state.injectionLanded;

  const judged = await runJudge({
    brief: scenario.brief,
    history: state.history,
    injected: state.injected,
    trapEffective,
    injectionText: state.injectionText,
    challenged,
  });

  const { level, average } = computeLevel(judged.scores, {
    trapEffective,
    challenged,
  });

  const report: Report = {
    scores: judged.scores,
    overall_summary: judged.overall_summary,
    suggested_level: level,
  };

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
    report: { ...report, weighted_average: average, variant_index: state.variantIndex },
    rule_challenged: challenged,
    injected: state.injected,
  });
  if (error) {
    // exam_id 有 unique 限制：重複提交同一場不再重複扣次數
    console.error('寫入 exam_reports 失敗（可能為重複提交）', error);
    return Response.json({ success: true, report, trap, duplicate: true });
  }

  // 提交成功才扣一次免費次數；扣點失敗不影響已產生的報告
  try {
    await consumeQuota(auth.userId);
  } catch (e) {
    console.error('扣減 user_quota 失敗', e);
  }

  // 這場已結束，清掉 Redis session
  await deleteExam(examId).catch(() => {});

  return Response.json({ success: true, report, trap });
}
