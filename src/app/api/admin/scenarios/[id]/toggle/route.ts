/**
 * 檔案：src/app/api/admin/scenarios/[id]/toggle/route.ts  →  POST /api/admin/scenarios/:id/toggle
 * 角色：API 層 — 開關某題是否會被抽中（P2：輕量操作）
 * 功能：body { active: boolean }，直接寫 scenarios.active，不刪資料。
 */
import { requireAdmin } from '@/lib/admin';
import { setScenarioActive } from '@/lib/admin-data';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function POST(
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
  const body = (await req.json().catch(() => ({}))) as { active?: unknown };
  if (typeof body.active !== 'boolean') {
    return Response.json({ error: '缺少 active（boolean）' }, { status: 400 });
  }
  await setScenarioActive(id, body.active);
  return Response.json({ ok: true });
}
