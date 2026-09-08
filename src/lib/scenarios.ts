/**
 * 檔案：src/lib/scenarios.ts
 * 角色：領域層 — 情境題庫載入器
 * 功能：從 Supabase `scenarios` 表載入（active=true），記憶體快取 60 秒
 *       → 改題不用 redeploy。**沒有 env fallback**：載入失敗或無題目一律丟錯，
 *       由呼叫端回明確錯誤給前端。支援每題多個隨機變體。題目內容機密，不進版控。
 *
 * scenario 形狀（DB 欄位）：
 *   { brief, system, variants: [ { injectionText, correction?, brief? }, ... ] }
 * 舊形狀 { brief, system, injectionText } 仍相容（自動轉成單一 variant）。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { Scenario, ResolvedScenario } from '@/types/exam';

const TTL_MS = 60_000;
let cache: { at: number; data: Record<string, Scenario> } | null = null;

type RawScenario = {
  brief?: unknown;
  system?: unknown;
  injectionText?: unknown;
  variants?: unknown;
};

function normalize(id: string, raw: RawScenario): Scenario {
  if (typeof raw.brief !== 'string' || typeof raw.system !== 'string') {
    throw new Error(`情境題 ${id} 缺少 brief 或 system`);
  }
  let variants: Scenario['variants'];
  if (Array.isArray(raw.variants) && raw.variants.length > 0) {
    variants = raw.variants.map((v, i) => {
      const vv = v as {
        injectionText?: unknown;
        brief?: unknown;
        correction?: unknown;
        verifyHint?: unknown;
      };
      if (typeof vv.injectionText !== 'string') {
        throw new Error(`情境題 ${id} 變體 #${i} 缺少 injectionText`);
      }
      return {
        injectionText: vv.injectionText,
        ...(typeof vv.brief === 'string' ? { brief: vv.brief } : {}),
        ...(typeof vv.correction === 'string'
          ? { correction: vv.correction }
          : {}),
        ...(typeof vv.verifyHint === 'string'
          ? { verifyHint: vv.verifyHint }
          : {}),
      };
    });
  } else if (typeof raw.injectionText === 'string') {
    variants = [
      {
        injectionText: raw.injectionText,
        ...(typeof (raw as { correction?: unknown }).correction === 'string'
          ? { correction: (raw as { correction: string }).correction }
          : {}),
      },
    ];
  } else {
    throw new Error(`情境題 ${id} 需要 injectionText 或非空的 variants`);
  }
  return { brief: raw.brief, system: raw.system, variants };
}

/** 題庫載入失敗（可與「題庫為空」區分）。 */
export class ScenarioLoadError extends Error {}

/**
 * 本機開發覆寫：專案根目錄有 scenarios.local.json（已 gitignore）時，
 * 開發模式下「只用這個檔」，完全不碰 Supabase。形狀同 { [id]: Scenario }。
 */
function loadLocalOverride(): Record<string, Scenario> | null {
  if (process.env.NODE_ENV === 'production') return null;
  let raw: string;
  try {
    raw = readFileSync(join(process.cwd(), 'scenarios.local.json'), 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new ScenarioLoadError(
      `讀取 scenarios.local.json 失敗：${(e as Error).message}`,
    );
  }
  let parsed: Record<string, RawScenario>;
  try {
    parsed = JSON.parse(raw) as Record<string, RawScenario>;
  } catch {
    throw new ScenarioLoadError('scenarios.local.json 不是合法的 JSON');
  }
  return Object.fromEntries(
    Object.entries(parsed).map(([id, r]) => [id, normalize(id, r)]),
  );
}

async function load(): Promise<Record<string, Scenario>> {
  const local = loadLocalOverride();
  if (local) return local;

  let rows: unknown;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('scenarios')
      .select('id, brief, system, variants')
      .eq('active', true);
    if (error) {
      throw new ScenarioLoadError(`題庫載入失敗：${error.message}`);
    }
    rows = data;
  } catch (e) {
    if (e instanceof ScenarioLoadError) throw e;
    throw new ScenarioLoadError(
      `題庫載入失敗：無法連線 Supabase（${(e as Error).message}）`,
    );
  }

  if (!Array.isArray(rows)) {
    throw new ScenarioLoadError('題庫載入失敗：回應格式異常');
  }

  return Object.fromEntries(
    rows.map((row) => {
      const r = row as { id: string } & RawScenario;
      return [r.id, normalize(r.id, r)];
    }),
  );
}

export async function getScenarios(): Promise<Record<string, Scenario>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const data = await load();
  // 空題庫不快取，讓下一次請求重試（剛建好還沒灌資料的情況）
  if (Object.keys(data).length > 0) cache = { at: Date.now(), data };
  return data;
}

export async function getScenario(id: string): Promise<Scenario> {
  const scenario = (await getScenarios())[id];
  if (!scenario) throw new Error(`未知情境題：${id}`);
  return scenario;
}

export async function listScenarioIds(): Promise<string[]> {
  return Object.keys(await getScenarios());
}

function flatten(
  id: string,
  scenario: Scenario,
  variantIndex: number,
): ResolvedScenario {
  const idx = scenario.variants[variantIndex] ? variantIndex : 0;
  const variant = scenario.variants[idx];
  return {
    scenarioId: id,
    variantIndex: idx,
    brief: variant.brief ?? scenario.brief,
    system: scenario.system,
    injectionText: variant.injectionText,
    correction: variant.correction ?? '',
    verifyHint: variant.verifyHint ?? '',
  };
}

/** 開始測驗時呼叫：隨機挑一個變體。 */
export async function resolveScenario(id: string): Promise<ResolvedScenario> {
  const scenario = await getScenario(id);
  const variantIndex = Math.floor(Math.random() * scenario.variants.length);
  return flatten(id, scenario, variantIndex);
}

/** 後續回合 / 評分時呼叫：用 ExamState 存的 variantIndex 還原同一個變體。 */
export async function getScenarioVariant(
  id: string,
  variantIndex: number,
): Promise<ResolvedScenario> {
  return flatten(id, await getScenario(id), variantIndex);
}
