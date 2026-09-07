/**
 * 檔案：src/lib/judge.ts
 * 角色：領域層 — 裁判評分核心（給 /api/evaluate 與信度測試腳本共用）
 * 功能：detectChallenge() 規則判定；rubricSystem() 評分準則；
 *       runJudge() 呼叫裁判模型輸出五維度分數 + 總評（JudgeSchema，不含分級）。
 */
import { generateObject } from 'ai';
import { openai } from '@/lib/openai';
import { JudgeSchema, type Judged, type ChatMessage } from '@/types/exam';
import { JUDGE_MODEL } from '@/config/constants';

/** 陷阱注入後，使用者是否對錯誤資訊表達質疑 / 要求查證。 */
export function detectChallenge(
  history: ChatMessage[],
  injectAtUserTurn: number,
): boolean {
  const afterInjection = history
    .filter((m) => m.role === 'user')
    .slice(injectAtUserTurn);
  const cues = [
    '確定嗎', '確定', '來源', '出處', '查證', '不正確', '有誤', '錯',
    '法條', '依據', '真的嗎', '存疑', '求證', '引用', '根據哪', '正確嗎',
    '對嗎', '是否正確', '查一下', '再確認',
  ];
  return afterInjection.some((m) => cues.some((c) => m.content.includes(c)));
}

export function rubricSystem(): string {
  return [
    '你是嚴格、客觀的企業「AI 應用與提示詞工程」測評專家。針對五個維度各給 0–100 分。',
    '不要因為語氣客氣、字數多、或「看起來應該可行」就給高分。只根據對話裡實際發生的事評分。',
    '',
    '== 關於植入的陷阱（最重要）==',
    '對話中 AI 在第 2 則回覆講的某項資訊，是系統「刻意植入」的錯誤陷阱，不是受測者造成的。',
    '- 評分與總評「都不得」把這個植入錯誤當成受測者的失誤或扣分理由。',
    '  絕對不要寫「初始回應數據錯誤」「一開始算錯」這類把陷阱歸咎於受測者的句子。',
    '- 對這個陷阱，你唯一要評估的是：受測者有沒有發現、有沒有要求更正（見下方「規則判定」）。',
    '- 若受測者有質疑並促成更正 → 這是「加分項」：critical_thinking 依糾正品質給 60–100，',
    '  且 did_well 必須明確列出這一點（例：「主動要求 AI 複核，抓出加總 720→755 的錯誤」）。',
    '- 若受測者完全沒發現、照單全收 → critical_thinking ≤ 40，to_improve 要點出「未驗證 AI 給的關鍵數字/事實」。',
    '',
    '== 核心原則 ==',
    '1. 受測者看得到「任務說明」（下方會附上）。如果他的提示詞主要是把任務說明整段複製或輕微改寫，',
    '   那不算提示能力：prompt_structure 與 decomposition 一律 ≤ 30。分數只來自他「額外」提供的',
    '   角色設定、背景脈絡、分步引導、明確格式/長度要求。',
    '2. task_completion 只看對話中「實際產出的成品」。若助手訊息裡沒有一份完整、逐條符合限制條件的',
    '   成品，task_completion ≤ 20。禁止用「應該可以完成」來給分。',
    '3. efficiency = 最終成品品質 ÷ 有效輪次。一次把需求全部丟出、過程完全沒有追問或修正，',
    '   即使結果堪用，efficiency ≤ 55。空轉、重複、離題再往下扣。',
    '',
    '== Rubric（0–100）==',
    'prompt_structure：在任務說明之外，另有明確角色 + 完整脈絡 + 清楚輸出格式/長度限制 → 90+；',
    '  只補其中一項 → 約 50；只是複製任務說明或一句籠統要求 → ≤ 30。',
    'decomposition：主動把任務拆成可驗證的小步驟並逐步確認 → ≥ 80；一次丟出全部且無任何追問 → ≤ 40。',
    'efficiency：見上。',
    'critical_thinking：見下方「注入結果」欄位，依指示給分。',
    'task_completion：見上；相對於任務說明的每一項限制條件，缺一項 −20。',
    '',
    '== 錨點 ==',
    '低分 prompt_structure（≈15）：使用者訊息幾乎就是任務說明原文。',
    '高分 prompt_structure（≈90）：使用者另外指定「你是資深客服主管、語氣同理不卸責、200 字內、',
    '  三段式結構、結尾附補償方案」等任務說明沒寫的細節。',
    '',
    '== 輸出 ==',
    'overall_summary：一句話，聚焦受測者「自己做了什麼」——提示詞品質、拆解方式、追問與修正過程、',
    '  有沒有抓到植入的錯誤。禁止把植入陷阱寫成他的失誤。',
    'did_well：受測者實際做得好的 1–3 點，具體。抓到植入錯誤時必列。真的沒有就回空陣列。',
    'to_improve：最該改進的 1–3 點，要具體、可操作（不要只說「多加強」；要說「怎麼做」）。',
  ].join('\n');
}

export interface JudgeInput {
  /** 受測者看得到的任務說明原文。 */
  brief: string;
  history: ChatMessage[];
  /** 是否已嘗試注入陷阱。 */
  injected: boolean;
  /** 錯誤敘述是否確實出現在 AI 回覆裡。 */
  trapEffective: boolean;
  /** 實際注入的錯誤敘述（trapEffective 時才有意義）。 */
  injectionText: string;
  /** 規則判定：使用者是否質疑該錯誤。 */
  challenged: boolean;
}

function criticalThinkingRule(i: JudgeInput): string {
  if (!i.injected) {
    return '本場尚未觸發批判測試：critical_thinking 給 50，並在總評註明「未觸發批判測試」。';
  }
  if (!i.trapEffective) {
    return '陷阱已嘗試注入，但錯誤敘述沒有清楚出現在 AI 回覆裡：critical_thinking 給 50，總評註明「批判測試未生效」。';
  }
  return i.challenged
    ? '陷阱已生效，且系統判定使用者有質疑/要求查證：依糾正的清楚與正確程度給 60–100。'
    : '陷阱已生效，但使用者未質疑也未糾正：critical_thinking ≤ 40。';
}

export async function runJudge(input: JudgeInput): Promise<Judged> {
  const { object } = await generateObject({
    model: openai(JUDGE_MODEL),
    schema: JudgeSchema,
    system: rubricSystem(),
    prompt: [
      '【任務說明（受測者看得到的原文）】',
      input.brief,
      '',
      `【注入結果】已嘗試注入：${input.injected ? '是' : '否'}；錯誤敘述實際出現在 AI 回覆：${input.trapEffective ? '是' : '否'}`,
      input.trapEffective ? `被注入的錯誤敘述：「${input.injectionText}」` : '',
      `【規則判定】注入後使用者是否質疑/要求查證：${input.challenged ? '有' : '無'}`,
      `→ critical_thinking 給分規則：${criticalThinkingRule(input)}`,
      '',
      '【對話歷程】',
      JSON.stringify(input.history, null, 2),
    ]
      .filter(Boolean)
      .join('\n'),
  });
  return object;
}
