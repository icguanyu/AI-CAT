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

/** 受測者開場自評「對這個情境的領域有多熟」。用來給裁判校準 task_completion。 */
export type Familiarity = 'high' | 'mid' | 'low';

export const FAMILIARITY_LABEL: Record<Familiarity, string> = {
  high: '很熟',
  mid: '普通',
  low: '不熟',
};

/** 給受測者看的每個選項說明（開始對話前的自評畫面）。 */
export const FAMILIARITY_DESC: Record<Familiarity, string> = {
  high: '你的專業或很常做的事——不用查也大致知道怎樣算做得好。',
  mid: '略懂——判斷得出 AI 給的合不合理，但細節要想一下或查一下。',
  low: '不是你的領域——主要靠問 AI、要它解釋跟舉證來完成。',
};

/** 收窄未知輸入為合法值；預設「普通」。 */
export function toFamiliarity(v: unknown): Familiarity {
  return v === 'high' || v === 'low' ? v : 'mid';
}

/**
 * 情境分類（封閉詞彙）。這是「彙總 / 個人統整 / 分場景權重」的穩定分組單位——
 * 之後轉動態產題時，題目每次不同、但 category 固定，彙總機制不用改。
 * 新增分類：加一個 id + label，別重用或改動舊 id（會讓歷史報告對不上）。
 */
export type Category =
  | 'creative_marketing'
  | 'finance_invest'
  | 'healthcare'
  | 'media_arts'
  | 'it_software'
  | 'academia_edu'
  | 'manufacturing'
  | 'customer_service'
  | 'business_ops'
  | 'daily_life'
  | 'personal_finance';

export const CATEGORY_LABEL: Record<Category, string> = {
  creative_marketing: '創意行銷',
  finance_invest: '金融投資',
  healthcare: '醫療保健',
  media_arts: '傳播藝術',
  it_software: '資訊軟體',
  academia_edu: '學術教育',
  manufacturing: '生產製造',
  customer_service: '客戶服務',
  business_ops: '商業營運',
  daily_life: '生活與人際',
  personal_finance: '個人理財',
};

export const CATEGORY_IDS = Object.keys(CATEGORY_LABEL) as Category[];

export function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && v in CATEGORY_LABEL;
}

/**
 * 陷阱型別（封閉詞彙）。決定「面對這種錯誤，怎樣的查證才算數」——
 * 傳給裁判當 critical_thinking 的判分依據（見 judge.ts criticalThinkingRule）。
 */
export type TrapType =
  | 'knowledge_error'
  | 'calculation_error'
  | 'logic_error'
  | 'concept_confusion'
  | 'hidden_assumption'
  | 'strategy_flaw';

export const TRAP_TYPE_LABEL: Record<TrapType, string> = {
  knowledge_error: '知識性錯誤（AI 講錯或編造事實／知識）',
  calculation_error: '計算錯誤（加總、平均、比例等算錯）',
  logic_error: '邏輯錯誤（推理跳步、把「沒結論」當結論、自相矛盾）',
  concept_confusion: '概念混淆（把兩個相似的概念／做法混為一談）',
  hidden_assumption: '隱含假設（沒看到限制條件，或擅自假設未提供的資訊）',
  strategy_flaw: '策略瑕疵（做法在實務上不可行或有副作用）',
};

/** 針對每種陷阱，「有效的查證行為」大概長什麼樣（給裁判判 critical_thinking 用）。 */
export const TRAP_TYPE_VERIFY_MOVE: Record<TrapType, string> = {
  knowledge_error: '要求 AI 給出處／依據，或自己查證',
  calculation_error: '自己重算一次，或要求 AI 逐步列出算式再核對',
  logic_error: '追問推理的每一步，或直接指出前後矛盾之處',
  concept_confusion: '要求 AI 說清楚兩個概念的差別，或自己點出它混用了',
  hidden_assumption: '逐項對照限制條件，或追問「這個數字／前提你是哪裡來的」',
  strategy_flaw: '追問這個做法的實務後果與可行性',
};

