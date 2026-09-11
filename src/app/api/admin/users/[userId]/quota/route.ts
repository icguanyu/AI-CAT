/**
 * 檔案：src/app/api/admin/users/[userId]/quota/route.ts  →  POST /api/admin/users/:userId/quota
 * 角色：API 層 — 手動調整帳號配額（P2：輕量操作，comp / 客訴處理用）
 * 功能：body 可帶 freeLimit / used / dayUsed 任意子集；只更新有給的欄位。
 */
import { requireAdmin } from '@/lib/admin';
import { updateAdminUserQuota } from '@/lib/admin-data';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function POST(
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
  const body = (await req.json().catch(() => ({}))) as {
    freeLimit?: unknown;
    used?: unknown;
    dayUsed?: unknown;
  };
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined;

  const user = await updateAdminUserQuota(userId, {
    freeLimit: num(body.freeLimit),
    used: num(body.used),
    dayUsed: num(body.dayUsed),
  });
  if (!user) return Response.json({ error: '找不到這個帳號' }, { status: 404 });
  return Response.json(user);
}
