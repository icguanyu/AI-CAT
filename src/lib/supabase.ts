/**
 * 檔案：src/lib/supabase.ts
 * 角色：基礎設施層 — 身分驗證與資料庫存取
 * 功能：提供 service_role 權限的伺服器端 Supabase client（getSupabaseAdmin），
 *       以及 requireAuth(req)：驗證 Authorization Bearer JWT，回傳 userId 或錯誤。
 *       API 路由用它擋未登入請求、寫入 exam_reports、日後查免費次數。
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/lib/env';

let admin: SupabaseClient | null = null;

/**
 * 具 service_role 權限的伺服器端 client。
 * 僅可用於 route handler / server action，切勿洩漏到瀏覽器。
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!admin) {
    const env = getEnv();
    admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

export type AuthResult =
  | { userId: string }
  | { error: string; status: number };

/**
 * 從 Authorization: Bearer <jwt> 驗證使用者身分。
 * 呼叫端需自行 narrow：`if ('error' in result) ...`
 */
export async function requireAuth(req: Request): Promise<AuthResult> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return { error: '未登入', status: 401 };

  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) return { error: '登入憑證無效', status: 401 };

  return { userId: data.user.id };
}
