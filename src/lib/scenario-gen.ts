/**
 * 檔案：src/lib/scenario-gen.ts
 * 角色：領域層 — 情境題「候選稿」生成（P1：批次生成，人審後才上架）
 * 功能：runScenarioGen() 針對指定分類，請 LLM 生一題新的情境（含 2–3 個變體，
 *       每個變體都有一個蓄意植入的陷阱：一句聽起來合理但錯誤的敘述、正確版本、
 *       一般人不需專業背景就能察覺的方式、陷阱型別與難度分級）。
 *
 * 這個檔案只負責「生出候選內容」，不會自己寫進 Supabase、更不會讓生出來的題目直接上線——
 * 那是 scripts/generate-scenarios.ts 的事，而且那支腳本只把結果寫成本機 JSON 檔，
 * 上架與否永遠是人工決定（跟現有題庫「active 開關」走同一套審核習慣，不走捷徑）。
 *
 * 為什麼要這樣拆：生題目的風險跟裁判評分的風險是同一種風險——生成品質不穩、陷阱不公平
 * （太明顯沒人會中招、太隱晦變成在考專業知識），都會悄悄侵蝕整個測驗的可信度。裁判那邊
 * 已經有 self-consistency + 人工複查兩層把關，題目生成這邊目前只有「人工審過才上架」
 * 這一層——先求穩，之後真的要擴大生成量，再比照裁判那邊補統計層面的把關。
 */
import { generateObject } from 'ai';
import { z } from 'zod';
import { resolveModel } from '@/lib/model';
import { toTokenUsage } from '@/lib/judge';
import { OPENAI_MAX_RETRIES } from '@/config/constants';
import {
  CATEGORY_LABEL,
  TRAP_TYPE_LABEL,
  TRAP_TYPE_VERIFY_MOVE,
  type Category,
  type TokenUsage,
} from '@/types/exam';

/** 沿用裁判模型——這裡吃重的是「設計一個公平陷阱」的判斷力，跟裁判評分是同一種能力。 */
const SCENARIO_GEN_MODEL = process.env.SCENARIO_GEN_MODEL || 'gpt-5';

/**
 * 生成邏輯的版本標記，跟裁判的 RUBRIC_VERSION 同精神：改動 scenarioGenSystem() 這類
 * 會影響生成品質的文字時，往上 bump。生出來的候選稿檔名建議帶上這個版本號，
 * 方便之後回頭比對「哪個世代的生成邏輯做出來的題目，人工審核通過率比較高」。
 */
export const SCENARIO_GEN_VERSION = 'g1';

const TrapTypeEnum = z.enum([
  'knowledge_error',
  'calculation_error',
  'logic_error',
  'concept_confusion',
  'hidden_assumption',
  'strategy_flaw',
]);

const VariantGenSchema = z.object({
  injectionText: z
    .string()
    .describe('要植入的錯誤敘述——沙盒 AI 會用肯定、自然的語氣把這句話講給受測者聽'),
  correction: z.string().describe('injectionText 的正確版本，用於報告頁的錯誤 vs 正確對照'),
  verifyHint: z
    .string()
    .describe('一般人「不需要專業背景」就能察覺這個錯誤的具體方式，用來校準批判思考評分的公平性'),
  trapType: TrapTypeEnum.describe('這個陷阱屬於哪一種型別'),
  verifyDifficulty: z
    .enum(['easy', 'medium', 'hard'])
    .describe('一般人要多容易才能察覺這個錯誤'),
});

export const ScenarioGenSchema = z.object({
  titleZh: z.string().describe('中文標題，8–16 字，一看就懂這題在做什麼'),
  brief: z
    .string()
    .describe(
      '給受測者看的任務說明與限制條件（繁體中文）。要有明確、可驗收的限制條件（格式/字數/' +
        '涵蓋項目），讓「有沒有把提示詞寫清楚」跟「成品有沒有滿足每一項限制」都判斷得出來。',
    ),
  system: z
    .string()
    .describe(
      '沙盒 AI 的角色設定（機密，受測者看不到）。要讓 AI 有明確人設跟脈絡，' +
        '自然到會在某個時機講出植入的錯誤敘述而不顯得突兀。',
    ),
  variants: z
    .array(VariantGenSchema)
    .min(2)
    .max(3)
    .describe('2–3 個變體，同一個 brief/system 底下換不同的陷阱內容，避免受測者猜到固定套路'),
});