export function isTrapType(v: unknown): v is TrapType {
  return typeof v === 'string' && v in TRAP_TYPE_LABEL;
}

/** 這個陷阱「一般人要多容易才察覺得到」——校準 critical_thinking 的公平性。 */
export type VerifyDifficulty = 'easy' | 'medium' | 'hard';

export const VERIFY_DIFFICULTY_LABEL: Record<VerifyDifficulty, string> = {
  easy: '一般人不需背景知識、用手上資訊就能察覺',
  medium: '要一點常識推理或簡單查證才看得出',
  hard: '要專業知識或高成本查證才可能發現',
};

export function isVerifyDifficulty(v: unknown): v is VerifyDifficulty {
  return v === 'easy' || v === 'medium' || v === 'hard';
}

/** 情境題的一個隨機變體。 */
export interface ScenarioVariant {
  /** 選填：覆寫該場的任務說明（用來變動限制條件）。 */
  brief?: string;
  /**
   * 這個變體「不埋任何錯誤資訊」。noTrap 時 injectionText / correction /
   * trapType / verifyDifficulty 可省略，開場一律 injectAtTurn = 0（整場不注入）。
   * 用來讓受測者無法假設「每題都有陷阱」，並測「校準過的信任」。
   */
  noTrap?: boolean;
  /** trap 變體必填、noTrap 變體省略：要注入的蓄意錯誤敘述（機密）；注入輪次每場隨機。 */
  injectionText?: string;
  /** 選填：對 injectionText 的正解，報告畫面用來做「錯誤 vs 正確」對照。 */
  correction?: string;
  /**
   * 選填：一般人「不需要專業背景」就能察覺這個錯誤的方式。只給裁判與 L5 示範參考，
   * 用來校準 critical_thinking——沒察覺一個「本來就好查」的錯才算批判力弱。
   */
  verifyHint?: string;
  /** 選填：陷阱型別（封閉詞彙）。傳給裁判當「該留意哪種錯誤」的提示。 */
  trapType?: TrapType;
  /** 選填：一般人要多容易才察覺得到這個錯誤。校準 critical_thinking 的公平性。 */
  verifyDifficulty?: VerifyDifficulty;
}

/**
 * 情境題定義（system / injectionText 為機密，存 Supabase scenarios 表）。
 * 題庫來源（本機 json / Supabase）都是 `Scenario[]`，以 `id` 為唯一鍵。
 * 舊格式 `{ brief, system, injectionText }` 由載入器自動轉為單一 variant。
 */
export interface Scenario {
  /** 唯一鍵；一場測驗跨輪次靠它接回同一題。動態產題時是實例 id。 */
  id: string;
  /** 領域分類（封閉詞彙）。彙總 / 自評 / 動態產題的穩定分組單位。 */
  category: Category;
  /** 給人看的中文標題（歷史列表 / log 用）。 */
  titleZh: string;
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
  category: Category;
  titleZh: string;
  variantIndex: number;
  brief: string;
  system: string;
  /** 這個變體不埋錯誤資訊；true 時下列 injectionText / correction / trapType / verifyDifficulty 都是空值。 */
  noTrap: boolean;
  /** noTrap 時為空字串。 */
  injectionText: string;
  /** 正解說明；沒填 / noTrap 就是空字串。 */
  correction: string;
  /** 一般人不需背景知識就能察覺此錯誤的方式；沒填就是空字串。 */
  verifyHint: string;
  /** 陷阱型別；沒填 / noTrap 就是 null。 */
  trapType: TrapType | null;
  /** 察覺難度；沒填 / noTrap 就是 null。 */
  verifyDifficulty: VerifyDifficulty | null;
}

/**
 * 這場的投入程度訊號；不影響評分，供事後分析過濾「暖身 / 一輪就送出在刷數字」用。
 * 存進 report jsonb 的 `engagement`。
 */
