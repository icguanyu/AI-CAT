/**
 * 檔案：src/lib/env.ts
 * 角色：基礎設施層 — 環境變數驗證閘門
 * 功能：用 Zod 檢查所有伺服器端必要的金鑰／URL（OpenAI、Supabase、Upstash…）。
 *       getEnv() 延遲驗證並快取，缺項時丟出可讀錯誤，指向 .env.example。
 */
import { z } from 'zod';

/**
 * 伺服器端環境變數。以 getEnv() 延遲驗證，避免在缺少 .env 的情況下
 * 讓 `next build` 直接失敗（route handler 執行時才會呼叫）。
 */
const serverSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, '未設定'),
  ANTHROPIC_API_KEY: z.string().optional(),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1, '未設定'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, '未設定'),

  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, '未設定'),

  SCENARIOS_JSON: z.string().default('{}'),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => ` - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`環境變數設定不完整：\n${detail}\n請參考 .env.example`);
  }
  cached = parsed.data;
  return cached;
}
