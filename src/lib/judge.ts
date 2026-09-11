/**
 * 檔案：src/lib/judge.ts
 * 角色：領域層 — 裁判評分核心（給 /api/evaluate 與信度測試腳本共用）
 * 功能：detectChallenge() 規則判定；rubricSystem() 評分準則；
 *       runJudge() 單次呼叫，輸出五維度分數 + 總評（JudgeSchema，不含分級）——
 *       信度測試腳本直接呼叫這個，量單次跑分的原始變異；
 *       runJudgeConsistent() self-consistency 包裝：並行跑 N 次取中位數，/api/evaluate 用這個；
 *       runExemplar() 產一段「L5 高手會怎麼用 AI 完成這題」的示範（Markdown）。
 */
import { generateObject, generateText } from 'ai';
import { resolveModel } from '@/lib/model';
import {
  JudgeSchema,
  FAMILIARITY_LABEL,
  TRAP_TYPE_LABEL,
  TRAP_TYPE_VERIFY_MOVE,
  VERIFY_DIFFICULTY_LABEL,
  type Judged,
  type ChatMessage,
  type Familiarity,
  type TrapType,
  type VerifyDifficulty,
  type JudgeConsistency,
} from '@/types/exam';
import {
  JUDGE_MODEL,
  JUDGE_REASONING_EFFORT,
  JUDGE_CONSISTENCY_RUNS,
  OPENAI_MAX_RETRIES,
} from '@/config/constants';
import { weightedAverage } from '@/lib/scoring';
import { getSetting } from '@/lib/app-settings';

const EXEMPLAR_MODEL = process.env.EXEMPLAR_MODEL || JUDGE_MODEL;

/**
 * 評分準則版本標記。改動 rubricSystem() / criticalThinkingRule() / difficultyRule()
 * 這類會影響裁判打分的文字時，往上 bump（r3 → r4 …）。
 * r1 原始；r2 接上 trapType / verifyDifficulty；r3 task_completion 植入值視為對的 + noTrap 過度懷疑扣分；
 * r4 decomposition 跟「開場訊息是否複製 brief」解耦，只看整段對話有沒有分階段。
 */
export const RUBRIC_VERSION = 'r4';

/** 存進每份報告，之後稽核 / 訓練時能區分「哪個版本的裁判產出這個分數」。 */
export const JUDGE_VERSION = `${JUDGE_MODEL}·${RUBRIC_VERSION}`;

/**
 * OpenAI 推理模型（gpt-5* / o1 / o3 / o4 …）才吃 reasoningEffort；
 * gpt-4.1 / gpt-4o 傳了會報錯，Claude 走另一個 provider。因此只在符合時才回。
 */
