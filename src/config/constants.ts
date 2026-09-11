/**
 * 檔案：src/config/constants.ts
 * 角色：設定層 — 全域測驗參數的單一來源
 * 功能：對話輪次上限、輸入字數上限、陷阱注入時機（隨機）、免費次數、模型名稱等常數。
 *       前後端共用；改動前請同步 README 與前端顯示文案。
 */

/** Redis 中 session 的存活時間（秒）。逾時視為棄考。 */
export const EXAM_TTL_SEC = 60 * 60;

/**
 * 呼叫 OpenAI／Anthropic（沙盒對話、裁判、L5 示範）時的自動重試次數。
 * Vercel AI SDK 對 429（速率限制）與 5xx 這類可重試錯誤會自動帶退避延遲重試；
 * 這裡明確設定（而非依賴 SDK 預設值 2），三個呼叫點一致、行為可見。
 * self-consistency 會同時並行打好幾個請求、更容易撞到瞬間限流，重試次數留寬一點。
 */
export const OPENAI_MAX_RETRIES = Number(process.env.OPENAI_MAX_RETRIES) || 3;

/** 單場測驗最高使用者發話輪次（後端硬鎖）。 */
export const MAX_USER_TURNS = 10;

/** 單次輸入字數上限（放寬到能寫完整提示詞：角色 + 脈絡 + 格式要求）。 */
export const MAX_INPUT_CHARS = 1000;

/**
 * 幻覺陷阱的注入時機改為「每場隨機」，開場時由 rollInjectAtTurn() 擲一次、存進 ExamState：
 *   - 有 INJECT_SKIP_PROB 的機率整場不注入（injectAtTurn = 0）。
 *   - 否則落在 [INJECT_TURN_MIN, INJECT_TURN_MAX] 之間的某個使用者輪次。
 *   - 若受測者提早提交、還沒走到那一輪，等於這場沒觸發（injected 維持 false）。
 * 三個參數都可用同名環境變數覆寫（測試時可把 SKIP 設 0、MIN=MAX 固定輪次）。
 */
export const INJECT_TURN_MIN = Number(process.env.INJECT_TURN_MIN) || 0;
export const INJECT_TURN_MAX = Number(process.env.INJECT_TURN_MAX) || 2;
export const INJECT_SKIP_PROB =
  process.env.INJECT_SKIP_PROB !== undefined
    ? Number(process.env.INJECT_SKIP_PROB)
    : 0.2;

/** 開場擲一次：回傳注入的使用者輪次；0 = 這場完全不注入。 */
export function rollInjectAtTurn(): number {
  if (Math.random() < INJECT_SKIP_PROB) return 0;
  const min = Math.max(0, Math.min(INJECT_TURN_MIN, MAX_USER_TURNS));
  const max = Math.max(min, Math.min(INJECT_TURN_MAX, MAX_USER_TURNS));
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** 每個帳號每日可開始的檢測次數；隔天（台北時間 00:00）重新計算。 */
export const DAILY_ATTEMPTS = Number(process.env.DAILY_ATTEMPTS) || 3;

/** 每個帳號的生涯總上限；達到後暫不開放（之後可能改付費）。 */
export const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS) || 21;

/** 沙盒對話模型（回答受測者）。可用 SANDBOX_MODEL 環境變數覆寫。 */
export const SANDBOX_MODEL = process.env.SANDBOX_MODEL || 'gpt-5-mini';

// ── 免登入公開試用（anon trial）───────────────────────────────
/** 試用的沙盒對話模型：走最便宜的一支（裁判仍用正式版 JUDGE_MODEL）。 */
export const PUBLIC_SANDBOX_MODEL =
  process.env.PUBLIC_SANDBOX_MODEL || 'gpt-4o-mini';
/** 公開試用池每月上限（台北時間跨月重置）；用完就只給登入。 */
export const PUBLIC_TRIAL_MONTHLY_LIMIT =
  Number(process.env.PUBLIC_TRIAL_MONTHLY_LIMIT) || 300;
/** 公開試用池每日子上限（防一次爆量把整月燒光）；台北時間跨日重置。 */
export const PUBLIC_TRIAL_DAILY_LIMIT =
  Number(process.env.PUBLIC_TRIAL_DAILY_LIMIT) ||
  Math.max(5, Math.ceil(PUBLIC_TRIAL_MONTHLY_LIMIT / 12));
/** 試用場的對話輪次上限（比登入版短，壓成本）。 */
export const PUBLIC_TRIAL_MAX_TURNS =
  Number(process.env.PUBLIC_TRIAL_MAX_TURNS) || 6;
/** 試用結果只放 Redis 的存活秒數（登入前回訪可續看 / 認領）。 */
export const ANON_RESULT_TTL_SEC = 60 * 60 * 72;
/** anon 身分 cookie 的存活秒數（一輩子一次的旗標同壽）。 */
export const ANON_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400;

/**
 * 裁判模型（評分）。一場評分實際會呼叫 JUDGE_CONSISTENCY_RUNS 次（見下）。
 * 可用 JUDGE_MODEL 環境變數覆寫。值以 "claude" 開頭 → 走 Anthropic
 * （`resolveModel`，需 ANTHROPIC_API_KEY），例：`claude-opus-5`、`claude-sonnet-5`；否則走 OpenAI。
 */
export const JUDGE_MODEL = process.env.JUDGE_MODEL || 'gpt-5';

/**
 * OpenAI 推理模型（gpt-5 / o 系列）當裁判時的思考量：low | medium | high。
 * 預設 low —— 裁判是照 rubric 打分，低思考量已足夠且快很多。
 * 只對 OpenAI 推理模型生效；gpt-4.1 / gpt-4o / Claude 會忽略。
 */
export const JUDGE_REASONING_EFFORT = ((): 'low' | 'medium' | 'high' => {
  const v = process.env.JUDGE_REASONING_EFFORT;
  return v === 'medium' || v === 'high' ? v : 'low';
})();

/**
 * 裁判 self-consistency：同一份對話並行跑幾次、每個維度取中位數，
 * 降低單次跑分飄動的風險（信度測試量到修規則前 sd 可達 14–16）。
 * 1 = 關閉（跟以前一樣單次）。每加 1，該場評分的裁判 API 成本乘 1 倍。
 * 可用 JUDGE_CONSISTENCY_RUNS 環境變數覆寫；建議維持奇數，避免 user_challenged 多數決平手。
 */
export const JUDGE_CONSISTENCY_RUNS =
  Number(process.env.JUDGE_CONSISTENCY_RUNS) || 3;
