/**
 * 檔案：src/lib/scenarios.ts
 * 角色：領域層 — 情境題庫載入器
 * 功能：從環境變數 SCENARIOS_JSON 解析出「考題」，並支援每題多個隨機變體。
 *       題目內容為機密，不進版控；此檔只有載入 / 挑選 / 攤平邏輯。
 *
 * SCENARIOS_JSON 形狀（新）：
 *   { "<id>": { "brief": "...", "system": "...",
 *               "variants": [ { "injectionText": "...", "brief"?: "..." }, ... ] } }
 * 舊形狀 `{ brief, system, injectionText }` 會自動轉成單一 variant。
 */
import { getEnv } from '@/lib/env';
import type { Scenario, ResolvedScenario } from '@/types/exam';

let cache: Record<string, Scenario> | null = null;

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

export function getScenarios(): Record<string, Scenario> {
  if (cache) return cache;
  let parsed: Record<string, RawScenario>;
  try {
    parsed = JSON.parse(getEnv().SCENARIOS_JSON) as Record<string, RawScenario>;
  } catch {
    throw new Error('SCENARIOS_JSON 不是合法的 JSON');
  }
  cache = Object.fromEntries(
    Object.entries(parsed).map(([id, raw]) => [id, normalize(id, raw)]),
  );
  return cache;
}

export function getScenario(id: string): Scenario {
  const scenario = getScenarios()[id];
  if (!scenario) throw new Error(`未知情境題：${id}`);
  return scenario;
}

export function listScenarioIds(): string[] {
  return Object.keys(getScenarios());
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
export function resolveScenario(id: string): ResolvedScenario {
  const scenario = getScenario(id);
  const variantIndex = Math.floor(Math.random() * scenario.variants.length);
  return flatten(id, scenario, variantIndex);
}

/** 後續回合 / 評分時呼叫：用 ExamState 存的 variantIndex 還原同一個變體。 */
export function getScenarioVariant(
  id: string,
  variantIndex: number,
): ResolvedScenario {
  return flatten(id, getScenario(id), variantIndex);
}