function reasoningOptions(modelId: string) {
  const isOpenAiReasoning =
    !modelId.startsWith('claude') && /^(gpt-5|o[134])/.test(modelId);
  return isOpenAiReasoning
    ? { providerOptions: { openai: { reasoningEffort: JUDGE_REASONING_EFFORT } } }
    : {};
}

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
    '對話中 AI 在某一則回覆講的某項資訊，是系統「刻意植入」的錯誤陷阱，不是受測者造成的。',
    'AI 之後即使被質疑也可能「堅持原答案、繼續算錯」——那是模型的問題，同樣不算在受測者頭上。',
    '- 評分與總評「都不得」把這個植入錯誤、或 AI 事後不肯改，當成受測者的失誤或扣分理由。',
    '  絕對不要寫「初始回應數據錯誤」「一開始算錯」這類句子。',
    '- task_completion：若受測者最終成品裡帶著這個植入的錯誤數字／說法，評 task_completion 時',
    '  要「當作那個植入值是對的」，只檢查格式、結構、必含項目、字數是否齊全——不因植入錯誤本身扣 task_completion。',
    '  （「有沒有識破這個錯」是 critical_thinking 的事，不要在 task_completion 重複懲罰。）',
    '- critical_thinking 看的是「受測者面對這則錯誤時，主動求證的程度」，',
    '  **不是** AI 最後有沒有改對。分級：',
    '  · 完全沒察覺、直接採用 → ≤ 30',
    '  · 只丟一句「你確定嗎 / 幫我查一下」，AI 重申錯誤後就接受 → 40–55',
    '  · 要求 AI 一步一步列算式 / 換方式重算，或自己算一次、自己講出正確值、',
    '    在 AI 仍錯時明確指出 → 70–100',
    '- 公平性：critical_thinking 評的是「求證意願與行為」，不是「受測者有沒有背景知識或工具去查」。',
    '  下方「注入結果」會附「一般人可如何察覺」。若這個錯誤本來就能用那種方式輕易看出來，沒察覺才算批判力弱；',
    '  若察覺需要專業知識或高成本查證，不因此把 critical_thinking 壓到 ≤ 30，改在 to_improve 溫和提醒即可。',
    '- 有任何求證行為時，did_well 必須具體寫出他做了什麼（要求逐步重算、自己驗算後講出正確值、換方法核對……），照這場對話的實況描述。',
    '  完全沒有時，to_improve 要點出「未驗證 AI 給的關鍵數字/事實」，並提醒「光叫 AI 自己檢查通常沒用，要獨立驗算」。',
    '- 另外輸出 user_challenged：對話裡受測者是否有對這則錯誤表達懷疑 / 要求查證 / 自己驗算（不論 AI 後來有沒有改對）。',
    '',
    '== 核心原則 ==',
    '1. 受測者看得到「任務說明」（下方會附上）。如果他的提示詞主要是把任務說明整段複製或輕微改寫，',
    '   那不算「提示詞結構」能力：prompt_structure ≤ 30。分數只來自他在任務說明「之外」另外提供的',
    '   角色設定、背景脈絡、分步引導、明確格式/長度要求——這一項測的是「有沒有多加東西」，',
    '   不是「有沒有把任務講清楚」；brief 本身限制條件已經很完整時，這題對所有人的上限本來就低，不是針對這個人。',
    '   **decomposition 不要因為開場訊息是複製 brief 就連坐扣分**——decomposition 只看「整段對話」',
    '   有沒有分階段、先確認再動手，跟第一則訊息的措辭無關。貼原文但接著要求「先給大綱、我確認過',
    '   沒漏限制再細寫」＝有拆解；重新打字敘述任務但一次全丟、從沒追問＝沒拆解。兩者互相獨立判。',
    '2. task_completion 評的是「整段對話裡最完整的一版成品」——它可能在中間某一則助手回覆，',
    '   也可能要把幾則拼起來。**不要只看最後一則**。若某一輪使用者只是請 AI 複核 / 驗證某件事，',
    '   那一輪不代表「成品變差」，請仍以先前最完整的版本評分。',
    '   只有整段對話從沒出現一份完整、逐條符合限制條件的成品時，task_completion 才 ≤ 20。',
    '   禁止用「應該可以完成」來給分。',
    '3. efficiency = 最完整那版成品的品質 ÷ 有效輪次。一次把需求全部丟出、過程完全沒有追問或修正，',
    '   即使結果堪用，efficiency ≤ 55。空轉、重複、離題往下扣；',
    '   但「為了驗證關鍵數字 / 事實而多花的 1 輪」算好習慣，不是空轉，不要因此扣分。',
    '',
    '== Rubric（0–100）==',
    'prompt_structure：在任務說明之外，另有明確角色 + 完整脈絡 + 清楚輸出格式/長度限制 → 90+；',
    '  只補其中一項 → 約 50；只是複製任務說明或一句籠統要求 → ≤ 30。',
    'decomposition：主動把任務拆成可驗證的小步驟並逐步確認 → ≥ 80；一次丟出全部且無任何追問 → ≤ 40。',
    '  只看對話「有沒有分階段」，跟開場訊息是不是複製 brief 無關（見上方核心原則 1）。',
    'efficiency：見上。',
    'critical_thinking：見下方「注入結果」欄位，依指示給分。',
    'task_completion：以「對話中最完整的一版成品」對照任務說明的每一項限制條件，缺一項 −20；',
    '  不要因為最後一輪是驗證/複核就當成品不完整。',
    '',
    '== 錨點 ==',
    '低分 prompt_structure（≈15）：使用者訊息幾乎就是任務說明原文。',
    '高分 prompt_structure（≈90）：使用者另外指定「你是資深客服主管、語氣同理不卸責、200 字內、',
    '  三段式結構、結尾附補償方案」等任務說明沒寫的細節。',
    '',
    '== 輸出 ==',
    'overall_summary：一句話，聚焦受測者「自己做了什麼」——提示詞品質、拆解方式、追問與修正過程、',
    '  有沒有抓到植入的錯誤。禁止把植入陷阱寫成他的失誤。',
    'did_well：受測者實際做得好的 1–3 點，具體。抓到植入錯誤、或最後主動做驗證/複核時必列。真的沒有就回空陣列。',
    'to_improve：最該改進的 1–3 點，要具體、可操作（不要只說「多加強」；要說「怎麼做」）。',
    'did_well / to_improve 的每一點都必須引用這場對話裡實際出現的片段或行為；'
      + '禁止輸出換個人也成立的通用樣板句，也不要照抄本提示詞裡的任何示例字句。',
  ].join('\n');
}

