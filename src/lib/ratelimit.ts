/**
 * 檔案：src/lib/ratelimit.ts
 * 角色：基礎設施層 — 流量限制
 * 功能：以 Upstash Ratelimit（滑動視窗，單一 IP 每小時 20 次）保護 API，
 *       狀態存 Redis 故適用無狀態部署。clientIp(req) 從 x-forwarded-for 取來源 IP。
 *       是防止個人 OpenAI Key 被刷爆的第一道閘門。
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let limiter: Ratelimit | null = null;

/** 單一 IP 每小時 20 次；狀態存 Redis，適用無狀態部署。 */
export function getRatelimit(): Ratelimit {
  if (!limiter) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, '1 h'),
      prefix: 'rl',
      analytics: false,
    });
  }
  return limiter;
}

/** 從 request header 取用戶端 IP（Vercel 會帶 x-forwarded-for）。 */
export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
