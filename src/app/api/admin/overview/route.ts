/**
 * 檔案：src/app/api/admin/overview/route.ts  →  GET /api/admin/overview
 * 角色：API 層 — 後台總覽數字（P1：可見性）
 * 功能：測驗量（24h/7d/30d/全部）、帳號數、試用漏斗、配額分布、分類覆蓋率。
 */
import { requireAdmin } from '@/lib/admin';
import { getAdminOverview } from '@/lib/admin-data';
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
  return Response.json(await getAdminOverview());
}