export interface JudgeInput {
  /** 受測者看得到的任務說明原文。 */
  brief: string;
  history: ChatMessage[];
  /** 這題本身就沒有陷阱（no-trap 題）；true 時 injected 一定 false。 */
  noTrap?: boolean;
  /** 是否已嘗試注入陷阱。 */
  injected: boolean;
  /** 錯誤敘述是否確實出現在 AI 回覆裡。 */
  trapEffective: boolean;
  /** 實際注入的錯誤敘述（trapEffective 時才有意義）。 */
  injectionText: string;
  /** 一般人不需背景知識即可察覺此錯誤的方式；用來校準 critical_thinking 的公平性。 */
  verifyHint: string;
  /** 選填：陷阱型別；讓裁判知道「該留意哪種錯誤、怎樣的查證才算數」。 */
  trapType?: TrapType | null;
  /** 選填：這個錯誤的察覺難度；決定「沒察覺」能把 critical_thinking 壓多低。 */
  verifyDifficulty?: VerifyDifficulty | null;
  /** 受測者開場自評的領域熟悉度；用來校準 task_completion。 */
  familiarity: Familiarity;
  /** 關鍵字規則的初判（僅提示，最終看裁判的 user_challenged）。 */
  ruleChallenged: boolean;
}

/** 依受測者自評的領域熟悉度，給裁判 task_completion 的校準指示。 */
function familiarityRule(f: Familiarity): string {
  const label = FAMILIARITY_LABEL[f];
  if (f === 'low') {
    return (
      `受測者自評對這個領域「${label}」。task_completion 只依 brief 白紙黑字的限制條件評分，` +
      '不要因為他不懂 brief 沒要求的領域細節而扣分；他若靠追問 AI、要求出處、逐項對照限制把成品做出來，那正是能力的展現。' +
      'overall_summary 可提一句「在不熟悉的領域下完成/未完成」。其餘四維照常。'
    );
  }
  if (f === 'high') {
    return (
      `受測者自評對這個領域「${label}」。task_completion 可用較高標準——` +
      '內行人應該產出真正到位、經得起同行檢視的成品，不只是符合 brief 字面。其餘四維照常。'
    );
  }
  return `受測者自評對這個領域「${label}」。task_completion 依一般標準評分。`;
}

/**
 * 察覺難度 → critical_thinking 的公平性刻度。
 * 沒標 verifyDifficulty 時：有 verifyHint 視為 easy（舊資料相容），否則走「未標註」。
 */
function difficultyRule(i: JudgeInput): string {
  const diff: VerifyDifficulty | null = i.verifyDifficulty
    ? i.verifyDifficulty
    : i.verifyHint
      ? 'easy'
      : null;
  if (diff === 'easy') {
    return `察覺難度 easy（${VERIFY_DIFFICULTY_LABEL.easy}）：完全沒察覺可依分級給到 ≤ 30。`;
  }
  if (diff === 'medium') {
    return `察覺難度 medium（${VERIFY_DIFFICULTY_LABEL.medium}）：完全沒察覺給 35–55、不要壓到 ≤ 30，並在 to_improve 提示可以怎麼查。`;
  }
  if (diff === 'hard') {
    return `察覺難度 hard（${VERIFY_DIFFICULTY_LABEL.hard}）：沒察覺「不」因此把 critical_thinking 壓低（約 50 上下），只在 to_improve 溫和提醒。`;
  }
  return '察覺難度未標註：若這錯誤本來就好查，沒察覺才算批判力弱；若需專業知識或高成本查證，不要壓到 ≤ 30。';
}

