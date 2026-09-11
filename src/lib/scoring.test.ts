/**
 * 檔案：src/lib/scoring.test.ts
 * 在測「加權平均」跟「怎麼分級」這兩個函式——整個產品的分數計算核心。
 *
 * 白話說明：
 * - weightedAverage()：五個維度分數不是直接加起來除以 5（那是「算術平均」），而是每個維度
 *   乘上固定權重再加總（提示詞結構 25%、拆解 20%、效率 15%、批判思考 25%、任務達成 15%）。
 *   這條規則之前出過真實事故：ResultCard 一度誤用算術平均，導致同一場測驗，結果卡片顯示
 *   61 分，個人頁卻顯示 57 分——兩個數字看起來都「合理」，肉眼很難發現哪裡錯，直到有人拿
 *   同一份分數手動算了兩種平均才抓到。這批測試把「加權平均要怎麼算」釘死，以後只要有人
 *   不小心改錯權重、或哪裡又偷用算術平均，測試會直接紅燈，不用等使用者發現分數對不上。
 * - computeLevel()：把加權平均分數對應到 L1–L5，還有一條特殊規則——陷阱有生效但受測者
 *   沒發現（沒有質疑），不管分數多高，最高只能拿到 L3（不能因為「運氣好陷阱沒被問到」拿高分）。
 */
import { describe, it, expect } from 'vitest';
import { weightedAverage, computeLevel } from './scoring';
import type { Judged } from '@/types/exam';

/** 建一組五維分數，預設全部同分，方便只改想測的那幾個維度。 */
function scores(overrides: Partial<Judged['scores']> = {}): Judged['scores'] {
  return {
    prompt_structure: 50,
    decomposition: 50,
    efficiency: 50,
    critical_thinking: 50,
    task_completion: 50,
    ...overrides,
  };
}

describe('weightedAverage', () => {
  it('五維都同分時，加權平均就等於那個分數（五個權重加總本來就是 1）', () => {
    expect(
      weightedAverage(
        scores({
          prompt_structure: 80,
          decomposition: 80,
          efficiency: 80,
          critical_thinking: 80,
          task_completion: 80,
        }),
      ),
    ).toBe(80);
  });

  it('權重高的維度拉高分數，對總分的影響比權重低的維度大', () => {
    // 例：批判思考（權重 25%）從 50 拉到 100，跟效率（權重 15%）從 50 拉到 100，
    // 兩邊都是「+50 分」的漲幅，但 critical_thinking 權重比較高，理應貢獻更多。
    const raiseCritical =
      weightedAverage(scores({ critical_thinking: 100 })) - weightedAverage(scores());
    const raiseEfficiency =
      weightedAverage(scores({ efficiency: 100 })) - weightedAverage(scores());
    expect(raiseCritical).toBeGreaterThan(raiseEfficiency);
  });

  it('拿一組真實案例手動算好答案，鎖死結果（防止之後有人不小心改錯權重）', () => {
    // ps35 dec55 eff65 ct50 tc100
    // = 0.25*35 + 0.2*55 + 0.15*65 + 0.25*50 + 0.15*100
    // = 8.75 + 11 + 9.75 + 12.5 + 15 = 57
    const s = scores({
      prompt_structure: 35,
      decomposition: 55,
      efficiency: 65,
      critical_thinking: 50,
      task_completion: 100,
    });
    expect(weightedAverage(s)).toBe(57);
  });
});

describe('computeLevel', () => {
  it.each([
    [30, 'L1'],
    [45, 'L2'],
    [60, 'L3'],
    [75, 'L4'],
    [90, 'L5'],
  ] as const)('平均分 %d 分（沒有陷阱情境）→ %s', (avg, expected) => {
    const s = scores({
      prompt_structure: avg,
      decomposition: avg,
      efficiency: avg,
      critical_thinking: avg,
      task_completion: avg,
    });
    expect(computeLevel(s, { trapEffective: false, challenged: false }).level).toBe(expected);
  });

  it('分數再高，只要陷阱生效卻沒被質疑，最高只能是 L3', () => {
    // 例：五維都 95 分，單看分數本來是 L5，但因為沒質疑陷阱，被壓到 L3。
    const s = scores({
      prompt_structure: 95,
      decomposition: 95,
      efficiency: 95,
      critical_thinking: 95,
      task_completion: 95,
    });
    const result = computeLevel(s, { trapEffective: true, challenged: false });
    expect(result.average).toBeGreaterThan(85);
    expect(result.level).toBe('L3');
  });

  it('陷阱生效但有質疑 → 不受 L3 上限限制，可以拿到分數真正對應的等級', () => {
    const s = scores({
      prompt_structure: 95,
      decomposition: 95,
      efficiency: 95,
      critical_thinking: 95,
      task_completion: 95,
    });
    const result = computeLevel(s, { trapEffective: true, challenged: true });
    expect(result.level).toBe('L5');
  });
});
