/**
 * 檔案：src/lib/model.ts
 * 角色：基礎設施層 — 依模型名字串挑選 LLM provider
 * 功能：`claude*` → Anthropic（需 ANTHROPIC_API_KEY）；其餘（`gpt*` / `o1*` …）→ OpenAI。
 *       讓 SANDBOX_MODEL / JUDGE_MODEL / EXEMPLAR_MODEL 三個 env 之一改成
 *       `claude-opus-5`、`claude-sonnet-5` 等即可切換，呼叫端不必動。
 */
import type { LanguageModelV1 } from 'ai';
import { openai } from '@/lib/openai';
import { anthropic } from '@/lib/anthropic';

export function resolveModel(id: string): LanguageModelV1 {
  return id.startsWith('claude') ? anthropic(id) : openai(id);
}
