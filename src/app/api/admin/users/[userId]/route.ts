/**
 * 檔案：src/app/api/admin/users/[userId]/route.ts  →  GET /api/admin/users/:userId
 * 角色：API 層 — 單一帳號的配額 + 自填分群資料（P2：輕量操作）
 */
import { requireAdmin } from '@/lib/admin';
import { getAdminUser } from '@/lib/admin-data';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ userId: string }> },
) {
  return handle(req, ctx).catch(errJson);
}

async function handle(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const { userId } = await params;
  const user = await getAdminUser(userId);
  if (!user) return Response.json({ error: '找不到這個帳號' }, { status: 404 });
  return Response.json(user);
}
