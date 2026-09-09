/**
 * 檔案：src/lib/site-stats.ts
 * 角色：領域層 — 全站檢測結果的彙總數字（著陸頁「本站平均」用）
 * 功能：getSiteStats() 讀 exam_reports、算平均 AI SCORE 與平均分級。
 *       只取兩個小欄位（report->weighted_average / report->suggested_level），
 *       失敗或資料太少（< MIN_SAMPLE）一律回 null，呼叫端不顯示區塊。
 *       著陸頁以 ISR 快取（見 page.tsx 的 revalidate），不會每次請求都打 DB。
 */
import { getSupabaseAdmin } from '@/lib/supabase';

const LEVEL_NUM: Record<string, number> = { L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };

/** 少於這個場次數就不顯示「本站平均」——樣本太小沒有說服力。 */
const MIN_SAMPLE = 5;
/** 場次數達到這個門檻才把「已累積 N 場」秀出來。 */
export const SHOW_COUNT_AT = 30;

export interface SiteStats {
  /** 已保存（登入者）的檢測場次數 */
  count: number;
  /** 平均 AI SCORE（0–100，四捨五入） */
  avgScore: number;
  /** 平均分級數值，一位小數，例如 2.9 */
  avgLevelNumeric: number;
  /** avgScore 落點對應的分級桶，例如 'L2' */
  avgLevel: string;
}

function bucketLevel(score: number): string {
  if (score < 40) return 'L1';
  if (score < 55) return 'L2';
  if (score < 70) return 'L3';
  if (score < 85) return 'L4';
  return 'L5';
}

export async function getSiteStats(): Promise<SiteStats | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('exam_reports')
      .select('score:report->weighted_average, lvl:report->suggested_level')
      .limit(20000);

    if (error || !data || data.length < MIN_SAMPLE) return null;

    const scores = data
      .map((r) => Number((r as { score: unknown }).score))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);
    if (scores.length < MIN_SAMPLE) return null;

    const levels = data
      .map((r) => {
        const raw = String((r as { lvl: unknown }).lvl ?? '').replace(/"/g, '');
        return LEVEL_NUM[raw];
      })
      .filter((n): n is number => Number.isFinite(n));

    const avgScore = Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length,
    );
    const avgLevelNumeric =
      levels.length > 0
        ? Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) /
          10
        : Math.round((avgScore / 20) * 10) / 10;

    return {
      count: data.length,
      avgScore,
      avgLevelNumeric,
      avgLevel: bucketLevel(avgScore),
    };
  } catch {
    return null;
  }
}
