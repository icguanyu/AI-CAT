/**
 * 檔案：scripts/import-scenarios.ts
 * 角色：開發工具 — 把本機題庫檔（scenarios.local.json）匯入 Supabase `scenarios` 表
 * 功能：讀 JSON → 逐題 upsert（以 id 為主鍵）到 Supabase PostgREST。用 service_role
 *       金鑰，繞過 RLS。變體陣列（含 injectionText / correction / verifyHint …）原樣
 *       寫入 jsonb。直接打 REST，不經 @supabase/supabase-js（省得踩 Node 的 WebSocket）。
 *
 * 用法：
 *   npm run scenarios:import                       # 匯入 scenarios.local.json
 *   npm run scenarios:import -- path/to/other.json # 指定檔案
 *   npm run scenarios:import -- --dry              # 只印會做什麼，不寫入
 *   npm run scenarios:import -- --prune            # 檔案裡沒有的既有題目設為 active=false
 *
 * 需要 .env.local（或環境變數）有：SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY。
 */
import { readFileSync } from 'node:fs';

/** 自己讀 .env.local（CRLF 安全），不依賴 tsx --env-file。 */
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

type RawVariant = { injectionText?: unknown };
type RawScenario = {
  brief?: unknown;
  system?: unknown;
  variants?: unknown;
  category?: unknown;
  note?: unknown;
};

interface Row {
  id: string;
  brief: string;
  system: string;
  variants: unknown[];
  active: true;
  category: string | null;
  note: string | null;
}

function toRow(id: string, raw: RawScenario): Row {
  if (typeof raw.brief !== 'string' || raw.brief.trim() === '') {
    throw new Error(`題目 ${id}：brief 缺少或非字串`);
  }
  if (typeof raw.system !== 'string' || raw.system.trim() === '') {
    throw new Error(`題目 ${id}：system 缺少或非字串`);
  }
  if (!Array.isArray(raw.variants) || raw.variants.length === 0) {
    throw new Error(`題目 ${id}：variants 需為非空陣列`);
  }
  raw.variants.forEach((v, i) => {
    if (typeof (v as RawVariant).injectionText !== 'string') {
      throw new Error(`題目 ${id} 變體 #${i}：injectionText 缺少或非字串`);
    }
  });
  return {
    id,
    brief: raw.brief,
    system: raw.system,
    variants: raw.variants,
    active: true,
    category: typeof raw.category === 'string' ? raw.category : null,
    note: typeof raw.note === 'string' ? raw.note : null,
  };
}

async function main() {
  loadEnvLocal();

  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const prune = args.includes('--prune');
  const path = args.find((a) => !a.startsWith('--')) ?? 'scenarios.local.json';

  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    console.error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY（放 .env.local）');
    process.exit(1);
  }
  const rest = `${base}/rest/v1/scenarios`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<
    string,
    RawScenario
  >;
  const rows = Object.entries(parsed).map(([id, raw]) => toRow(id, raw));

  console.log(`來源：${path}  →  ${new URL(base).host}`);
  for (const r of rows) {
    console.log(
      `  ${r.id}  變體 ${r.variants.length}  category=${r.category ?? '-'}` +
        `  brief ${r.brief.length} 字  system ${r.system.length} 字`,
    );
  }

  // 現有題目（比對「檔案裡沒有的」）
  const listRes = await fetch(`${rest}?select=id,active`, { headers });
  if (!listRes.ok) {
    console.error(`讀取現有題目失敗：${listRes.status} ${await listRes.text()}`);
    process.exit(1);
  }
  const existing = (await listRes.json()) as { id: string; active: boolean }[];
  const fileIds = new Set(rows.map((r) => r.id));
  const orphans = existing.map((r) => r.id).filter((id) => !fileIds.has(id));
  if (orphans.length) {
    console.log(
      `\n檔案裡沒有、但資料庫已存在的題目：${orphans.join(', ')}` +
        (prune
          ? '（--prune：將設為 active=false）'
          : '（保持不動；加 --prune 可停用）'),
    );
  }

  if (dry) {
    console.log('\n--dry：不寫入。');
    return;
  }

  // upsert：Prefer resolution=merge-duplicates → 以主鍵 id 衝突時更新
  const upRes = await fetch(rest, {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!upRes.ok) {
    console.error(`\nupsert 失敗：${upRes.status} ${await upRes.text()}`);
    process.exit(1);
  }
  console.log(`\n已 upsert ${rows.length} 題。`);

  if (prune && orphans.length) {
    const q = `id=in.(${orphans.map(encodeURIComponent).join(',')})`;
    const pruneRes = await fetch(`${rest}?${q}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ active: false }),
    });
    if (!pruneRes.ok) {
      console.error(
        `停用 orphan 題目失敗：${pruneRes.status} ${await pruneRes.text()}`,
      );
      process.exit(1);
    }
    console.log(`已把 ${orphans.length} 題設為 active=false。`);
  }

  const afterRes = await fetch(`${rest}?select=id&active=eq.true`, { headers });
  const after = (await afterRes.json()) as { id: string }[];
  console.log(`目前 active 題目：${after.map((r) => r.id).join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
