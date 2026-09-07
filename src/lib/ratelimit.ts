/**
 * 檔案：src/lib/ratelimit.ts
 * 角色：基礎設施層 — 流量限制
 * 功能：以 Upstash Ratelimit（滑動視窗）保護 /api/exam/start 與 /api/chat，
 *       單一 IP 每小時上限預設 20，可用 RATE_LIMIT_PER_HOUR 調整；
 *       RATE_LIMIT_DISABLED=1 則完全略過（本機/壓測用）。
 *       checkRateLimit() 回完整用量；rateLimitResponse() 產帶細節的 429。
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR) || 20;
const DISABLED = process.env.RATE_LIMIT_DISABLED === '1';

let limiter: Ratelimit | null = null;

function getRatelimit(): Ratelimit {
  if (!limiter) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(PER_HOUR, '1 h'),
      prefix: 'rl',
      analytics: false,
    });
  }
  return limiter;
}

/** 從 request header 取用戶端 IP（Vercel 會帶 x-forwarded-for；本機通常沒有）。 */
export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export interface RateLimitResult {
  ok: boolean;
  /** 視窗內上限 */
  limit: number;
  /** 本視窗剩餘可用次數 */
  remaining: number;
  /** 額度回補的時間點（ms epoch） */
  reset: number;
}

export async function checkRateLimit(req: Request): Promise<RateLimitResult> {
  if (DISABLED) {
    return { ok: true, limit: PER_HOUR, remaining: PER_HOUR, reset: Date.now() };
  }
  const r = await getRatelimit().limit(`ip:${clientIp(req)}`);
  return {
    ok: r.success,
    limit: r.limit,
    remaining: r.remaining,
    reset: r.reset,
  };
}

/** 產生帶用量細節的 429 回應。 */
export function rateLimitResponse(rl: RateLimitResult): Response {
  const retryMs = Math.max(0, rl.reset - Date.now());
  const retrySec = Math.max(1, Math.ceil(retryMs / 1000));
  const retryMin = Math.max(1, Math.ceil(retryMs / 60000));
  const at = new Date(rl.reset).toLocaleTimeString('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const used = rl.limit - rl.remaining;

  return Response.json(
    {
      error:
        `請求過於頻繁：每小時上限 ${rl.limit} 次，已用 ${used} 次。` +
        `約 ${at}（台北時間）後可再試，還要等約 ${retryMin} 分鐘。`,
      limit: rl.limit,
      used,
      remaining: rl.remaining,
      resetAt: rl.reset,
      retryAfterSec: retrySec,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retrySec),
        'RateLimit-Limit': String(rl.limit),
        'RateLimit-Remaining': String(rl.remaining),
        'RateLimit-Reset': String(retrySec),
      },
    },
  );
}
