/**
 * 檔案：src/lib/aggregate.ts
 * 角色：領域層 — 由個人歷史算「綜合能力估計」
 * 方法：以「相異 category」為單位（不是單場、不是相同情境重做）：
 *   1. 每個 category 內，該類的場次做「近期加權平均」（最新那次權重 1，往前每次 ×0.5）。
 *   2. 綜合五維 = 各 category 值的算術平均。
 *   3. 綜合分級用 computeLevel（不套陷阱上限——這是能力估計，不是單場）。
 * 顯示門檻：相異 category < GATE 時不給綜合分級，只提示「再做幾種分類」。
 */
import { computeLevel, weightedAverage } from '@/lib/scoring';
import {
  CATEGORY_LABEL,
  type Category,
  type ExamListItem,
  type Judged,
  type LevelCode,
} from '@/types/exam';

const GATE = 3; // 相異 category 數，達標才顯示綜合分級
const DECAY = 0.5; // 近期加權：第 k 舊一次的權重 = DECAY^k

type ScoreKey = keyof Judged['scores'];
const KEYS: ScoreKey[] = [
  'prompt_structure',
  'decomposition',
  'efficiency',
  'critical_thinking',
  'task_completion',
];

export interface CategoryStat {
  category: Category;
  label: string;
  count: number;
  average: number;
  level: LevelCode;
}

export interface Aggregate {
  totalExams: number;
  distinctCategories: number;
  /** 還差幾種相異分類才到門檻；0 = 已達標。 */
  gateNeeded: number;
  /** 綜合五維（依 KEYS 順序）；沒有任何帶分類的場次時為 null。 */
  composite: number[] | null;
  compositeAverage: number | null;
  /** 達門檻才有；否則 null。 */
  compositeLevel: LevelCode | null;
  /** 各分類細分，場次多到少。 */
  perCategory: CategoryStat[];
}

/** items 需為新到舊排序（/api/me/exams 已如此）。 */
export function aggregateExams(items: ExamListItem[]): Aggregate {
  const withCat = items.filter(
    (e): e is ExamListItem & { category: Category } => e.category != null,
  );

  const byCat = new Map<Category, ExamListItem[]>();
  for (const e of withCat) {
    const arr = byCat.get(e.category) ?? [];
    arr.push(e); // 已是新→舊
    byCat.set(e.category, arr);
  }

  const catScores = new Map<Category, Judged['scores']>();
  for (const [cat, rows] of byCat) {
    const acc = {} as Judged['scores'];
    let wSum = 0;
    rows.forEach((row, k) => {
      const w = DECAY ** k;
      wSum += w;
      for (const key of KEYS) {
        acc[key] = (acc[key] ?? 0) + row.scores[key] * w;
      }
    });
    for (const key of KEYS) acc[key] = acc[key] / wSum;
    catScores.set(cat, acc);
  }

  const perCategory: CategoryStat[] = [...catScores.entries()]
    .map(([category, s]) => ({
      category,
      label: CATEGORY_LABEL[category],
      count: byCat.get(category)!.length,
      average: weightedAverage(s),
      level: computeLevel(s, { trapEffective: false, challenged: true }).level,
    }))
    .sort((a, b) => b.count - a.count || b.average - a.average);

  const distinctCategories = catScores.size;
  const gateNeeded = Math.max(0, GATE - distinctCategories);

  let composite: number[] | null = null;
  let compositeAverage: number | null = null;
  let compositeLevel: LevelCode | null = null;

  if (distinctCategories > 0) {
    const mean = {} as Judged['scores'];
    for (const key of KEYS) {
      let sum = 0;
      for (const s of catScores.values()) sum += s[key];
      mean[key] = sum / distinctCategories;
    }
    composite = KEYS.map((k) => Math.round(mean[k]));
    compositeAverage = weightedAverage(mean);
    if (gateNeeded === 0) {
      compositeLevel = computeLevel(mean, {
        trapEffective: false,
        challenged: true,
      }).level;
    }
  }

  return {
    totalExams: items.length,
    distinctCategories,
    gateNeeded,
    composite,
    compositeAverage,
    compositeLevel,
    perCategory,
  };
}
