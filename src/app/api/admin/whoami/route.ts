/**
 * 檔案：src/app/api/admin/whoami/route.ts  →  GET /api/admin/whoami
 * 角色：API 層 — 讓前端知道目前登入者是「完整管理員」還是「標註員」
 * 功能：完整管理員或標註員都放行（用 requireReviewer），回傳 role；
 *       都不是就 403，前端據此顯示無權限畫面。
 */
import { requireReviewer } from '@/lib/admin';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  return handle(req).catch(errJson);
}

async function handle(req: Request): Promise<Response> {
  const auth = await requireReviewer(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  return Response.json({ email: auth.email, role: auth.role });
}
