/**
 * 檔案：src/app/api/exam/[examId]/report/route.ts  →  GET /api/exam/:examId/report
 * 角色：API 層 — 取回「已提交」測驗的完整報告（本人限定）
 * 功能：讓 /exam/result/:examId 頁在重新整理後仍能還原報告。
 *       驗證 Bearer + user_id 相符；回分數 / 總評 / 回饋 / 陷阱對照 / L5 示範 / shared 旗標。
 *       debug 僅本地開發回傳。
 */
import { requireAuth } from '@/lib/supabase';
import { getOwnerReport } from '@/lib/exam-reports';
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
  const res = await getOwnerReport(examId, auth.userId);
  if (!res.ok) {
    return Response.json(
      { error: res.status === 403 ? '無權存取此報告' : '找不到報告' },
      { status: res.status },
    );
  }

  const dev = process.env.NODE_ENV !== 'production';
  return Response.json({
    report: res.data.report,
    name: res.data.name,
    familiarity: res.data.familiarity,
    trap: res.data.trap,
    exemplar: res.data.exemplar,
    debug: dev ? res.data.debug : null,
    shared: res.data.shared,
  });
}
