/**
 * 檔案：src/types/exam.ts
 * 角色：型別層 — 測驗領域模型的中央定義
 * 功能：ChatMessage / Scenario / ExamState 介面，以及裁判輸出的 Zod ReportSchema
 *       （五維度分數 + 總評 + L1–L5 分級）。API、Redis、前端都從這裡取型別。
 */
import { z } from 'zod';

/** 對話歷程只存 user / assistant；system 指令由 scenario 另外傳入模型。 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** 情境題的一個隨機變體。 */
export interface ScenarioVariant {
  /** 選填：覆寫該場的任務說明（用來變動限制條件）。 */
  brief?: string;
  /** 這個變體要注入的蓄意錯誤敘述（機密）；注入輪次每場隨機，見 rollInjectAtTurn()。 */
  injectionText: string;
  /** 選填：對 injectionText 的正解，報告畫面用來做「錯誤 vs 正確」對照。 */
  correction?: string;
}

/**
 * 情境題定義（system / injectionText 為機密，存 Supabase scenarios 表）。
 * 舊格式 `{ brief, system, injectionText }` 由載入器自動轉為單一 variant。
 */
export interface Scenario {
  /** 給受測者看的任務說明與限制條件（變體可覆寫）。 */
  brief: string;
  /** 沙盒模型的 system 指令（機密）。 */
  system: string;
  /** 至少一個變體；開始測驗時隨機挑一個。 */
  variants: ScenarioVariant[];
}

/** 一場測驗實際採用的情境題 + 變體，攤平後的樣子。 */
export interface ResolvedScenario {
  scenarioId: string;
  variantIndex: number;
  brief: string;
  system: string;
  injectionText: string;
  /** 正解說明；沒填就是空字串。 */
  correction: string;
}

/** 提交評分後，回給前端揭露的陷阱資訊（僅在陷阱生效時有值）。 */
export interface TrapReveal {
  injectionText: string;
  correction: string | null;
  /** 受測者是否有質疑 / 要求查證。 */
  challenged: boolean;
}

/** 一場測驗的完整狀態，存於 Redis key `exam:{examId}`。 */
export interface ExamState {
  userId: string;
  scenarioId: string;
  /** 開始測驗時隨機挑中的變體索引。 */
  variantIndex: number;
  history: ChatMessage[];
  /** 這場擲中的注入輪次；0 = 整場不注入。開場時 rollInjectAtTurn() 決定。 */
  injectAtTurn: number;
  /** 幻覺陷阱是否已嘗試注入（走到 injectAtTurn 那一輪才會變 true）。 */
  injected: boolean;
  /** 錯誤敘述是否真的出現在 AI 的回覆裡（後端關鍵字檢查）。 */
  injectionLanded: boolean;
  /** 實際注入的錯誤敘述（供裁判與規則判定比對）。 */
  injectionText: string;
  createdAt: number;
}

export type LevelCode = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

/** 裁判模型直接輸出的部分：五維度分數 + 總評 + 條列回饋（不含分級，分級由後端計算）。 */
export const JudgeSchema = z.object({
  scores: z.object({
    prompt_structure: z.number().min(0).max(100).describe('提示詞結構：在「任務說明」之外另加的角色 / 脈絡 / 輸出格式限制'),
    decomposition: z.number().min(0).max(100).describe('問題拆解力：是否分階段引導、逐步確認'),
    efficiency: z.number().min(0).max(100).describe('對話效率 = 最終成品品質 ÷ 有效輪次'),
    critical_thinking: z.number().min(0).max(100).describe('批判思考：是否識別並糾正被注入的錯誤資訊'),
    task_completion: z.number().min(0).max(100).describe('任務達成率：對話中「實際產出的成品」是否滿足所有限制條件'),
  }),
  overall_summary: z.string().describe('一句話總評，聚焦受測者自己的表現，不得把系統植入的陷阱算成他的失誤'),
  user_challenged: z
    .boolean()
    .describe(
      '受測者是否對被注入的錯誤資訊表達懷疑 / 要求查證 / 自己驗算（不論 AI 後來有沒有改對）',
    ),
  did_well: z
    .array(z.string())
    .max(3)
    .describe('受測者實際做得好的 1–3 點（具體）。若有抓到植入的錯誤，必須列出。沒有就給空陣列'),
  to_improve: z
    .array(z.string())
    .max(3)
    .describe('最該改進的 1–3 點，要具體、可操作，例：「開場就指定字數與段落結構，不要只說『幫我整理』」'),
});

export type Judged = z.infer<typeof JudgeSchema>;

/** 回傳給前端的完整報告：裁判輸出 + 後端計算的分級。 */
export const ReportSchema = JudgeSchema.extend({
  suggested_level: z.enum(['L1', 'L2', 'L3', 'L4', 'L5']).describe('後端依加權分數與規則計算'),
});

export type Report = z.infer<typeof ReportSchema>;
