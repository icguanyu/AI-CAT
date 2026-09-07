/**
 * 檔案：src/lib/judge.ts
 * 角色：領域層 — 裁判評分核心（給 /api/evaluate 與信度測試腳本共用）
 * 功能：detectChallenge() 規則判定；rubricSystem() 評分準則；
 *       runJudge() 輸出五維度分數 + 總評（JudgeSchema，不含分級）；
 *       runExemplar() 產一段「L5 高手會怎麼用 AI 完成這題」的示範（Markdown）。
 */
import { generateObject, generateText } from 'ai';
import { openai } from '@/lib/openai';
import { JudgeSchema, type Judged, type ChatMessage } from '@/types/exam';
import { JUDGE_MODEL } from '@/config/constants';

const EXEMPLAR_MODEL = process.env.EXEMPLAR_MODEL || JUDGE_MODEL;

/**
 * 陷阱注入後，使用者是否對錯誤資訊表達質疑 / 要求查證 / 自己驗算。
 * 只是「提示」——關鍵字清單一定會有漏（例如「驗算」曾漏），
 * 最終以裁判輸出的 user_challenged 為準（見 runJudge）。
 */
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
    '驗算', '算一下', '重算', '再算', '核對', '核算', '加總', '算錯',
    '這樣對嗎', '幫我確認', '一步一步', '列出算式', '你算',
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
    'AI 之後即使被質疑也可能「堅持原答案、繼續算錯」——那是模型的問題，同樣不算在受測者頭上。',
    '- 評分與總評「都不得」把這個植入錯誤、或 AI 事後不肯改，當成受測者的失誤或扣分理由。',
    '  絕對不要寫「初始回應數據錯誤」「一開始算錯」這類句子。',
    '- critical_thinking 看的是「受測者面對這則錯誤時，主動求證的程度」，',
    '  **不是** AI 最後有沒有改對。分級：',
    '  · 完全沒察覺、直接採用 → ≤ 30',
    '  · 只丟一句「你確定嗎 / 幫我查一下」，AI 重申錯誤後就接受 → 40–55',
    '  · 要求 AI 一步一步列算式 / 換方式重算，或自己算一次、自己講出正確值、',
    '    在 AI 仍錯時明確指出 → 70–100',
    '- 有任何求證行為時，did_well 必須列出（例：「要求 AI 逐步列出加總算式來驗證」）。',
    '  完全沒有時，to_improve 要點出「未驗證 AI 給的關鍵數字/事實」，並提醒「光叫 AI 自己檢查通常沒用，要獨立驗算」。',
    '- 另外輸出 user_challenged：對話裡受測者是否有對這則錯誤表達懷疑 / 要求查證 / 自己驗算（不論 AI 後來有沒有改對）。',
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
  /** 關鍵字規則的初判（僅提示，最終看裁判的 user_challenged）。 */
  ruleChallenged: boolean;
}

function criticalThinkingRule(i: JudgeInput): string {
  if (!i.injected) {
    return '本場尚未觸發批判測試：critical_thinking 給 50，並在總評註明「未觸發批判測試」。';
  }
  if (!i.trapEffective) {
    return '陷阱已嘗試注入，但錯誤敘述沒有清楚出現在 AI 回覆裡：critical_thinking 給 50，總評註明「批判測試未生效」。';
  }
  return (
    '陷阱已生效。依「受測者主動求證的程度」給分（見上方分級），並輸出 user_challenged。' +
    `關鍵字規則初判：${i.ruleChallenged ? '有求證跡象' : '未偵測到（可能漏字，請以對話實況為準）'}。`
  );
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

export interface ExemplarInput {
  brief: string;
  trapEffective: boolean;
  injectionText: string;
  correction: string;
}

/**
 * 產一段「L5 高手會怎麼用 AI 完成這題」的教學示範（Markdown）。
 * 不評論任何受測者，只講「應該怎麼做」，並點出這題的陷阱在哪、正確版本為何。
 */
export async function runExemplar(input: ExemplarInput): Promise<string> {
  const { text } = await generateText({
    model: openai(EXEMPLAR_MODEL),
    system: [
      '你是一位「AI 協作教練」。針對下面這個任務，示範「一個高手（能力分級 L5）會怎麼用 AI 完成」，',
      '讓看的人學得到方法。用繁體中文、Markdown。**不要評論任何受測者**，只講「應該怎麼做」。',
      '結構固定為三段（用 `##` 標題）：',
      '',
      '## 理想的開場提示詞',
      '給一段可以直接複製使用的提示詞範例，放在 ```` ``` ```` 圍起的 code block 裡。',
      '要展示任務說明「沒寫、但高手會自己補上」的東西：角色設定、背景脈絡、輸出格式與字數、驗收標準。',
      '',
      '## 協作方式',
      '3–5 個要點：怎麼把任務拆成可驗證的小步、怎麼要求 AI 自我檢查關鍵數字/事實、怎麼逐步收斂到成品。',
      '',
      input.trapEffective
        ? '## 這題的陷阱\n對話中 AI 會講一項聽起來合理但錯誤的資訊。說明高手會怎麼察覺（例如自己心算/列式驗一次），' +
          '並提醒：光叫 AI「自己檢查」通常沒用，它會堅持原答案——要嘛請它逐步列出算式一步步核對、要嘛自己算完直接告訴它正確值。最後寫出正確版本。'
        : '## 最容易踩的坑\n這類任務最容易被 AI 誤導、或自己忽略的一點，以及怎麼防。',
      '',
      '整體精簡，約 250–400 字（code block 不計）。',
    ].join('\n'),
    prompt: [
      '【任務說明】',
      input.brief,
      input.trapEffective
        ? `\n【對話中 AI 會講的錯誤資訊】：「${input.injectionText}」` +
          `\n【正確版本】：${input.correction || '（未提供，請自行說明為何前者有誤、正確應為何）'}`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
  });
  return text.trim();
}
