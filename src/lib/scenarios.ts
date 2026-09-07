/**
 * 檔案：src/lib/scenarios.ts
 * 角色：領域層 — 情境題庫載入器
 * 功能：優先從 Supabase `scenarios` 表載入（active=true），記憶體快取 60 秒
 *       → 改題不用 redeploy。表為空 / 讀取失敗時，回退到環境變數 SCENARIOS_JSON。
 *       支援每題多個隨機變體。題目內容機密，不進版控。
 *
 * scenario 形狀（DB 欄位 / SCENARIOS_JSON value 相同）：
 *   { brief, system, variants: [ { injectionText, correction?, brief? }, ... ] }
 * 舊形狀 { brief, system, injectionText } 自動轉成單一 variant。
 */
import { getEnv } from '@/lib/env';
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

function fromEnv(): Record<string, Scenario> {
  let parsed: Record<string, RawScenario>;
  try {
    parsed = JSON.parse(getEnv().SCENARIOS_JSON) as Record<string, RawScenario>;
  } catch {
    throw new Error('SCENARIOS_JSON 不是合法的 JSON，且 Supabase scenarios 表無資料');
  }
  return Object.fromEntries(
    Object.entries(parsed).map(([id, raw]) => [id, normalize(id, raw)]),
  );
}

async function load(): Promise<Record<string, Scenario>> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('scenarios')
      .select('id, brief, system, variants')
      .eq('active', true);
    if (!error && Array.isArray(data) && data.length > 0) {
      return Object.fromEntries(
        data.map((row) => {
          const r = row as { id: string } & RawScenario;
          return [r.id, normalize(r.id, r)];
        }),
      );
    }
  } catch {
    /* DB 不可用 → 回退到 env */
  }
  return fromEnv();
}

export async function getScenarios(): Promise<Record<string, Scenario>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const data = await load();
  cache = { at: Date.now(), data };
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
