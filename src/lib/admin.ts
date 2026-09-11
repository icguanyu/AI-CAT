/**
 * 檔案：src/lib/admin.ts
 * 角色：基礎設施層 — 後台權限判斷
 * 功能：isAdminEmail(email) —— 比對 ADMIN_EMAILS（逗號分隔、大小寫不敏感）。
 *       ADMIN_EMAILS 未設 → 一律 false（fail closed）。
 *       requireAdmin(req) —— 後台 API 共用的守門：先驗登入，再驗 email 在名單內。
 */
import { requireAuth } from '@/lib/supabase';

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

export type AdminAuth = { userId: string; email: string };
export type AdminAuthResult = AdminAuth | { error: string; status: number };

/** 後台 API 的共用守門：驗 Bearer，email 不在 ADMIN_EMAILS 一律當 403。 */
export async function requireAdmin(req: Request): Promise<AdminAuthResult> {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth;
  if (!isAdminEmail(auth.email)) return { error: '無權存取', status: 403 };
  return { userId: auth.userId, email: auth.email ?? '' };
}