function criticalThinkingRule(i: JudgeInput): string {
  if (i.noTrap) {
    return [
      '本場「沒有」埋任何錯誤資訊——AI 的回覆經檢視大致正確、風險低。user_challenged 一律輸出 false。',
      'critical_thinking 評的是「校準過的信任」，不是「有沒有質疑」：',
      '· 對關鍵數字／事實在採用前做一次合理的輕度查核（問一次依據、自己核一下、逐項對照限制條件），其餘正常採用 → 75–90',
      '· 完全沒有任何檢查動作、全盤照收 → 50–65',
      '· 【過度懷疑訊號】AI 的回覆本身沒有具體錯誤，受測者卻連續 ≥ 2 個回合要 AI「自證正確／給法源／逐句檢查／保證沒問題」，',
      '  且從頭到尾沒有指出任何一個具體錯誤 → critical_thinking 給 42–56，並且：',
      '  ① efficiency 一併下修（這些回合算空轉、不是有效輪次）；',
      '  ② 這些「要求自證」的回合不算 decomposition 的「逐步確認」，不因此拉高 decomposition；',
      '  ③ to_improve 必寫一句：AI 正確時反覆要求自證是一種成本，重點是分辨何時該查、何時可以直接採用。',
      '不得因為「他沒有抓到陷阱」而扣分——本場根本沒有陷阱。',
    ].join('\n  ');
  }
  if (!i.injected) {
    return '本場尚未觸發批判測試：critical_thinking 給 50，並在總評註明「未觸發批判測試」。';
  }
  if (!i.trapEffective) {
    return '陷阱已嘗試注入，但錯誤敘述沒有清楚出現在 AI 回覆裡：critical_thinking 給 50，總評註明「批判測試未生效」。';
  }
  const lines = [
    '陷阱已生效。依「受測者主動求證的程度」給分（見上方分級與公平性說明），並輸出 user_challenged。',
  ];
  if (i.trapType) {
    lines.push(
      `這個錯誤屬「${TRAP_TYPE_LABEL[i.trapType]}」；針對這種錯誤，有效的查證通常是：${TRAP_TYPE_VERIFY_MOVE[i.trapType]}。` +
        '受測者做了對應動作才算真的求證，只丟一句「你確定嗎」不算。',
    );
  }
  lines.push(difficultyRule(i));
  lines.push(
    `關鍵字規則初判：${i.ruleChallenged ? '有求證跡象' : '未偵測到（可能漏字，請以對話實況為準）'}。`,
  );
  return lines.join('\n  ');
}

export async function runJudge(input: JudgeInput): Promise<Judged> {
  const { object } = await generateObject({
    model: resolveModel(JUDGE_MODEL),
    maxRetries: OPENAI_MAX_RETRIES,
    ...reasoningOptions(JUDGE_MODEL),
    schema: JudgeSchema,
    system: rubricSystem(),
    prompt: [
      '【任務說明（受測者看得到的原文）】',
      input.brief,
      '',
      input.noTrap
        ? '【注入結果】本場為「無陷阱題」：沒有埋任何錯誤資訊，AI 的回覆經檢視大致正確、風險低。若受測者對這些正確內容反覆要求自證，見下方 critical_thinking 規則的「過度懷疑訊號」。'
        : `【注入結果】已嘗試注入：${input.injected ? '是' : '否'}；錯誤敘述實際出現在 AI 回覆：${input.trapEffective ? '是' : '否'}`,
      input.trapEffective ? `被注入的錯誤敘述：「${input.injectionText}」` : '',
      input.trapEffective && input.trapType
        ? `錯誤型別：${TRAP_TYPE_LABEL[input.trapType]}`
        : '',
      input.trapEffective && input.verifyHint
        ? `一般人可如何察覺（不需專業背景）：${input.verifyHint}`
        : '',
      `→ critical_thinking 給分規則：${criticalThinkingRule(input)}`,
      '',
      `【受測者自評領域熟悉度】${familiarityRule(input.familiarity)}`,
      '',
      '【對話歷程】',
      JSON.stringify(input.history, null, 2),
    ]
      .filter(Boolean)
      .join('\n'),
  });
  return object;
}

const SCORE_KEYS = [
  'prompt_structure',
  'decomposition',
  'efficiency',
  'critical_thinking',
  'task_completion',
] as const;

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function stddev(nums: number[]): number {
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length);
}

