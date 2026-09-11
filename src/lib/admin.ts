/**
 * 檔案：src/lib/admin.ts
 * 角色：基礎設施層 — 後台權限判斷（兩級）
 * 功能：isAdminEmail(email) —— 完整管理員，比對 ADMIN_EMAILS。
 *       isReviewerEmail(email) —— 只能用標註審核，比對 REVIEWER_EMAILS。
 *       兩個名單都未設 → 一律 false（fail closed）。
 *       requireAdmin(req) —— 完整管理員專用 API 的守門（總覽/測驗查詢/帳號查詢/題庫健檢）。
 *       requireReviewer(req) —— 標註審核 API 的守門：完整管理員或標註員都放行。
 */
import { requireAuth } from '@/lib/supabase';

function inList(email: string | null | undefined, envVar: string): boolean {
  if (!email) return false;
  const list = (process.env[envVar] ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return inList(email, 'ADMIN_EMAILS');
}

export function isReviewerEmail(email: string | null | undefined): boolean {
  return inList(email, 'REVIEWER_EMAILS');
}

export type AdminRole = 'admin' | 'reviewer';
export type AdminAuth = { userId: string; email: string; role: AdminRole };
export type AdminAuthResult = AdminAuth | { error: string; status: number };

/** 完整管理員專用：email 不在 ADMIN_EMAILS 一律 403（標註員也會被擋）。 */
export async function requireAdmin(req: Request): Promise<AdminAuthResult> {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth;
  if (!isAdminEmail(auth.email)) return { error: '無權存取', status: 403 };
  return { userId: auth.userId, email: auth.email ?? '', role: 'admin' };
}

/** 標註審核專用：完整管理員或 REVIEWER_EMAILS 名單內的人都放行。 */
export async function requireReviewer(req: Request): Promise<AdminAuthResult> {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth;
  if (isAdminEmail(auth.email)) {
    return { userId: auth.userId, email: auth.email ?? '', role: 'admin' };
  }
  if (isReviewerEmail(auth.email)) {
    return { userId: auth.userId, email: auth.email ?? '', role: 'reviewer' };
  }
  return { error: '無權存取', status: 403 };
}
