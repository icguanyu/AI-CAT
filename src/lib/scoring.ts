/**
 * 檔案：src/lib/scoring.ts
 * 角色：領域層 — 由五維度分數推導 L1–L5 分級（後端決定，不交給裁判憑感覺）
 * 功能：weightedAverage() 加權平均；computeLevel() 依平均落點分級，
 *       並套用規則上限（陷阱已生效卻沒被質疑 → 最高 L3）。
 *       加權可依情境題微調各維度側重（SCENARIO_MULT），未列入的題沿用 BASE_WEIGHTS。
 */
import type { Judged, LevelCode } from '@/types/exam';

type ScoreKey = keyof Judged['scores'];

const BASE_WEIGHTS: Record<ScoreKey, number> = {
  prompt_structure: 0.25,
  decomposition: 0.2,
  efficiency: 0.15,
  critical_thinking: 0.25,
  task_completion: 0.15,
};

/**
 * 依任務性質微調各維度側重（相對於 BASE 的倍率，之後會重新正規化到總和 1）。
 * 例：admin_data 任務本身簡單、不需大量補脈絡 → 調降 prompt_structure / decomposition，
 * 調升 efficiency（重點是快速算對）。未列入的 scenarioId 直接用 BASE_WEIGHTS。
 */
const SCENARIO_MULT: Record<string, Partial<Record<ScoreKey, number>>> = {
  ecommerce_apology: {
    prompt_structure: 1.3,
    decomposition: 0.9,
    critical_thinking: 1.2,
    task_completion: 1.2,
  },
  admin_data: {
    prompt_structure: 0.8,
    decomposition: 0.75,
    efficiency: 1.4,
    task_completion: 1.1,
  },
  eng_debug: {
    decomposition: 1.3,
    critical_thinking: 1.4,
    task_completion: 1.2,
  },
};

const KEYS = Object.keys(BASE_WEIGHTS) as ScoreKey[];

function weightsFor(scenarioId?: string): Record<ScoreKey, number> {
  const mult = scenarioId ? SCENARIO_MULT[scenarioId] : undefined;
  if (!mult) return BASE_WEIGHTS;
  const raw = {} as Record<ScoreKey, number>;
  let sum = 0;
  for (const k of KEYS) {
    raw[k] = BASE_WEIGHTS[k] * (mult[k] ?? 1);
    sum += raw[k];
  }
  for (const k of KEYS) raw[k] /= sum; // 正規化回總和 1
  return raw;
}

export function weightedAverage(
  scores: Judged['scores'],
  scenarioId?: string,
): number {
  const w = weightsFor(scenarioId);
  const total = KEYS.reduce((sum, k) => sum + scores[k] * w[k], 0);
  return Math.round(total);
}

const LEVELS: LevelCode[] = ['L1', 'L2', 'L3', 'L4', 'L5'];

export function computeLevel(
  scores: Judged['scores'],
  opts: { trapEffective: boolean; challenged: boolean; scenarioId?: string },
): { level: LevelCode; average: number } {
  const average = weightedAverage(scores, opts.scenarioId);

  let idx: number;
  if (average < 40) idx = 0;
  else if (average < 55) idx = 1;
  else if (average < 70) idx = 2;
  else if (average < 85) idx = 3;
  else idx = 4;

  // 陷阱確實出現在 AI 回覆裡、但受測者沒有質疑 → 分級最高只能到 L3
  if (opts.trapEffective && !opts.challenged && idx > 2) idx = 2;

  return { level: LEVELS[idx], average };
}
