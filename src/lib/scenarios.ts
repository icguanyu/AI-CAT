/**
 * 檔案：src/lib/scenarios.ts
 * 角色：領域層 — 情境題庫載入器
 * 功能：從環境變數 SCENARIOS_JSON 解析出「考題」（brief / system / injectionText）。
 *       題目內容為機密，不進版控；此檔只有載入與查詢邏輯（getScenario / listScenarioIds）。
 */
import { getEnv } from '@/lib/env';
import type { Scenario } from '@/types/exam';

/**
 * 情境題庫。內容為機密「考題」，不進版控：
 * 由環境變數 SCENARIOS_JSON（一段 JSON 字串）注入。
 *
 * 形狀：{ [scenarioId]: { brief, system, injectionText } }
 */
let cache: Record<string, Scenario> | null = null;

export function getScenarios(): Record<string, Scenario> {
  if (cache) return cache;
  const raw = getEnv().SCENARIOS_JSON;
  try {
    cache = JSON.parse(raw) as Record<string, Scenario>;
  } catch {
    throw new Error('SCENARIOS_JSON 不是合法的 JSON');
  }
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
