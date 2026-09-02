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

/** 情境題定義（system / injectionText 為機密，由 SCENARIOS_JSON 注入）。 */
export interface Scenario {
  /** 給受測者看的任務說明與限制條件。 */
  brief: string;
  /** 沙盒模型的 system 指令（機密）。 */
  system: string;
  /** 第 INJECT_AT_TURN 輪注入的蓄意錯誤敘述（機密）。 */
  injectionText: string;
}

/** 一場測驗的完整狀態，存於 Redis key `exam:{examId}`。 */
export interface ExamState {
  userId: string;
  scenarioId: string;
  history: ChatMessage[];
  /** 幻覺陷阱是否已注入。 */
  injected: boolean;
  /** 實際注入的錯誤敘述（供裁判與規則判定比對）。 */
  injectionText: string;
  createdAt: number;
}

/** 裁判輸出的結構化評分報告。五維度對應前端雷達圖五軸。 */
export const ReportSchema = z.object({
  scores: z.object({
    prompt_structure: z.number().min(0).max(100).describe('提示詞結構：角色 / 脈絡 / 輸出格式限制是否齊備'),
    decomposition: z.number().min(0).max(100).describe('問題拆解力：是否分階段引導複雜任務'),
    efficiency: z.number().min(0).max(100).describe('對話效率 = 產出品質 / 有效輪次；空轉、重複發問扣分'),
    critical_thinking: z.number().min(0).max(100).describe('批判思考：是否識別並糾正被注入的錯誤資訊'),
    task_completion: z.number().min(0).max(100).describe('任務達成率：最終產出是否滿足所有限制條件'),
  }),
  overall_summary: z.string().describe('一到兩句總結該受測者的 AI 協作能力'),
  suggested_level: z.enum(['L1', 'L2', 'L3', 'L4', 'L5']).describe('綜合能力分級'),
});

export type Report = z.infer<typeof ReportSchema>;
