/**
 * 檔案：src/app/api/exam/[examId]/route.ts  →  GET /api/exam/:examId
 * 角色：API 層 — 取回進行中測驗的可見狀態
 * 功能：讓前端在重新整理後能還原畫面：回傳題目說明、目前對話歷程、
 *       已用輪次與是否已達上限。system / injectionText 等機密不外流。
 */
import { requireAuth } from '@/lib/supabase';
import { getExam } from '@/lib/redis';
import { getScenario } from '@/lib/scenarios';
import { MAX_USER_TURNS } from '@/config/constants';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ examId: string }> },
) {
  return handle(req, ctx).catch(errJson);
}

async function handle(
  req: Request,
  { params }: { params: Promise<{ examId: string }> },
): Promise<Response> {
  const auth = await requireAuth(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { examId } = await params;
  const state = await getExam(examId);
  if (!state) {
    return Response.json({ error: '測驗場次不存在或已過期' }, { status: 404 });
  }
  if (state.userId !== auth.userId) {
    return Response.json({ error: '無權存取此場次' }, { status: 403 });
  }

  const scenario = getScenario(state.scenarioId);
  const userTurns = state.history.filter((m) => m.role === 'user').length;

  return Response.json({
    examId,
    brief: scenario.brief,
    messages: state.history, // 僅 user / assistant，可安全回傳
    userTurns,
    maxUserTurns: MAX_USER_TURNS,
    done: userTurns >= MAX_USER_TURNS,
  });
}
