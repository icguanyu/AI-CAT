/**
 * 檔案：src/lib/public-pool.ts
 * 角色：領域層 — 免登入公開試用的額度池 + 匿名結果暫存（都在 Redis）
 * 功能：
 *   - 每月共用池：tryConsumePublicSlot() 原子 +1，超過月上限就退回並回報「已用完」。
 *   - 每個 anonId 一輩子一次：markAnonUsed / hasAnonUsed。
 *   - 匿名結果快照：set/get/deleteAnonReport（TTL = ANON_RESULT_TTL_SEC）。
 */
import { getRedis } from '@/lib/redis';
import {
  ANON_COOKIE_MAX_AGE_SEC,
  ANON_RESULT_TTL_SEC,
  PUBLIC_TRIAL_MONTHLY_LIMIT,
} from '@/config/constants';
import type { AnonReportBlob } from '@/types/exam';

/** 台北時間的年月，例如 2026-09。跨月自然換 key。 */
function taipeiMonth(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
}

const poolKey = () => `public:pool:${taipeiMonth()}`;
const anonUsedKey = (anonId: string) => `anon:used:${anonId}`;
const anonReportKey = (examId: string) => `anonrpt:${examId}`;

export interface PoolResult {
  ok: boolean;
  used: number;
  limit: number;
}

/** 檢查月上限並原子佔用一格；超過就退回、回 ok:false。 */
export async function tryConsumePublicSlot(): Promise<PoolResult> {
  const redis = getRedis();
  const key = poolKey();
  const used = await redis.incr(key);
  // 第一次建立時補 TTL（比一個月長，跨月前自然過期）
  if (used === 1) await redis.expire(key, 60 * 60 * 24 * 40);
  if (used > PUBLIC_TRIAL_MONTHLY_LIMIT) {
    await redis.decr(key);
    return { ok: false, used: used - 1, limit: PUBLIC_TRIAL_MONTHLY_LIMIT };
  }
  return { ok: true, used, limit: PUBLIC_TRIAL_MONTHLY_LIMIT };
}

/** 佔用後又失敗時歸還一格。 */
export async function releasePublicSlot(): Promise<void> {
  await getRedis()
    .decr(poolKey())
    .catch(() => {});
}

export async function getPublicPoolStatus(): Promise<{
  used: number;
  limit: number;
  exhausted: boolean;
}> {
  const used = Number((await getRedis().get<number>(poolKey())) ?? 0);
  return {
    used,
    limit: PUBLIC_TRIAL_MONTHLY_LIMIT,
    exhausted: used >= PUBLIC_TRIAL_MONTHLY_LIMIT,
  };
}

export async function hasAnonUsed(anonId: string): Promise<boolean> {
  return (await getRedis().get(anonUsedKey(anonId))) != null;
}

export async function markAnonUsed(anonId: string): Promise<void> {
  await getRedis().set(anonUsedKey(anonId), 1, { ex: ANON_COOKIE_MAX_AGE_SEC });
}

export async function setAnonReport(
  examId: string,
  blob: AnonReportBlob,
): Promise<void> {
  await getRedis().set(anonReportKey(examId), blob, { ex: ANON_RESULT_TTL_SEC });
}

export async function getAnonReport(
  examId: string,
): Promise<AnonReportBlob | null> {
  return (await getRedis().get<AnonReportBlob>(anonReportKey(examId))) ?? null;
}

export async function deleteAnonReport(examId: string): Promise<void> {
  await getRedis()
    .del(anonReportKey(examId))
    .catch(() => {});
}