export type GeneratedScenario = z.infer<typeof ScenarioGenSchema>;

function scenarioGenSystem(category: Category, existingTitles: string[]): string {
  const trapTypeGuide = (Object.keys(TRAP_TYPE_LABEL) as (keyof typeof TRAP_TYPE_LABEL)[])
    .map((k) => `- ${k}：${TRAP_TYPE_LABEL[k]}；有效查證通常是「${TRAP_TYPE_VERIFY_MOVE[k]}」`)
    .join('\n');

  return [
    '你是這個平台的題目設計師。這個平台用「動態沙盒對話 + 植入陷阱」測一個人使用 AI 協作的能力，',
    '不是選擇題。你要設計的不是考題答案，而是一個「任務情境」，讓受測者在裡面跟 AI 對話完成任務，',
    'AI 會在某一輪自然地講出一句你設計的錯誤敘述——測的是受測者會不會發現、會不會查證。',
    '',
    '== 分類 ==',
    `這題屬於「${CATEGORY_LABEL[category]}」。`,
    existingTitles.length > 0
      ? `這個分類已經有這些標題，不要生出概念重複的題目：${existingTitles.join('、')}`
      : '這個分類目前還沒有題目。',
    '',
    '== brief（給受測者看）要做到 ==',
    '1. 說清楚任務是什麼、成品長什麼樣、有哪些限制條件（格式/字數/必須涵蓋的項目）——',
    '   限制條件要具體到「有沒有漏做」判斷得出來，不能只寫「請幫我規劃一下」這種籠統敘述。',
    '2. 不要預設受測者有這個領域的專業知識——如果任務本身需要專業背景才做得完整，',
    '   要嘛把需要的背景資訊直接寫進 brief，要嘛把陷阱設計成不需要專業知識也能察覺（easy 難度）。',
    '',
    '== system（沙盒 AI 人設，受測者看不到）要做到 ==',
    '要讓 AI 有明確角色跟脈絡，這樣植入的錯誤敘述才會自然地從這個角色口中講出來，不顯得刻意。',
    '',
    '== 陷阱設計（最重要）==',
    '每個變體要有一個陷阱，先選一種型別，再依它設計 injectionText：',
    trapTypeGuide,
    '',
    '陷阱設計的三個要求：',
    '1. **合理**：injectionText 要講得像真的、符合這個角色的語氣，不能一看就是錯的（那樣測不出批判思考）。',
    '2. **公平**：verifyDifficulty 標 easy 時，verifyHint 必須是「不需專業背景」就能做到的具體動作',
    '   （例如「自己重新加總一次」「回想自己的實際經驗」），不能是「查閱相關文獻」這種變相要求專業知識的說法。',
    '3. **不要太明顯**：injectionText 不要自相矛盾、不要用「其實」「事實上」這種暗示轉折的詞，',
    '   要讓它讀起來就是這個角色會自然說出的一句話。',
    '',
    '記住：你生的是「草稿」，會有人審核過才會真的拿去測真人，不代表審核一定會過——',
    '但正因為這樣，更要盡量往「經得起審核」的標準去設計，而不是隨便生一個交差。',
  ].join('\n');
}

export interface ScenarioGenInput {
  category: Category;
  /** 這個分類現有的題目標題，避免生出概念重複的題目。 */
  existingTitles: string[];
}

export interface ScenarioGenResult {
  scenario: GeneratedScenario;
  usage: TokenUsage;
}

export async function runScenarioGen(
  input: ScenarioGenInput,
): Promise<ScenarioGenResult> {
  const { object, usage } = await generateObject({
    model: resolveModel(SCENARIO_GEN_MODEL),
    maxRetries: OPENAI_MAX_RETRIES,
    schema: ScenarioGenSchema,
    system: scenarioGenSystem(input.category, input.existingTitles),
    prompt: `請為分類「${CATEGORY_LABEL[input.category]}」設計一題新的情境題。`,
  });
  return { scenario: object, usage: toTokenUsage(usage) };
}
