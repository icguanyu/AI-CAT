/**
 * 檔案：src/app/api/admin/scenarios/[id]/route.ts  →  GET /api/admin/scenarios/:id
 * 角色：API 層 — 單題完整內容（機密：system、每個變體的 injectionText/correction/verifyHint）
 * 功能：給題庫健檢頁的「查看題目」彈窗用。requireAdmin() 把關，不進到 /admin 出不去。
 */
import { requireAdmin } from '@/lib/admin';
import { getScenarioDetail } from '@/lib/admin-data';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(req, ctx).catch(errJson);
}

async function handle(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await params;
  const detail = await getScenarioDetail(id);
  if (!detail) {
    return Response.json({ error: '找不到這題' }, { status: 404 });
  }
  return Response.json(detail);
}
