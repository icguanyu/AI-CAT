/**
 * 檔案：src/lib/openai.ts
 * 角色：基礎設施層 — LLM provider 單一出口
 * 功能：re-export Vercel AI SDK 的 OpenAI provider（自動讀 OPENAI_API_KEY）。
 *       另提供 publicOpenai：綁定「有月上限的公開試用 key」（OPENAI_API_ANON_KEY），
 *       只給免登入試用的沙盒對話用；沒設就退回主 key。
 *       未來要換 baseURL / 組織 / Azure / 相容端點，只改這一個檔。
 */
import { createOpenAI } from '@ai-sdk/openai';

export { openai } from '@ai-sdk/openai';

/** 免登入試用專用的 OpenAI provider（獨立 key，額度用完不影響正式服務）。 */
export const publicOpenai = createOpenAI({
  apiKey:
    process.env.OPENAI_API_ANON_KEY ||
    process.env.OPENAI_API_KEY_PUBLIC ||
    process.env.OPENAI_API_KEY,
});
