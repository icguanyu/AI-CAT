/**
 * 檔案：scripts/generate-scenarios.ts
 * 角色：開發工具 — 批次生成題目候選稿（P1：只生草稿，不會自動上架）
 * 功能：對指定分類呼叫 runScenarioGen() N 次（依序，不平行——這樣後面幾題才看得到
 *       前面幾題剛生出來的標題，避免同一批裡概念重複），寫成一個本機 JSON 檔，
 *       格式跟 scenarios.local.json / npm run scenarios:import 吃的完全一樣。
 *
 * 這支腳本「只寫本機檔案，不碰 Supabase」——刻意design成這樣：
 *   1. 生出來的候選稿先自己看過，覺得可以再手動決定要不要真的匯入。
 *   2. 想在自己的 dev 環境實際玩玩看某一題，直接把輸出檔複製成專案根目錄的
 *      scenarios.local.json，`npm run dev` 就會用它、完全不碰正式 Supabase。
 *   3. 確定要上架，才用既有的 `npm run scenarios:import` 匯入（可以先加 --dry 預覽），
 *      匯入後題目預設 active=true——記得去後台「題庫健檢」頁面看過、必要時手動關掉
 *      還沒準備好的題目，不要跳過人工審核這一步。
 *
 * 用法：
 *   npm run scenarios:generate -- --category=it_software
 *   npm run scenarios:generate -- --category=healthcare --count=5
 *   npm run scenarios:generate -- --category=daily_life --out=scripts/generated/my-batch.json
 *
 * 需要 .env.local（或環境變數）有：SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY、
 * OPENAI_API_KEY（或用 SCENARIO_GEN_MODEL=claude-* 時要有 ANTHROPIC_API_KEY）。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { isCategory, CATEGORY_LABEL, type Category } from '../src/types/exam';
import {
  runScenarioGen,
  SCENARIO_GEN_VERSION,
  type GeneratedScenario,
} from '../src/lib/scenario-gen';
import { sumTokenUsage } from '../src/lib/judge';

/** 自己讀 .env.local（CRLF 安全），不依賴 tsx --env-file。跟 import-scenarios.ts 同一份。 */
function loadEnvLocal() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m || process.env[m[1]]) continue;
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  } catch {
    /* 沒有 .env.local 就靠既有環境變數 */
  }
}

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([a-zA-Z]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** 抓這個分類現有的題目標題，餵給生成 prompt 避免概念重複。直接打 REST，不用 supabase-js。 */
async function fetchExistingTitles(category: Category): Promise<string[]> {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return [];
  const url = `${base}/rest/v1/scenarios?select=title_zh&category=eq.${category}`;
  const res = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as { title_zh: string }[];
  return rows.map((r) => r.title_zh).filter(Boolean);
}

async function main() {
  loadEnvLocal();

  const args = parseArgs(process.argv.slice(2));
  if (!isCategory(args.category)) {
    console.error(
      `--category 缺少或不合法。可用值：${Object.keys(CATEGORY_LABEL).join(', ')}`,
    );
    process.exit(1);
  }
  const category = args.category;
  const count = Math.max(1, Math.min(20, Number(args.count) || 3));
  const timestamp = Date.now();
  const outPath = args.out || `scripts/generated/${category}-${timestamp}.json`;

  console.log(`分類：${CATEGORY_LABEL[category]}（${category}）　生成數量：${count}`);
  console.log(`生成邏輯版本：${SCENARIO_GEN_VERSION}\n`);

  const existingTitles = await fetchExistingTitles(category);
  if (existingTitles.length > 0) {
    console.log(`已知現有題目（避免概念重複）：${existingTitles.join('、')}\n`);
  }

  const generated: GeneratedScenario[] = [];
  const usages = [];
  for (let i = 0; i < count; i++) {
    process.stdout.write(`生成第 ${i + 1}/${count} 題...`);
    const { scenario, usage } = await runScenarioGen({
      category,
      existingTitles: [...existingTitles, ...generated.map((g) => g.titleZh)],
    });
    generated.push(scenario);
    usages.push(usage);
    console.log(` 「${scenario.titleZh}」（${scenario.variants.length} 個變體，${usage.totalTokens} tokens）`);
  }

  const rows = generated.map((g, i) => ({
    // 中文標題沒辦法乾淨轉英數 slug，直接用「分類_gen_時間戳_序號」當 id，
    // 保證跟現有手寫題目（英文 id）不會撞名，人工審核時要改成好記的 id 也可以。
    id: `${category}_gen_${timestamp}_${i}`,
    category,
    titleZh: g.titleZh,
    brief: g.brief,
    system: g.system,
    variants: g.variants,
    // 標記這批是 AI 生成的候選稿、哪個生成邏輯版本、什麼時候生的——
    // 之後回頭比對「生成品質有沒有隨版本改進」用得到，import-scenarios.ts 會忽略這個欄位。
    _generated: { version: SCENARIO_GEN_VERSION, at: new Date(timestamp).toISOString() },
  }));

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(rows, null, 2), 'utf8');

  const total = sumTokenUsage(usages);
  console.log(`\n已寫入 ${rows.length} 題候選稿 → ${outPath}`);
  console.log(`總 token 用量：${total.totalTokens}（prompt ${total.promptTokens} / completion ${total.completionTokens}）`);
  console.log('\n下一步：自己先讀過 ' + outPath + ' 覺得可以，再決定要不要用 npm run scenarios:import 匯入。');
  console.log('這份還沒有經過任何人工審核，先別直接拿真人來測。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
