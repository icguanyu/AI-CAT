/**
 * 檔案：src/lib/ratelimit.ts
 * 角色：基礎設施層 — 流量限制
 * 功能：以 Upstash Ratelimit（滑動視窗）保護 /api/exam/start 與 /api/chat，
 *       單一 IP 每小時上限預設 20，可用 RATE_LIMIT_PER_HOUR 調整；
 *       RATE_LIMIT_DISABLED=1 則完全略過（本機/壓測用）。
 *       是防止個人 OpenAI Key 被刷爆的第一道閘門。
 */
import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from '@/lib/redis';

const PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR) || 20;
const DISABLED = process.env.RATE_LIMIT_DISABLED === '1';

let limiter: Ratelimit | null = null;

function getRatelimit(): Ratelimit {
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getRedis(),
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

/** true = 放行；false = 已超過上限。RATE_LIMIT_DISABLED=1 時永遠放行。 */
export async function rateLimitOk(req: Request): Promise<boolean> {
  if (DISABLED) return true;
  const { success } = await getRatelimit().limit(`ip:${clientIp(req)}`);
  return success;
}
