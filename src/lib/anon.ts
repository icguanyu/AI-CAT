/**
 * 檔案：src/lib/anon.ts
 * 角色：基礎設施層 — 免登入試用的匿名身分（簽章 cookie）
 * 功能：發一組隨機 anonId，用 HMAC 簽章寫進 httpOnly cookie；
 *       之後每次請求從 Cookie header 讀回、驗簽。不含任何 PII。
 *       用途：(1) 每個瀏覽器限一次試用 (2) 試用結果與該瀏覽器綁定、登入後可認領。
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { ANON_COOKIE_MAX_AGE_SEC } from '@/config/constants';

export const ANON_COOKIE = 'ai_cat_anon';

/** 簽章密鑰：優先用 ANON_SECRET，否則從 service_role key 衍生（部署一定有）。 */
function secret(): string {
  return (
    process.env.ANON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'ai-cat-anon-dev-secret'
  );
}

function sign(id: string): string {
  return createHmac('sha256', secret()).update(id).digest('base64url');
}

/** 產生一組新的已簽章 cookie 值（格式 `<uuid>.<sig>`）。 */
export function mintAnon(): { id: string; cookieValue: string } {
  const id = randomUUID();
  return { id, cookieValue: `${id}.${sign(id)}` };
}

/** 驗簽並取出 anonId；失敗回 null。 */
export function verifyAnon(cookieValue: string | undefined | null): string | null {
  if (!cookieValue) return null;
  const dot = cookieValue.lastIndexOf('.');
  if (dot <= 0) return null;
  const id = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  const expected = sign(id);
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return id;
}

/** 從 Request 的 Cookie header 讀回已驗簽的 anonId。 */
export function readAnonId(req: Request): string | null {
  const raw = req.headers.get('cookie');
  if (!raw) return null;
  const hit = raw
    .split(/;\s*/)
    .map((c) => c.split('='))
    .find(([k]) => k === ANON_COOKIE);
  if (!hit) return null;
  return verifyAnon(decodeURIComponent(hit[1] ?? ''));
}

/** 產生 Set-Cookie 字串（httpOnly / SameSite=Lax / 正式站 Secure）。 */
export function anonSetCookie(cookieValue: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return (
    `${ANON_COOKIE}=${encodeURIComponent(cookieValue)}` +
    `; Path=/; Max-Age=${ANON_COOKIE_MAX_AGE_SEC}; HttpOnly; SameSite=Lax${secure}`
  );
}
