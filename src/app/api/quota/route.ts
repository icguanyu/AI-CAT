/**
 * 檔案：src/app/api/quota/route.ts  →  GET /api/quota
 * 角色：API 層 — 回報目前帳號的免費檢測次數
 * 功能：驗證登入後回傳 { used, limit }，給 /exam 開始畫面顯示「已完成幾次」。
 */
import { requireAuth } from '@/lib/supabase';
import { checkQuota } from '@/lib/quota';
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
  const quota = await checkQuota(auth.userId);
  return Response.json({
    used: quota.used,
    limit: quota.limit,
    dayUsed: quota.dayUsed,
    dayLimit: quota.dayLimit,
  });
}
