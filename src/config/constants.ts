/**
 * 檔案：src/config/constants.ts
 * 角色：設定層 — 全域測驗參數的單一來源
 * 功能：對話輪次上限、輸入字數上限、陷阱注入輪次、免費次數、模型名稱等常數。
 *       前後端共用；改動前請同步 README 與前端顯示文案。
 */

/** Redis 中 session 的存活時間（秒）。逾時視為棄考。 */
export const EXAM_TTL_SEC = 60 * 60;

/** 單場測驗最高使用者發話輪次（後端硬鎖）。 */
export const MAX_USER_TURNS = 5;

/** 單次輸入字數上限（省 Token / 防禦）。 */
export const MAX_INPUT_CHARS = 300;

/** 於第幾個使用者輪次注入幻覺陷阱。 */
export const INJECT_AT_TURN = 2;

/** 每個帳號的免費檢測次數。 */
export const FREE_ATTEMPTS = 2;

/** 沙盒對話模型。 */
export const SANDBOX_MODEL = 'gpt-4o-mini';

/** 裁判模型（商用等級，一場一次）。 */
export const JUDGE_MODEL = 'gpt-4o';
