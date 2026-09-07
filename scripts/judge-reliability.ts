/**
 * 檔案：scripts/judge-reliability.ts
 * 角色：開發工具 — 裁判信度測試
 * 功能：對同一份對話歷程（fixture）重複跑 runJudge N 次，統計每個維度的
 *       mean / sd / min / max 與 L1–L5 分佈，判斷 gpt-4o 當裁判夠不夠穩。
 *
 * 用法：
 *   npm run judge:reliability -- scripts/fixtures.example.json 8
 *   （real fixture 放 scripts/fixtures/，該資料夾已 gitignore）
 *
 * fixture 形狀：
 *   { label?, brief, injected, injectionLanded, injectionText, history: ChatMessage[] }
 */
import { readFileSync } from 'node:fs';
import { runJudge, detectChallenge } from '../src/lib/judge';
import { computeLevel } from '../src/lib/scoring';
import { INJECT_AT_TURN } from '../src/config/constants';
import type { ChatMessage, Judged } from '../src/types/exam';

interface Fixture {
  label?: string;
  brief: string;
  injected: boolean;
  injectionLanded: boolean;
  injectionText: string;
  history: ChatMessage[];
}

const KEYS = [
  'prompt_structure',
  'decomposition',
  'efficiency',
  'critical_thinking',
  'task_completion',
] as const;

function stats(nums: number[]) {
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const sd = Math.sqrt(
    nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length,
  );
  return { mean, sd, min: Math.min(...nums), max: Math.max(...nums) };
}

const pad = (s: string | number, n: number) => String(s).padStart(n);

/** 自己讀 .env.local，不依賴 tsx --env-file 的解析行為。 */
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

async function main() {
  loadEnvLocal();

  const [fixturePath, runsArg] = process.argv.slice(2);
  if (!fixturePath) {
    console.error(
      '用法：npm run judge:reliability -- <fixture.json> [runs=8]',
    );
    process.exit(1);
  }
  const runs = Number(runsArg ?? 8);
  const fx = JSON.parse(readFileSync(fixturePath, 'utf8')) as Fixture;

  const ruleChallenged = fx.injected
    ? detectChallenge(fx.history, INJECT_AT_TURN)
    : false;
  const trapEffective = fx.injected && fx.injectionLanded;

  const scoreRows: Judged['scores'][] = [];
  const challengedRows: boolean[] = [];
  const levels: string[] = [];
  const averages: number[] = [];

  process.stdout.write(`跑 ${runs} 次`);
  for (let i = 0; i < runs; i++) {
    const judged = await runJudge({
      brief: fx.brief,
      history: fx.history,
      injected: fx.injected,
      trapEffective,
      injectionText: fx.injectionText,
      ruleChallenged,
    });
    scoreRows.push(judged.scores);
    const challenged = ruleChallenged || judged.user_challenged;
    challengedRows.push(challenged);
    const { level, average } = computeLevel(judged.scores, {
      trapEffective,
      challenged,
    });
    levels.push(level);
    averages.push(average);
    process.stdout.write('.');
  }
  process.stdout.write('\n\n');

  const challengedYes = challengedRows.filter(Boolean).length;
  console.log(`fixture: ${fx.label ?? fixturePath}`);
  console.log(
    `ruleChallenged=${ruleChallenged}  user_challenged(判):${challengedYes}/${runs}  trapEffective=${trapEffective}  runs=${runs}\n`,
  );
  console.log(
    pad('dimension', 20),
    pad('mean', 7),
    pad('sd', 6),
    pad('min', 5),
    pad('max', 5),
    pad('range', 6),
  );
  for (const k of KEYS) {
    const s = stats(scoreRows.map((r) => r[k]));
    console.log(
      pad(k, 20),
      pad(s.mean.toFixed(1), 7),
      pad(s.sd.toFixed(1), 6),
      pad(s.min, 5),
      pad(s.max, 5),
      pad(s.max - s.min, 6),
    );
  }
  const a = stats(averages);
  console.log(
    '\n' + pad('weighted avg', 20),
    pad(a.mean.toFixed(1), 7),
    pad(a.sd.toFixed(1), 6),
    pad(a.min, 5),
    pad(a.max, 5),
  );
  const dist = levels.reduce<Record<string, number>>((m, l) => {
    m[l] = (m[l] ?? 0) + 1;
    return m;
  }, {});
  console.log(
    'level 分佈:',
    Object.entries(dist)
      .sort()
      .map(([l, n]) => `${l}×${n}`)
      .join('  '),
  );
  console.log(
    '\n判讀：任一維度 sd > ~12 或 range > 30，或 level 跨 ≥3 級 →',
    '裁判太不穩，需加錨點 / 換更強模型 / 開 self-consistency（多跑取中位數）。',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
