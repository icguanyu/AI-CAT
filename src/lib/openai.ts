/**
 * 檔案：src/lib/openai.ts
 * 角色：基礎設施層 — LLM provider 單一出口
 * 功能：re-export Vercel AI SDK 的 OpenAI provider（自動讀 OPENAI_API_KEY）。
 *       未來要換 baseURL / 組織 / Azure / 相容端點，只改這一個檔。
 *       沙盒對話與裁判都透過 openai(model) 取得模型實例。
 */
export { openai } from '@ai-sdk/openai';
