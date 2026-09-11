/**
 * 檔案：src/app/api/admin/scenarios/route.ts  →  GET /api/admin/scenarios
 * 角色：API 層 — 題庫健檢（P1：可見性）
 * 功能：每題被抽中次數、平均加權分、陷阱出現/被識破次數；用來抓「壞掉的題目」。
 */
import { requireAdmin } from '@/lib/admin';
import { getScenarioHealth } from '@/lib/admin-data';
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
  return Response.json(await getScenarioHealth());
}
