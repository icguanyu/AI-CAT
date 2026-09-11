/**
 * 檔案：src/lib/aggregate.test.ts
 * 測 aggregateExams()——`/me` 頁「綜合分級卡」背後的計算。
 *
 * 白話說明：這個函式做兩層加權，公式比較繞，容易手滑改錯又沒人發現：
 * 1. 同一分類做過好幾次 → 越新的那次權重越高（每往前一次，權重乘 0.5）。
 * 2. 不同分類之間 → 越久沒重測的分類，權重越低（45 天減半，但最低還留 0.1 的影響力，
 *    不會完全歸零——半年前做過的分類，還是能提供一點點依據）。
 * 3. 少於 3 種不同分類時不給綜合分級（樣本太少不下結論），但這個「還差幾種」的門檻
 *    只看「做過幾種分類」，不受衰減影響——不會因為時間過去、分數被打折，連「有沒有
 *    資格看到分級」都跟著變動。
 *
 * `aggregateExams(items, now)` 的第二個參數可以直接指定「現在是幾點」，就是為了方便
 * 測試時固定時間、不用真的等時間流逝。
 */
import { describe, it, expect } from 'vitest';
import { aggregateExams } from './aggregate';
import type { ExamListItem, Judged } from '@/types/exam';

/** 建一組五維分數，五個維度都給同一個數字，方便直接對答案。 */
function scores(v: number): Judged['scores'] {
  return {
    prompt_structure: v,
    decomposition: v,
    efficiency: v,
    critical_thinking: v,
    task_completion: v,
  };
}

let counter = 0;
/** 建一筆歷史紀錄，只需要指定會影響計算的欄位（createdAt / category / scores）。 */
function item(overrides: Partial<ExamListItem> & { createdAt: string }): ExamListItem {
  counter += 1;
  return {
    examId: `test-exam-${counter}`,
    titleZh: null,
    category: 'it_software',
    suggestedLevel: 'L3',
    weightedAverage: 50,
    scores: scores(50),
    familiarity: null,
    challenged: true,
    shared: false,
    ...overrides,
  };
}

describe('aggregateExams — 分類數門檻（GATE=3）', () => {
  it('只做過 2 種分類 → 不給綜合分級，並顯示還差 1 種', () => {
    const now = Date.parse('2026-09-11T00:00:00Z');
    const items = [
      item({ createdAt: '2026-09-10T00:00:00Z', category: 'it_software' }),
      item({ createdAt: '2026-09-09T00:00:00Z', category: 'finance_invest' }),
    ];
    const agg = aggregateExams(items, now);
    expect(agg.distinctCategories).toBe(2);
    expect(agg.gateNeeded).toBe(1);
    expect(agg.compositeLevel).toBeNull();
    // 注意：即使沒達門檻，compositeAverage 這個數字本身還是算得出來，只是「分級」不顯示。
    expect(agg.compositeAverage).not.toBeNull();
  });

  it('做滿 3 種不同分類 → 達標，給出綜合分級', () => {
    const now = Date.parse('2026-09-11T00:00:00Z');
    const items = [
      item({ createdAt: '2026-09-10T00:00:00Z', category: 'it_software' }),
      item({ createdAt: '2026-09-09T00:00:00Z', category: 'finance_invest' }),
      item({ createdAt: '2026-09-08T00:00:00Z', category: 'healthcare' }),
    ];
    const agg = aggregateExams(items, now);
    expect(agg.gateNeeded).toBe(0);
    expect(agg.compositeLevel).not.toBeNull();
  });
});

describe('aggregateExams — 同分類多次時，新的一次權重比較高', () => {
  it('同分類兩次，加權平均應該比單純算術平均更靠近最新那次', () => {
    const now = Date.parse('2026-09-11T00:00:00Z');
    // 同分類 it_software：最新一次 90 分，前一次 30 分（新→舊排序，符合真實 API 回傳順序）。
    // 另外補兩個不同分類湊到門檻，純粹是為了讓 compositeAverage 有意義，不影響這裡要驗證的邏輯。
    const items = [
      item({
        createdAt: '2026-09-11T00:00:00Z',
        category: 'it_software',
        scores: scores(90),
      }),
      item({
        createdAt: '2026-09-10T00:00:00Z',
        category: 'it_software',
        scores: scores(30),
      }),
      item({ createdAt: '2026-09-09T00:00:00Z', category: 'finance_invest', scores: scores(60) }),
      item({ createdAt: '2026-09-08T00:00:00Z', category: 'healthcare', scores: scores(60) }),
    ];
    const agg = aggregateExams(items, now);
    const itCat = agg.perCategory.find((c) => c.category === 'it_software')!;
    // 加權平均 = (90*1 + 30*0.5) / 1.5 = 70，比單純算術平均 (90+30)/2 = 60 更靠近最新那次。
    expect(itCat.average).toBe(70);
  });
});

describe('aggregateExams — 跨分類過時衰減', () => {
  it('90 天沒重測的分類（超過 2 個半衰期），權重明顯低於剛測過的分類', () => {
    const now = Date.parse('2026-09-11T00:00:00Z');
    const items = [
      item({ createdAt: '2026-09-11T00:00:00Z', category: 'it_software' }), // 0 天前，剛測
      item({ createdAt: '2026-06-13T00:00:00Z', category: 'finance_invest' }), // ~90 天前
      item({ createdAt: '2026-09-01T00:00:00Z', category: 'healthcare' }), // 10 天前
    ];
    const agg = aggregateExams(items, now);
    const fresh = agg.perCategory.find((c) => c.category === 'it_software')!;
    const stale = agg.perCategory.find((c) => c.category === 'finance_invest')!;
    expect(stale.stale).toBe(true); // 超過 30 天標記為「已過時」
    expect(fresh.weight).toBeGreaterThan(stale.weight); // 權重應該明顯比較高
  });
});
