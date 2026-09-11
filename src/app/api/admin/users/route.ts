/**
 * 檔案：src/app/api/admin/users/route.ts  →  GET /api/admin/users?q=
 * 角色：API 層 — 依 email 片段搜尋帳號（P2：輕量操作）
 */
import { requireAdmin } from '@/lib/admin';
import { searchAdminUsers } from '@/lib/admin-data';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  return handle(req).catch(errJson);
}

async function handle(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const q = new URL(req.url).searchParams.get('q') ?? '';
  return Response.json(await searchAdminUsers(q));
}
