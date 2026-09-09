/**
 * 檔案：src/lib/turnstile.ts
 * 角色：基礎設施層 — Cloudflare Turnstile 驗證（擋機器人刷免登入試用）
 * 功能：turnstileEnabled() —— 兩把 key 都設好才啟用；沒設就完全略過（不擋任何人）。
 *       verifyTurnstile(token, ip) —— 呼叫 siteverify；未啟用一律回 true。
 */
const VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function turnstileEnabled(): boolean {
  return (
    !!process.env.TURNSTILE_SECRET_KEY &&
    !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  );
}

export async function verifyTurnstile(
  token: string | undefined | null,
  ip: string | null,
): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams();
    body.set('secret', process.env.TURNSTILE_SECRET_KEY as string);
    body.set('response', token);
    if (ip) body.set('remoteip', ip);
    const res = await fetch(VERIFY_URL, { method: 'POST', body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // 驗證服務掛掉時「放行」——寧可暫時少一層防護，也不要把所有試用者擋在外面。
    console.error('[turnstile] siteverify 失敗，暫時放行');
    return true;
  }
}
