/**
 * 檔案：src/lib/app-settings.ts
 * 角色：領域層 — 後台可調參數（Supabase `app_settings` 表，key/value jsonb）
 * 功能：getSetting(key, fallback) 讀單一設定，記憶體快取 60 秒（改設定不用 redeploy，
 *       跟 scenarios.ts 同一個快取模式）；讀取失敗（表不存在 / 連線失敗）一律退回 fallback，
 *       不讓評分因為這個非核心功能掛掉。setSetting() 供後台寫入，呼叫端自行用 requireAdmin() 把關。
 */
import { getSupabaseAdmin } from '@/lib/supabase';

const TTL_MS = 60_000;
let cache: { at: number; data: Record<string, unknown> } | null = null;

async function loadAll(): Promise<Record<string, unknown>> {
  const { data, error } = await getSupabaseAdmin()
    .from('app_settings')
    .select('key, value');
  if (error) throw new Error(`app_settings 讀取失敗：${error.message}`);
  const out: Record<string, unknown> = {};
  for (const row of (data ?? []) as { key: string; value: unknown }[]) {
    out[row.key] = row.value;
  }
  return out;
}

async function getAll(): Promise<Record<string, unknown>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const data = await loadAll();
    cache = { at: Date.now(), data };
    return data;
  } catch (e) {
    console.error('app_settings 讀取失敗，本次沿用預設值', e);
    // 保留舊快取（哪怕過期）好過完全沒有；真的沒快取過就回空物件，呼叫端會落回 fallback。
    return cache?.data ?? {};
  }
}

/**
 * 讀一個後台可調設定；讀不到或型別不合都退回 fallback（永遠不拋錯）。
 * T 由 fallback 的型別推斷，呼叫端負責確保存進去的 value 型別一致。
 */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const all = await getAll();
  const v = all[key];
  return v === undefined || v === null ? fallback : (v as T);
}

/** 後台寫入單一設定；呼叫端負責用 requireAdmin() 把關，這裡不重複驗證身分。 */
export async function setSetting(
  key: string,
  value: unknown,
  updatedBy?: string,
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('app_settings')
    .upsert({ key, value, updated_by: updatedBy ?? null });
  if (error) throw new Error(`app_settings 寫入失敗：${error.message}`);
  cache = null; // 立即讓下一次讀取重新抓，不用等 60 秒 TTL
}