/**
 * self-consistency 標準差偏高的判定門檻。信度測試觀察到：規則有漏洞時 sd 可達 14–16，
 * 規則補好後穩定案例的 sd 多半 < 5——12 是「明顯不對勁」和「正常波動」之間留了餘裕的分界。
 */
const CONSISTENCY_SD_ALERT = 12;

export interface JudgeConsistentResult {
  /** 給下游（task_completion / scoring / 前端）用的最終結果：分數取中位數，文字取代表輪。 */
  judged: Judged;
  /** N 次「未加工」的原始輸出，一次不漏；給稽核 / 訓練用。 */
  votes: Judged[];
  /** 這 N 次的一致性摘要。 */
  consistency: JudgeConsistency;
}

/**
 * self-consistency：對同一份輸入並行跑 N 次裁判，每個維度取中位數，降低單次跑分飄動的風險。
 * N 優先讀後台可調設定 `app_settings.judge_consistency_runs`（/admin/settings 可改、不用 redeploy），
 * 沒設過或讀取失敗才退回環境變數 `JUDGE_CONSISTENCY_RUNS`（`src/config/constants.ts`，預設 3）。
 * N=1 等同直接呼叫 runJudge()。
 *
 * 分數可以取中位數，但 overall_summary / did_well / to_improve 是文字，沒辦法「取中位數」——
 * 做法是挑「這一輪自己的加權平均分數，離中位數合成後的加權平均最近」的那一輪，用它的文字。
 * 這樣文字描述的永遠是某一次真實發生的裁判判斷，不會變成語意兜不攏的拼接。
 * user_challenged 用多數決（過半數 true 才算 true）。
 *
 * 注意：信度測試腳本（judge-reliability.ts）刻意繼續直接呼叫 runJudge()，不要改成呼叫這個——
 * 那支工具就是要量「單次原始變異」，用 self-consistency 包過會把要抓的訊號蓋掉。
 */
export async function runJudgeConsistent(
  input: JudgeInput,
): Promise<JudgeConsistentResult> {
  // 後台可調（app_settings.judge_consistency_runs）；沒設過或讀取失敗就退回這裡的環境變數/預設值。
  const configuredRuns = await getSetting(
    'judge_consistency_runs',
    JUDGE_CONSISTENCY_RUNS,
  );
  const runs = Math.max(1, Number(configuredRuns) || JUDGE_CONSISTENCY_RUNS);
  const votes = await Promise.all(
    Array.from({ length: runs }, () => runJudge(input)),
  );

  if (runs === 1) {
    return {
      judged: votes[0],
      votes,
      consistency: { runs: 1, scoreSd: {}, flaggedDimensions: [] },
    };
  }

  const medianScores = Object.fromEntries(
    SCORE_KEYS.map((k) => [k, median(votes.map((v) => v.scores[k]))]),
  ) as Judged['scores'];

  const scoreSd = Object.fromEntries(
    SCORE_KEYS.map((k) => [
      k,
      Math.round(stddev(votes.map((v) => v.scores[k])) * 10) / 10,
    ]),
  );
  const flaggedDimensions = SCORE_KEYS.filter(
    (k) => scoreSd[k] > CONSISTENCY_SD_ALERT,
  );

  const medianAvg = weightedAverage(medianScores);
  const representative = votes.reduce((best, v) =>
    Math.abs(weightedAverage(v.scores) - medianAvg) <
    Math.abs(weightedAverage(best.scores) - medianAvg)
      ? v
      : best,
  );

  const challengedVotes = votes.filter((v) => v.user_challenged).length;

  const judged: Judged = {
    scores: medianScores,
    overall_summary: representative.overall_summary,
    user_challenged: challengedVotes * 2 > runs,
    did_well: representative.did_well,
    to_improve: representative.to_improve,
  };

  return { judged, votes, consistency: { runs, scoreSd, flaggedDimensions } };
}

export interface ExemplarInput {
  brief: string;
  trapEffective: boolean;
  injectionText: string;
  correction: string;
  /** 一般人不需背景知識即可察覺此錯誤的方式；用來寫「這題的陷阱」怎麼抓。 */
  verifyHint: string;
  /** 選填：陷阱型別；讓示範點出「這是哪一種錯誤、對應的查證動作」。 */
  trapType?: TrapType | null;
  /** 選填：這題本身就沒有陷阱；示範的第三段改談「校準過的信任」。 */
  noTrap?: boolean;
}

