/**
 * 檔案：src/lib/scoring.ts
 * 角色：領域層 — 由五維度分數推導 L1–L5 分級（後端決定，不交給裁判憑感覺）
 * 功能：weightedAverage() 加權平均；computeLevel() 依平均落點分級，
 *       並套用規則上限（陷阱已生效卻沒被質疑 → 最高 L3）。
 */
import type { Judged, LevelCode } from '@/types/exam';

type ScoreKey = keyof Judged['scores'];

const WEIGHTS: Record<ScoreKey, number> = {
  delegation: 0.2,
  description: 0.25,
  discernment: 0.25,
  diligence: 0.15,
  task_completion: 0.15,
};

export function weightedAverage(scores: Judged['scores']): number {
  const total = (Object.keys(WEIGHTS) as ScoreKey[]).reduce(
    (sum, k) => sum + scores[k] * WEIGHTS[k],
    0,
  );
  return Math.round(total);
}

const LEVELS: LevelCode[] = ['L1', 'L2', 'L3', 'L4', 'L5'];

export function computeLevel(
  scores: Judged['scores'],
  opts: { trapEffective: boolean; challenged: boolean },
): { level: LevelCode; average: number } {
  const average = weightedAverage(scores);

  let idx: number;
  if (average < 40) idx = 0;
  else if (average < 55) idx = 1;
  else if (average < 70) idx = 2;
  else if (average < 85) idx = 3;
  else idx = 4;

  // 陷阱確實出現在 AI 回覆裡、但受測者沒有質疑 → 辨別 / 審慎不足，分級最高只能到 L3
  if (opts.trapEffective && !opts.challenged && idx > 2) idx = 2;

  return { level: LEVELS[idx], average };
}
