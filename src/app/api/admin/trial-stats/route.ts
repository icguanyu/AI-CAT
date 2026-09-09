/**
 * 檔案：src/app/api/admin/trial-stats/route.ts  →  GET /api/admin/trial-stats
 * 角色：API 層 — 免登入試用的即時數據（後台限定）
 * 功能：驗 Bearer + email 在 ADMIN_EMAILS 內 → 回本月的池用量與轉換漏斗
 *       （started / completed / claimed）。無 UI，直接看 JSON。
 */
import { requireAuth } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';
import { getTrialStats } from '@/lib/public-pool';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  return handle(req).catch(errJson);
}

async function handle(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  if (!isAdminEmail(auth.email)) {
    return Response.json({ error: '無權存取' }, { status: 403 });
  }
  return Response.json(await getTrialStats());
}