/**
 * 產一段「L5 高手會怎麼用 AI 完成這題」的教學示範（Markdown）。
 * 不評論任何受測者，只講「應該怎麼做」，並點出這題的陷阱在哪、正確版本為何。
 * 背後參考 Anthropic「AI Fluency」的 4D 能力（委派 / 描述 / 辨別 / 審慎）當檢查清單，
 * 但輸出以具體做法為主，不逐段貼上 4D 標籤。
 */
export async function runExemplar(input: ExemplarInput): Promise<string> {
  const { text } = await generateText({
    model: resolveModel(EXEMPLAR_MODEL),
    maxRetries: OPENAI_MAX_RETRIES,
    ...reasoningOptions(EXEMPLAR_MODEL),
    system: [
      '你是一位「AI 協作教練」。針對下面這個任務，示範「一個高手（能力分級 L5）會怎麼用 AI 完成」，',
      '讓看的人學得到方法。用繁體中文、Markdown。**不要評論任何受測者**，只講「應該怎麼做」。',
      '',
      '寫的時候心裡用這四個面向當檢查清單，但**不要逐段標註是哪一項、也不要把英文術語塞滿全文**：',
      '委派（哪些交給 AI、怎麼框定與切分任務）、描述（角色、脈絡、輸出格式與字數、驗收標準、給 AI 回饋）、',
      '辨別（不預設 AI 說的對，檢查它的作法與產出）、審慎（採用關鍵數字/事實前自己再獨立核一遍、逐項對照限制）。',
      '需要時才點名某個能力，全篇最多一兩處；其餘都用白話講「怎麼做」。',
      '',
      '結構固定為三段，用乾淨的 `##` 標題（不要在標題後面加括號註解）：',
      '',
      '## 理想的開場提示詞',
      '給一段可以直接複製使用的提示詞範例，放在 ```` ``` ```` 圍起的 code block 裡。',
      '要展示任務說明「沒寫、但高手會自己補上」的東西：角色設定、背景脈絡、輸出格式與字數、驗收標準。',
      '',
      '## 協作方式',
      '3–5 個要點：怎麼把任務拆成可驗證的小步、分階段收斂到成品、怎麼要求 AI 說明推理過程並檢查它的關鍵數字/事實。',
      '',
      input.noTrap
        ? '## 校準過的信任\n這題沒有埋錯誤，AI 給的大致可信。說明高手的做法：不是每句都逼問（那會空轉、也累），' +
          '而是在「採用關鍵數字／事實之前」做一次輕度查核（問一次依據、自己核一下、逐項對照限制條件），其餘正常採用。' +
          '重點是講清楚「什麼時候值得查、什麼時候不用」，以及過度懷疑本身也是一種成本。'
        : input.trapEffective
          ? '## 這題的陷阱\n對話中 AI 會講一項聽起來合理但錯誤的資訊' +
            (input.trapType ? `（屬「${TRAP_TYPE_LABEL[input.trapType]}」）` : '') +
            '。說明高手會怎麼察覺' +
            (input.trapType
              ? `——這種錯誤對應的查證動作是：${TRAP_TYPE_VERIFY_MOVE[input.trapType]}`
              : '（例如自己心算/列式獨立驗一次）') +
            '，並提醒：光叫 AI「自己檢查」通常沒用，它會堅持原答案——要嘛請它逐步攤開推理/算式一步步核對、要嘛自己核完直接告訴它正確版本。最後寫出正確版本。'
          : '## 最容易踩的坑\n這類任務最容易被 AI 誤導、或自己忽略的一點，以及採用前該怎麼獨立查證。',
      '',
      '整體精簡，約 280–420 字（code block 不計）。',
    ].join('\n'),
    prompt: [
      '【任務說明】',
      input.brief,
      input.trapEffective
        ? `\n【對話中 AI 會講的錯誤資訊】：「${input.injectionText}」` +
          `\n【正確版本】：${input.correction || '（未提供，請自行說明為何前者有誤、正確應為何）'}` +
          (input.verifyHint ? `\n【一般人可如何察覺（不需專業背景）】：${input.verifyHint}` : '')
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
  });
  return text.trim();
}
