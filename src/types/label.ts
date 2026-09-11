/**
 * 檔案：src/types/label.ts
 * 角色：型別層 — 後台人工標註（/admin/review）用的封閉詞彙
 * 功能：ScoreBucket（弱/基本/紮實/強）取代 0–100 假精度；人工標註求快、求穩定。
 *       nearestBucket() 把裁判給的分數映到最接近的桶，當審核頁的預設值（同意就零點擊）。
 */

export type ScoreKey =
  | 'prompt_structure'
  | 'decomposition'
  | 'efficiency'
  | 'critical_thinking'
  | 'task_completion';

export const SCORE_KEYS: ScoreKey[] = [
  'prompt_structure',
  'decomposition',
  'efficiency',
  'critical_thinking',
  'task_completion',
];

export const SCORE_KEY_LABEL: Record<ScoreKey, string> = {
  prompt_structure: '提示詞結構',
  decomposition: '問題拆解力',
  efficiency: '對話效率',
  critical_thinking: '批判思考',
  task_completion: '任務達成率',
};

export type ScoreBucket = 'weak' | 'basic' | 'solid' | 'strong';

export const SCORE_BUCKET_LABEL: Record<ScoreBucket, string> = {
  weak: '弱',
  basic: '基本',
  solid: '紮實',
  strong: '強',
};

/** 桶 → 代表分數；只在需要跟舊的 0–100 資料比較時使用，標註本身不比這個精細。 */
export const SCORE_BUCKET_VALUE: Record<ScoreBucket, number> = {
  weak: 20,
  basic: 50,
  solid: 75,
  strong: 95,
};

export const SCORE_BUCKETS: ScoreBucket[] = ['weak', 'basic', 'solid', 'strong'];

export function isScoreBucket(v: unknown): v is ScoreBucket {
  return typeof v === 'string' && v in SCORE_BUCKET_LABEL;
}

/** 把裁判的 0–100 分映到最接近的桶（審核頁預設值：同意 AI 就不用點）。 */
export function nearestBucket(score: number): ScoreBucket {
  if (score < 35) return 'weak';
  if (score < 60) return 'basic';
  if (score < 85) return 'solid';
  return 'strong';
}
