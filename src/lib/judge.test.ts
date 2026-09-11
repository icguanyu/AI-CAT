/**
 * 檔案：src/lib/judge.test.ts
 * 只測 judge.ts 裡不需要打 AI API 的三個純函式（median／stddev／detectChallenge）。
 * 裁判本身（runJudge 那些會真的呼叫 AI 模型的函式）不在這批測試範圍內——那種要嘛花錢、
 * 要嘛要 mock 掉整個 AI SDK，之後再說。
 *
 * 白話說明：
 * - median()／stddev()：self-consistency 把同一場對話交給裁判並行跑 3 次，取中位數當
 *   最終分數、算標準差判斷「這 3 次答案差多少」。如果這兩個算錯，會直接影響使用者最終
 *   看到的分數，也會影響 flaggedDimensions（哪些維度不穩定、該送去人工複審）判斷得準不準。
 * - detectChallenge()：用關鍵字判斷「使用者有沒有質疑陷阱」。目前是純中文關鍵字比對，
 *   有一個已知缺口——非中文的質疑語句（例如日文「本当ですか」）完全偵測不到。下面刻意
 *   留一個 it.skip 的測試把這個缺口寫下來（skip 掉不會讓測試變紅，但寫在檔案裡提醒，
 *   之後真的要做多語系支援時要處理，見 memory「多語系」那則記錄）。
 */
import { describe, it, expect } from 'vitest';
import { median, stddev, detectChallenge } from './judge';
import type { ChatMessage } from '@/types/exam';

describe('median', () => {
  it('奇數個數字，取排序後正中間那個', () => {
    // 例：三次裁判分別打 60、90、70 分 → 排序後 60,70,90 → 中位數是 70。
    expect(median([60, 90, 70])).toBe(70);
  });

  it('偶數個數字，取中間兩個的平均（四捨五入）', () => {
    // 例：兩次分別 60、90 → 平均 75。
    expect(median([60, 90])).toBe(75);
  });

  it('極端值不會拉走中位數——這正是選用中位數、不用平均數的原因', () => {
    // 例：三次 60、62、95，其中一次明顯離群（可能那次裁判抽風）。
    // 如果用平均數會被拉到 72.3，但中位數還是 62，比較貼近「大多數次數的共識」。
    expect(median([60, 62, 95])).toBe(62);
  });
});

describe('stddev', () => {
  it('三次分數完全一樣 → 標準差是 0（完全穩定）', () => {
    expect(stddev([80, 80, 80])).toBe(0);
  });

  it('分數差很多 → 標準差明顯偏高（超過 CONSISTENCY_SD_ALERT=12 就會被標記為不穩定）', () => {
    // 例：三次 40、70、100，一次比一次差 30 分，這種波動在信度測試裡就是「規則有漏洞」的訊號。
    expect(stddev([40, 70, 100])).toBeGreaterThan(12);
  });
});

describe('detectChallenge', () => {
  /** 把純文字陣列包成 ChatMessage[]，全部當使用者發言（這個函式本來就只看 user 訊息）。 */
  const historyOf = (userLines: string[]): ChatMessage[] =>
    userLines.map((content) => ({ role: 'user' as const, content }));

  it('陷阱之後的發言裡有查證關鍵字 → 偵測到質疑', () => {
    // 例：三句使用者發言，第 3 句（索引 2，也就是 injectAtUserTurn=2 之後）問
    // 「你確定嗎？可以給我來源嗎？」。
    const history = historyOf(['第一句', '第二句', '你確定嗎？可以給我來源嗎？']);
    expect(detectChallenge(history, 2)).toBe(true);
  });

  it('查證關鍵字出現在陷阱「之前」，不算數——只看注入之後的發言', () => {
    // 例：使用者在還沒被注入陷阱前就講過「查證」（跟這次陷阱無關），
    // 陷阱之後（索引 2 開始）反而完全沒再提，這不該被算作有質疑。
    const history = historyOf(['麻煩幫我查證一下這個資料庫欄位', '好的繼續', '謝謝']);
    expect(detectChallenge(history, 2)).toBe(false);
  });

  it('完全沒有查證語句 → 沒偵測到質疑', () => {
    const history = historyOf(['第一句', '好的謝謝', '沒問題']);
    expect(detectChallenge(history, 2)).toBe(false);
  });

  it.skip('已知缺口：非中文的質疑語句偵測不到（多語系支援前必須處理）', () => {
    // 例：日文使用者在陷阱之後（索引 1 開始）問「本当ですか？出典を教えてください」
    // （這是真的嗎？可以給我出處嗎？）——語意上明顯是在質疑，但關鍵字清單全部是中文字串，
    // 一個都比對不到。這個案例目前實際結果是 false，故意用 it.skip 記錄「應該要是 true」
    // 這件事，不讓它現在就讓整批測試變紅。
    const history = historyOf(['最初のメッセージ', '本当ですか？出典を教えてください']);
    expect(detectChallenge(history, 1)).toBe(true);
  });
});
