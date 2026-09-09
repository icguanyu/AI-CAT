/**
 * 檔案：src/app/api/exam/[examId]/report/route.ts  →  GET /api/exam/:examId/report
 * 角色：API 層 — 取回一場測驗的完整報告
 * 功能：
 *   - 帶 Bearer：本人（登入）從 exam_reports 撈完整報告（重新整理不消失）。
 *   - 不帶 Bearer：免登入試用者，用簽章 anon cookie 從 Redis 取回試用結果快照
 *     （TTL 內有效；trial=true / persisted=false，前端據此顯示「登入才會保存」）。
 *   debug 僅本地開發回傳。
 */
import { resolveActor } from '@/lib/actor';
import { getOwnerReport } from '@/lib/exam-reports';
import { getAnonReport } from '@/lib/public-pool';
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
  const actor = await resolveActor(req);
  if ('error' in actor) {
    return Response.json({ error: actor.error }, { status: actor.status });
  }
  const { examId } = await params;
  const dev = process.env.NODE_ENV !== 'production';

  // ── 免登入試用：從 Redis 取快照 ──
  if (actor.kind === 'anon') {
    const blob = await getAnonReport(examId);
    if (!blob || blob.anonId !== actor.anonId) {
      return Response.json({ error: '找不到報告' }, { status: 404 });
    }
    return Response.json({
      report: blob.report,
      name: null,
      familiarity: blob.familiarity,
      trap: blob.trap,
      exemplar: '',
      debug: null,
      shared: false,
      trial: true,
      persisted: false,
    });
  }

  // ── 登入：從 DB 取本人報告 ──
  const res = await getOwnerReport(examId, actor.userId);
  if (!res.ok) {
    return Response.json(
      { error: res.status === 403 ? '無權存取此報告' : '找不到報告' },
      { status: res.status },
    );
  }
  return Response.json({
    report: res.data.report,
    name: res.data.name,
    familiarity: res.data.familiarity,
    trap: res.data.trap,
    exemplar: res.data.exemplar,
    debug: dev ? res.data.debug : null,
    shared: res.data.shared,
    trial: false,
    persisted: true,
  });
}
