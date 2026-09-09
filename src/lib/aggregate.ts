/**
 * 檔案：src/lib/aggregate.ts
 * 角色：領域層 — 由個人歷史算「綜合能力估計」
 * 方法：以「相異 category」為單位（不是單場、不是相同情境重做）：
 *   1. 每個 category 內，該類的場次做「近期加權平均」（最新那次權重 1，往前每次 ×DECAY）。
 *   2. 跨情境過時衰減：每個 category 依「距今多久沒重測」再打一次折
 *      （半衰期 STALE_HALF_LIFE_DAYS 天，最低保留 MIN_STALE_WEIGHT）。
 *   3. 綜合五維 = 各 category 值以「過時權重」做加權平均。
 *   4. 綜合分級用 computeLevel（不套陷阱上限——這是能力估計，不是單場）。
 * 顯示門檻：相異 category < GATE 時不給綜合分級，只提示「再做幾種分類」。
 *   （門檻只看「做過幾種分類」，不受過時衰減影響——不會因時間流逝而鎖回去。）
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
const DECAY = 0.5; // 類內近期加權：第 k 舊一次的權重 = DECAY^k

const DAY_MS = 86_400_000;
/** 跨情境過時衰減半衰期：某分類最後一次測到現在滿這麼多天，貢獻減半。 */
const STALE_HALF_LIFE_DAYS = 45;
/** 過時分類的權重下限（相對最新分類）；再舊也還留一點影響力。 */
const MIN_STALE_WEIGHT = 0.1;
/** perCategory.stale 的判定門檻（天）。 */
const STALE_MARK_DAYS = 30;

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
  /** 該分類最後一次測距今幾天（四捨五入）。 */
  ageDays: number;
  /** 過時衰減後、在綜合估計裡的權重占比（0–1，全部相加為 1）。 */
  weight: number;
  /** 是否已過時（ageDays ≥ STALE_MARK_DAYS）。 */
  stale: boolean;
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

/**
 * @param items /api/me/exams 的結果（新到舊排序）。
 * @param now   現在時間（ms epoch），預設 Date.now()；可注入以利測試。
 */
export function aggregateExams(
  items: ExamListItem[],
  now: number = Date.now(),
): Aggregate {
  const withCat = items.filter(
    (e): e is ExamListItem & { category: Category } => e.category != null,
  );

  const byCat = new Map<Category, ExamListItem[]>();
  for (const e of withCat) {
    const arr = byCat.get(e.category) ?? [];
    arr.push(e); // 已是新→舊
    byCat.set(e.category, arr);
  }

  // 類內近期加權平均 + 該類「距今幾天」
  const catScores = new Map<Category, Judged['scores']>();
  const catAgeDays = new Map<Category, number>();
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

    const newest = Date.parse(rows[0].createdAt);
    const ageDays = Number.isNaN(newest)
      ? 0
      : Math.max(0, (now - newest) / DAY_MS);
    catAgeDays.set(cat, ageDays);
  }

  // 跨情境過時權重（半衰期指數衰減 + 下限）
  const staleWeight = (ageDays: number) =>
    Math.max(MIN_STALE_WEIGHT, DECAY ** (ageDays / STALE_HALF_LIFE_DAYS));
  const rawWeights = new Map<Category, number>();
  let weightSum = 0;
  for (const [cat, ageDays] of catAgeDays) {
    const w = staleWeight(ageDays);
    rawWeights.set(cat, w);
    weightSum += w;
  }

  const perCategory: CategoryStat[] = [...catScores.entries()]
    .map(([category, s]) => {
      const ageDays = catAgeDays.get(category) ?? 0;
      return {
        category,
        label: CATEGORY_LABEL[category],
        count: byCat.get(category)!.length,
        average: weightedAverage(s),
        level: computeLevel(s, { trapEffective: false, challenged: true }).level,
        ageDays: Math.round(ageDays),
        weight: weightSum > 0 ? (rawWeights.get(category) ?? 0) / weightSum : 0,
        stale: ageDays >= STALE_MARK_DAYS,
      };
    })
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
      for (const [cat, s] of catScores) {
        sum += s[key] * (rawWeights.get(cat) ?? 0);
      }
      mean[key] = weightSum > 0 ? sum / weightSum : 0;
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
