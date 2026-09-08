/**
 * 檔案：src/lib/anthropic.ts
 * 角色：基礎設施層 — Anthropic (Claude) LLM provider 單一出口
 * 功能：re-export Vercel AI SDK 的 Anthropic provider（自動讀 ANTHROPIC_API_KEY）。
 *       與 openai.ts 對稱；透過 resolveModel()（src/lib/model.ts）依模型名選用。
 */
export { anthropic } from '@ai-sdk/anthropic';
