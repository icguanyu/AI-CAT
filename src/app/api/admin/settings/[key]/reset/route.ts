/**
 * 檔案：src/app/api/admin/settings/[key]/reset/route.ts  →  POST /api/admin/settings/:key/reset
 * 角色：API 層 — 把一筆後台設定還原成預設值（刪掉 app_settings 那一列）
 */
import { requireAdmin } from '@/lib/admin';
import { resetAppSetting } from '@/lib/admin-data';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ key: string }> },
) {
  return handle(req, ctx).catch(errJson);
}

async function handle(
  req: Request,
  { params }: { params: Promise<{ key: string }> },
): Promise<Response> {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const { key } = await params;
  try {
    const saved = await resetAppSetting(key);
    return Response.json(saved);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
