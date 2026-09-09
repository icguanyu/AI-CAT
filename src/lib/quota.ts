/**
 * 檔案：src/lib/quota.ts
 * 角色：領域層 — 檢測次數控管（每日 N 次 + 生涯上限 M 次）
 * 功能：checkQuota() 讀 user_quota 判斷「今天」與「生涯」是否還有次數（/api/exam/start 用）；
 *       consumeQuota() 透過 consume_quota RPC 原子 +1（同時處理每日計數與隔日重置）。
 *       寫入一律走後端 service_role client。
 *       每日以台北時間為界；day_used / day_date 欄若尚未 migrate，僅生涯上限生效。
 */
import { getSupabaseAdmin } from '@/lib/supabase';
import { DAILY_ATTEMPTS, MAX_ATTEMPTS } from '@/config/constants';

export interface QuotaStatus {
  ok: boolean;
  /** 生涯已用 */
  used: number;
  /** 生涯上限 */
  limit: number;
  /** 今日已用（台北時間；隔日歸零） */
  dayUsed: number;
  /** 每日上限 */
  dayLimit: number;
  /** 擋下的原因；ok 為 true 時沒有 */
  reason?: 'daily' | 'total';
}

/** 台北時間的今天，格式 YYYY-MM-DD（對齊 Postgres date）。 */
function taipeiToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(
    new Date(),
  );
}

export async function checkQuota(userId: string): Promise<QuotaStatus> {
  const { data, error } = await getSupabaseAdmin()
    .from('user_quota')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`讀取 user_quota 失敗：${error.message}`);

  const row = (data ?? {}) as {
    used?: number;
    free_limit?: number;
    day_used?: number;
    day_date?: string;
  };

  // trigger 會在註冊時建列；保險起見沒有就當作全新配額。
  const used = row.used ?? 0;
  const limit = row.free_limit ?? MAX_ATTEMPTS;
  const dayLimit = DAILY_ATTEMPTS;
  // 跨日（或欄位尚未 migrate）→ 今日視為 0
  const dayUsed = row.day_date === taipeiToday() ? (row.day_used ?? 0) : 0;

  const totalOk = used < limit;
  const dailyOk = dayUsed < dayLimit;
  return {
    ok: totalOk && dailyOk,
    used,
    limit,
    dayUsed,
    dayLimit,
    reason: !totalOk ? 'total' : !dailyOk ? 'daily' : undefined,
  };
}

export async function consumeQuota(userId: string): Promise<void> {
  const { error } = await getSupabaseAdmin().rpc('consume_quota', {
    p_user_id: userId,
  });
  if (error) throw new Error(`更新 user_quota 失敗：${error.message}`);
}
