/**
 * 檔案：src/lib/admin-data.test.ts
 * 測「/api/evaluate 寫進 report jsonb 的形狀」跟「admin-data.ts 讀出來的形狀」對不對得起來。
 *
 * 白話說明：這份測試存在的理由，直接來自這次真的發生過的一個 bug——
 * self-consistency 上線時，/api/evaluate 把欄位從舊的 judge_raw 改成 judge_votes／
 * judge_consistency，但 admin-data.ts 的讀取端還在找舊欄位名，導致後台「裁判原始輸出」
 * 那塊從那次改動起一直悄悄變成 null——沒有任何型別錯誤或執行期錯誤會提醒你，因為讀一個
 * TypeScript optional 欄位、讀不到就是 undefined，這不算「錯誤」，只是「悄悄拿不到資料」。
 *
 * 做法：用 vi.mock 頂替掉真正的 Supabase 客戶端（不用連真的資料庫、不用真的登入），
 * 假裝資料庫回傳一筆「跟 /api/evaluate 現在實際寫入的形狀一模一樣」的 report jsonb，
 * 餵給 getAdminExamDetail()，斷言每個看得到的欄位都真的讀出來了、不是意外變成 null。
 * 以後只要「寫入端」的欄位改名、「讀取端」沒跟著改，這裡會直接紅燈，不用等人手動翻程式碼才發現。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Judged } from '@/types/exam';

let fakeExamRow: Record<string, unknown>;
let fakeProfileRow: Record<string, unknown> | null;

// 只需要處理這個測試會用到的兩張表、兩種查詢形狀（單筆 maybeSingle／列表 await）。
// 遇到沒預期的表就直接丟錯，逼自己發現「原來還查了別的表」而不是靜靜回傳空資料。
vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'exam_reports') {
        const chain = {
          select: () => chain,
          eq: () => chain,
          neq: () => chain,
          order: () => chain,
          limit: () => chain,
          // getAdminExamDetail() 查這場本身用的是 .maybeSingle()
          maybeSingle: () => Promise.resolve({ data: fakeExamRow, error: null }),
          // getUserOpeningMessageOverlap() 查「其他場次」用的是直接 await 整條 chain，
          // 這裡固定回空陣列——那個功能不是這份測試要驗證的東西。
          then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
            Promise.resolve({ data: [], error: null }).then(resolve),
        };
        return chain;
      }
      if (table === 'profiles') {
        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: () => Promise.resolve({ data: fakeProfileRow, error: null }),
        };
        return chain;
      }
      throw new Error(`測試沒預期會查這張表：${table}`);
    },
  }),
}));

// getAdminExamDetail() 會拿 scenario_id/variant_index 回頭查題庫還原「題目內容」；
// 這裡假裝題庫回一個固定內容，不用真的連 Supabase 或讀 scenarios.local.json。
vi.mock('@/lib/scenarios', () => ({
  getScenarioVariant: async () => ({
    scenarioId: 'test_scenario',
    category: 'it_software',
    titleZh: '測試情境',
    variantIndex: 0,
    brief: '這是測試用的任務內容',
    system: '',
    noTrap: false,
    injectionText: '',
    correction: '',
    verifyHint: '',
    trapType: null,
    verifyDifficulty: null,
  }),
}));

const { getAdminExamDetail } = await import('./admin-data');

function judgedFixture(): Judged {
  return {
    scores: {
      prompt_structure: 70,
      decomposition: 70,
      efficiency: 70,
      critical_thinking: 70,
      task_completion: 70,
    },
    overall_summary: '測試總評',
    user_challenged: false,
    did_well: ['做得好的地方'],
    to_improve: ['可以更好的地方'],
  };
}

describe('getAdminExamDetail — 讀出來的形狀要跟 /api/evaluate 現在寫入的形狀對得上', () => {
  beforeEach(() => {
    const judged = judgedFixture();
    // 下面這個 report 物件刻意照抄 src/app/api/evaluate/route.ts 現在真正寫進 DB 的
    // 欄位名稱跟結構，不是憑印象亂編——欄位名稱對不上，就是這份測試要抓的那種 bug。
    fakeExamRow = {
      exam_id: 'exam-1',
      created_at: '2026-09-11T00:00:00Z',
      user_id: 'user-1',
      scenario_id: 'test_scenario',
      shared: false,
      excluded_from_training: false,
      transcript: [{ role: 'user', content: '你好' }],
      report: {
        ...judged,
        suggested_level: 'L3',
        weighted_average: 70,
        variant_index: 0,
        exemplar: '示範內容',
        user_name: '測試使用者',
        category: 'it_software',
        titleZh: '測試情境',
        familiarity: 'mid',
        trap: null,
        noTrap: false,
        trapType: null,
        verifyDifficulty: null,
        injectAtTurn: 0,
        engagement: {
          elapsedSec: 60,
          userTurns: 1,
          userCharsTotal: 2,
          reachedInjection: null,
          firstTurnPasted: false,
          pastedTurnCount: 0,
        },
        judge_votes: [judged],
        judge_consistency: { runs: 1, scoreSd: {}, flaggedDimensions: [] },
        token_usage: {
          chat: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          judge: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          exemplar: { promptTokens: 20, completionTokens: 30, totalTokens: 50 },
          total: { promptTokens: 130, completionTokens: 90, totalTokens: 220 },
        },
        judge_version: 'gpt-5·r4',
      },
    };
    fakeProfileRow = {
      email: 'user@example.com',
      age_band: '25_34',
      education: 'college',
      gender: 'other',
    };
  });

  it('每一個由 /api/evaluate 寫入的欄位，都能在回傳結果裡讀到（不是意外的 null）', async () => {
    const detail = await getAdminExamDetail('exam-1');
    expect(detail).not.toBeNull();

    // 這三個是「像 judge_raw 那樣」曾經真的斷過的欄位——self-consistency 的原始投票、
    // 一致性摘要、跟這次剛加的 token 用量。斷言它們不是 null，就是在防
    // 「改了寫入端欄位名，忘記同步改讀取端」這件事再發生一次。
    expect(detail!.judgeVotes).not.toBeNull();
    expect(detail!.judgeVotes).toHaveLength(1);
    expect(detail!.judgeConsistency).not.toBeNull();
    expect(detail!.judgeConsistency!.runs).toBe(1);
    expect(detail!.tokenUsage).not.toBeNull();
    expect(detail!.tokenUsage!.total.totalTokens).toBe(220);

    // 其餘欄位一起確認，涵蓋面完整一點。
    expect(detail!.titleZh).toBe('測試情境');
    expect(detail!.category).toBe('it_software');
    expect(detail!.familiarity).toBe('mid');
    expect(detail!.judgeVersion).toBe('gpt-5·r4');
    expect(detail!.exemplar).toBe('示範內容');
    expect(detail!.weightedAverage).toBe(70);
    expect(detail!.engagement).not.toBeNull();
    expect(detail!.engagement!.firstTurnPasted).toBe(false);
    expect(detail!.email).toBe('user@example.com');
    expect(detail!.ageBand).toBe('25_34');
    // 題目內容是回頭查題庫還原的（來自上面 mock 過的 getScenarioVariant）。
    expect(detail!.brief).toBe('這是測試用的任務內容');
  });
});
