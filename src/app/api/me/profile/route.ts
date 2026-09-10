/**
 * 檔案：src/app/api/me/profile/route.ts  →  /api/me/profile
 * 角色：API 層 — 本人的自填分群資料（年齡區間 / 學歷 / 性別）
 * 功能：GET 回目前值；POST 部分更新（只寫通過驗證的欄位）。皆需登入。
 *       僅供彙總分析，見 /privacy。
 */
import { requireAuth } from '@/lib/supabase';
import { getProfileExtras, saveProfileExtras } from '@/lib/profile';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  return handleGet(req).catch(errJson);
}
export async function POST(req: Request) {
  return handlePost(req).catch(errJson);
}

async function handleGet(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  return Response.json(await getProfileExtras(auth.userId));
}

async function handlePost(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const body = (await req.json().catch(() => ({}))) as {
    ageBand?: unknown;
    education?: unknown;
    gender?: unknown;
  };
  const saved = await saveProfileExtras(auth.userId, body);
  return Response.json(saved);
}