export interface Engagement {
  /** 開場到提交的牆上秒數（含讀題、思考、閒置，不是純作答時間）。 */
  elapsedSec: number;
  /** 受測者發話輪次。 */
  userTurns: number;
  /** 受測者所有輸入的字數加總。 */
  userCharsTotal: number;
  /** 對話是否長到走到「排定的注入輪次」；injectAtTurn = 0（no-trap / 跳過）時為 null。 */
  reachedInjection: boolean | null;
}

/**
 * 免登入試用場評分後、只放 Redis（key `anonrpt:{examId}`）的結果快照。
 * 登入後由 /api/exam/:id/claim 讀出、寫成正式 exam_reports 列。
 */
export interface AnonReportBlob {
  /** 綁定的 anon 身分，認領時要和 cookie 對得上。 */
  anonId: string;
  scenarioId: string;
  variantIndex: number;
  category: Category;
  titleZh: string;
  familiarity: Familiarity;
  report: Report;
  weightedAverage: number;
  trap: TrapReveal | null;
  /** 這題本身就沒有陷阱（no-trap 題），非「有陷阱但沒觸發」。 */
  noTrap: boolean;
  /** 抽中變體的陷阱型別（no-trap 場為 null）；給後續裁判校準 / 分層分析用。 */
  trapType: TrapType | null;
  /** 抽中變體的察覺難度（no-trap 場為 null）。 */
  verifyDifficulty: VerifyDifficulty | null;
  /** 這場擲中的注入輪次（0 = 整場不注入 / no-trap）。 */
  injectAtTurn: number;
  /** 這場的投入程度訊號（耗時 / 輪數 / 輸入字數 / 有無走到注入輪）。 */
  engagement: Engagement;
  /** 裁判「未加工」的原始輸出（含它自己判的 user_challenged）；給稽核 / 訓練用。 */
  judgeRaw: Judged;
  /** 產出這份評分的裁判版本標記（`模型·準則版本`）。 */
  judgeVersion: string;
  ruleChallenged: boolean;
  injected: boolean;
  /** 完整對話逐字稿；認領時一起寫進 exam_reports.transcript。 */
  history: ChatMessage[];
  createdAt: number;
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
  /** 登入者的 user id；免登入試用場為空字串（改用 anonId 認場）。 */
  userId: string;
  /** 免登入試用場的 anon 身分（簽章 cookie 的裸 id）；登入場為 undefined。 */
  anonId?: string;
  /** 這場的對話輪次上限；未填視為 MAX_USER_TURNS（試用場會填較小值）。 */
  maxTurns?: number;
  scenarioId: string;
  /** 抽中情境的領域分類；快照下來，之後改題不影響已開場的場次。 */
  category: Category;
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

/** L1–L5 的身份名（結果卡片 / 個人頁共用）。 */
export const LEVEL_NAME: Record<LevelCode, string> = {
  L1: 'AI NOVICE',
  L2: 'AI USER',
  L3: 'AI PRACTITIONER',
  L4: 'AI COLLABORATOR',
  L5: 'AI ORCHESTRATOR',
};

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
    .describe(
      '最該改進的 1–3 點。每一點都要指向「這場對話裡實際發生的事」，並說明下次換成怎麼做；' +
        '用這名受測者的情境來寫，不要輸出可以原封不動貼到任何人身上的通用樣板句。真的沒有明顯可改處就回空陣列。',
    ),
});

export type Judged = z.infer<typeof JudgeSchema>;

/** 個人歷史列表的一列（精簡；點進去才拿完整報告）。見 lib/exam-reports.ts。 */
export interface ExamListItem {
  examId: string;
  createdAt: string;
  titleZh: string | null;
  category: Category | null;
  suggestedLevel: LevelCode;
  weightedAverage: number;
  scores: Judged['scores'];
  familiarity: Familiarity | null;
  challenged: boolean;
  shared: boolean;
}

/** 回傳給前端的完整報告：裁判輸出 + 後端計算的分級。 */
export const ReportSchema = JudgeSchema.extend({
  suggested_level: z.enum(['L1', 'L2', 'L3', 'L4', 'L5']).describe('後端依加權分數與規則計算'),
});

export type Report = z.infer<typeof ReportSchema>;
