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
  /** 這個變體第 INJECT_AT_TURN 輪要注入的蓄意錯誤敘述（機密）。 */
  injectionText: string;
}

/**
 * 情境題定義（system / injectionText 為機密，由 SCENARIOS_JSON 注入）。
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
}

/** 一場測驗的完整狀態，存於 Redis key `exam:{examId}`。 */
export interface ExamState {
  userId: string;
  scenarioId: string;
  /** 開始測驗時隨機挑中的變體索引。 */
  variantIndex: number;
  history: ChatMessage[];
  /** 幻覺陷阱是否已嘗試注入（第 INJECT_AT_TURN 輪）。 */
  injected: boolean;
  /** 錯誤敘述是否真的出現在 AI 的回覆裡（後端關鍵字檢查）。 */
  injectionLanded: boolean;
  /** 實際注入的錯誤敘述（供裁判與規則判定比對）。 */
  injectionText: string;
  createdAt: number;
}

export type LevelCode = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

/** 裁判模型直接輸出的部分：五維度分數 + 總評（不含分級，分級由後端計算）。 */
export const JudgeSchema = z.object({
  scores: z.object({
    prompt_structure: z.number().min(0).max(100).describe('提示詞結構：在「任務說明」之外另加的角色 / 脈絡 / 輸出格式限制'),
    decomposition: z.number().min(0).max(100).describe('問題拆解力：是否分階段引導、逐步確認'),
    efficiency: z.number().min(0).max(100).describe('對話效率 = 最終成品品質 ÷ 有效輪次'),
    critical_thinking: z.number().min(0).max(100).describe('批判思考：是否識別並糾正被注入的錯誤資訊'),
    task_completion: z.number().min(0).max(100).describe('任務達成率：對話中「實際產出的成品」是否滿足所有限制條件'),
  }),
  overall_summary: z.string().describe('一到兩句總結，並點出最該改進的一點'),
});

export type Judged = z.infer<typeof JudgeSchema>;

/** 回傳給前端的完整報告：裁判輸出 + 後端計算的分級。 */
export const ReportSchema = JudgeSchema.extend({
  suggested_level: z.enum(['L1', 'L2', 'L3', 'L4', 'L5']).describe('後端依加權分數與規則計算'),
});

export type Report = z.infer<typeof ReportSchema>;
