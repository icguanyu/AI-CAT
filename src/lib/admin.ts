/**
 * 檔案：src/lib/admin.ts
 * 角色：基礎設施層 — 後台權限判斷
 * 功能：isAdminEmail(email) —— 比對 ADMIN_EMAILS（逗號分隔、大小寫不敏感）。
 *       ADMIN_EMAILS 未設 → 一律 false（fail closed）。
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}
