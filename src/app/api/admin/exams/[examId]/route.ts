/**
 * 檔案：src/app/api/admin/exams/[examId]/route.ts  →  GET /api/admin/exams/:examId
 * 角色：API 層 — 單場測驗完整資料（後台限定，無 owner 限制）
 * 功能：報告全欄位 + 逐字稿 + 該帳號的自填分群資料，供除錯 / 稽核用。
 */
import { requireAdmin } from '@/lib/admin';
import { getAdminExamDetail } from '@/lib/admin-data';
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
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const { examId } = await params;
  const detail = await getAdminExamDetail(examId);
  if (!detail) {
    return Response.json({ error: '找不到這場測驗' }, { status: 404 });
  }
  return Response.json(detail);
}
