/**
 * 檔案：src/app/api/exam/start/route.ts  →  POST /api/exam/start
 * 角色：API 層 — 開一場新測驗
 * 功能：驗證登入 → 檢查免費次數 → 隨機選一題 → 產生 examId →
 *       在 Redis 建立初始 ExamState（空歷程、未注入陷阱）→
 *       回傳 examId、題目說明 brief 與各項限制。system / injectionText 不外流。
 *
 * 次數只在此處「檢查」；實際 +1 在提交評分成功後由 /api/evaluate 執行（Phase 3）。
 */
import { requireAuth } from '@/lib/supabase';
import { setExam } from '@/lib/redis';
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';
import { listScenarioIds, resolveScenario } from '@/lib/scenarios';
import { checkQuota } from '@/lib/quota';
import { MAX_USER_TURNS, MAX_INPUT_CHARS } from '@/config/constants';
import { errJson } from '@/lib/api-error';
import type { ExamState } from '@/types/exam';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  return handle(req).catch(errJson);
}

async function handle(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const rl = await checkRateLimit(req, auth.userId);
  if (!rl.ok) return rateLimitResponse(rl);

  const quota = await checkQuota(auth.userId);
  if (!quota.ok) {
    return Response.json(
      { error: `免費檢測次數已用完（${quota.used}/${quota.limit}）`, quota },
      { status: 403 },
    );
  }

  const ids = await listScenarioIds();
  if (ids.length === 0) {
    return Response.json(
      { error: '題庫目前沒有可用的題目，請稍後再試或聯絡管理員。' },
      { status: 503 },
    );
  }
  const scenarioId = ids[Math.floor(Math.random() * ids.length)];
  const scenario = await resolveScenario(scenarioId); // 隨機挑一個變體

  const examId = crypto.randomUUID();
  const state: ExamState = {
    userId: auth.userId,
    scenarioId,
    variantIndex: scenario.variantIndex,
    history: [],
    injected: false,
    injectionLanded: false,
    injectionText: '',
    createdAt: Date.now(),
  };
  await setExam(examId, state);

  return Response.json({
    examId,
    brief: scenario.brief,
    limits: { maxUserTurns: MAX_USER_TURNS, maxInputChars: MAX_INPUT_CHARS },
    quota: { used: quota.used, limit: quota.limit },
  });
}
