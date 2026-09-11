/**
 * 檔案：src/app/api/admin/scenarios/[id]/route.ts
 * 角色：API 層 — 單題完整內容 + 刪除
 * 功能：GET /api/admin/scenarios/:id — 完整內容（機密：system、每個變體的
 *       injectionText/correction/verifyHint），給題庫健檢頁的「查看題目」彈窗用。
 *       DELETE /api/admin/scenarios/:id — 真的刪除這題；只有從沒被抽中過（served = 0）
 *       才會成功，否則 400（見 admin-data.ts deleteScenario）。有歷史的題目要退場
 *       請用停用（PATCH .../toggle），不會連帶動到 exam_reports。
 *       都用 requireAdmin() 把關，不進到 /admin 出不去。
 */
import { requireAdmin } from '@/lib/admin';
import { getScenarioDetail, deleteScenario } from '@/lib/admin-data';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handleGet(req, ctx).catch(errJson);
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handleDelete(req, ctx).catch(errJson);
}

async function handleGet(
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

async function handleDelete(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await params;
  try {
    await deleteScenario(id);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  return Response.json({ ok: true });
}
