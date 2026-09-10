/**
 * 檔案：src/lib/profile.ts
 * 角色：領域層 — 讀寫使用者自填的分群資料（profiles 表）
 * 功能：getProfileExtras() 讀回目前值；saveProfileExtras() upsert 進 profiles。
 *       只接受封閉詞彙內的值（見 types/profile.ts），非法值忽略。走 service_role。
 */
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  isAgeBand,
  isEducation,
  isGender,
  type ProfileExtras,
} from '@/types/profile';

export async function getProfileExtras(userId: string): Promise<ProfileExtras> {
  const { data } = await getSupabaseAdmin()
    .from('profiles')
    .select('age_band, education, gender')
    .eq('id', userId)
    .maybeSingle();
  const row = (data ?? {}) as {
    age_band?: unknown;
    education?: unknown;
    gender?: unknown;
  };
  return {
    ageBand: isAgeBand(row.age_band) ? row.age_band : null,
    education: isEducation(row.education) ? row.education : null,
    gender: isGender(row.gender) ? row.gender : null,
  };
}

/**
 * 部分更新：只寫入通過驗證的欄位（其餘保留原值）。
 * 回傳寫入後的完整值。
 */
export async function saveProfileExtras(
  userId: string,
  input: {
    ageBand?: unknown;
    education?: unknown;
    gender?: unknown;
  },
): Promise<ProfileExtras> {
  const patch: Record<string, string> = {};
  if (isAgeBand(input.ageBand)) patch.age_band = input.ageBand;
  if (isEducation(input.education)) patch.education = input.education;
  if (isGender(input.gender)) patch.gender = input.gender;

  if (Object.keys(patch).length === 0) return getProfileExtras(userId);

  patch.extras_updated_at = new Date().toISOString();

  // profiles 列應由 sync_profile trigger 建好；upsert 以防萬一。
  await getSupabaseAdmin()
    .from('profiles')
    .upsert({ id: userId, ...patch }, { onConflict: 'id' });

  return getProfileExtras(userId);
}
