/**
 * 檔案：src/lib/public-pool.ts
 * 角色：領域層 — 免登入公開試用的額度池 + 匿名結果暫存 + 埋點（都在 Redis）
 * 功能：
 *   - 每月共用池 + 每日子上限：tryConsumePublicSlot() 原子 +1，超過就退回並回報原因。
 *   - 每個 anonId 一輩子一次：markAnonUsed / hasAnonUsed。
 *   - 匿名結果快照：set/get/deleteAnonReport（TTL = ANON_RESULT_TTL_SEC）。
 *   - 埋點：bumpTrialMetric('started'|'completed'|'claimed')；getTrialStats() 給後台看。
 */
import { getRedis } from '@/lib/redis';
import {
  ANON_COOKIE_MAX_AGE_SEC,
  ANON_RESULT_TTL_SEC,
  PUBLIC_TRIAL_DAILY_LIMIT,
  PUBLIC_TRIAL_MONTHLY_LIMIT,
} from '@/config/constants';
import type { AnonReportBlob } from '@/types/exam';

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', ...opts }).format(
    new Date(),
  );
/** 台北年月，例如 2026-09。 */
const taipeiMonth = () => fmt({ year: 'numeric', month: '2-digit' });
/** 台北日期，例如 2026-09-10。 */
const taipeiDate = () =>
  fmt({ year: 'numeric', month: '2-digit', day: '2-digit' });

const monthKey = () => `public:pool:${taipeiMonth()}`;
const dayKey = () => `public:pool:day:${taipeiDate()}`;
const anonUsedKey = (anonId: string) => `anon:used:${anonId}`;
const anonReportKey = (examId: string) => `anonrpt:${examId}`;
const metricKey = (kind: string) => `metric:trial:${kind}:${taipeiMonth()}`;

export type TrialMetric = 'started' | 'completed' | 'claimed';

export interface PoolResult {
  ok: boolean;
  /** 擋下的原因；ok 為 true 時沒有。 */
  reason?: 'monthly' | 'daily';
}

/**
 * 檢查每月上限 + 每日子上限，兩層都過才原子佔用。
 * 任一層超過就把已加的都退回。
 */
export async function tryConsumePublicSlot(): Promise<PoolResult> {
  const redis = getRedis();
  const mk = monthKey();
  const dk = dayKey();

  const month = await redis.incr(mk);
  if (month === 1) await redis.expire(mk, 60 * 60 * 24 * 40);
  if (month > PUBLIC_TRIAL_MONTHLY_LIMIT) {
    await redis.decr(mk);
    return { ok: false, reason: 'monthly' };
  }

  const day = await redis.incr(dk);
  if (day === 1) await redis.expire(dk, 60 * 60 * 24 * 3);
  if (day > PUBLIC_TRIAL_DAILY_LIMIT) {
    await redis.decr(dk);
    await redis.decr(mk);
    return { ok: false, reason: 'daily' };
  }

  return { ok: true };
}

/** 佔用後又失敗時歸還（月 + 日各一格）。 */
export async function releasePublicSlot(): Promise<void> {
  const redis = getRedis();
  await Promise.allSettled([redis.decr(monthKey()), redis.decr(dayKey())]);
}

export interface PoolStatus {
  monthUsed: number;
  monthLimit: number;
  dayUsed: number;
  dayLimit: number;
  exhausted: boolean;
}

export async function getPublicPoolStatus(): Promise<PoolStatus> {
  const redis = getRedis();
  const [m, d] = await Promise.all([
    redis.get<number>(monthKey()),
    redis.get<number>(dayKey()),
  ]);
  const monthUsed = Number(m ?? 0);
  const dayUsed = Number(d ?? 0);
  return {
    monthUsed,
    monthLimit: PUBLIC_TRIAL_MONTHLY_LIMIT,
    dayUsed,
    dayLimit: PUBLIC_TRIAL_DAILY_LIMIT,
    exhausted:
      monthUsed >= PUBLIC_TRIAL_MONTHLY_LIMIT ||
      dayUsed >= PUBLIC_TRIAL_DAILY_LIMIT,
  };
}

/** 埋點：本月某事件 +1。fire-and-forget，不讓計數失敗影響主流程。 */
export async function bumpTrialMetric(kind: TrialMetric): Promise<void> {
  try {
    const redis = getRedis();
    const k = metricKey(kind);
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, 60 * 60 * 24 * 400);
  } catch {
    /* ignore */
  }
}

export interface TrialStats extends PoolStatus {
  month: string;
  started: number;
  completed: number;
  claimed: number;
}

export async function getTrialStats(): Promise<TrialStats> {
  const redis = getRedis();
  const [status, started, completed, claimed] = await Promise.all([
    getPublicPoolStatus(),
    redis.get<number>(metricKey('started')),
    redis.get<number>(metricKey('completed')),
    redis.get<number>(metricKey('claimed')),
  ]);
  return {
    ...status,
    month: taipeiMonth(),
    started: Number(started ?? 0),
    completed: Number(completed ?? 0),
    claimed: Number(claimed ?? 0),
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
