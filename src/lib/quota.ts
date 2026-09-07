/**
 * 檔案：src/lib/quota.ts
 * 角色：領域層 — 免費檢測次數控管
 * 功能：checkQuota() 讀 user_quota 判斷是否還有免費次數（/api/exam/start 用）；
 *       consumeQuota() 透過 consume_quota RPC 原子 +1（Phase 3 的 /api/evaluate 用）。
 *       寫入一律走後端 service_role client。
 */
import { getSupabaseAdmin } from '@/lib/supabase';
import { FREE_ATTEMPTS } from '@/config/constants';

export interface QuotaStatus {
  ok: boolean;
  used: number;
  limit: number;
}

export async function checkQuota(userId: string): Promise<QuotaStatus> {
  const { data, error } = await getSupabaseAdmin()
    .from('user_quota')
    .select('used, free_limit')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`讀取 user_quota 失敗：${error.message}`);

  // trigger 會在註冊時建列；保險起見沒有就當作全新配額。
  const used = data?.used ?? 0;
  const limit = data?.free_limit ?? FREE_ATTEMPTS;
  return { ok: used < limit, used, limit };
}

export async function consumeQuota(userId: string): Promise<void> {
  const { error } = await getSupabaseAdmin().rpc('consume_quota', {
    p_user_id: userId,
  });
  if (error) throw new Error(`更新 user_quota 失敗：${error.message}`);
}
