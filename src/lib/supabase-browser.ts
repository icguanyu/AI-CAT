/**
 * 檔案：src/lib/supabase-browser.ts
 * 角色：前端層 — 瀏覽器端 Supabase client（單例）
 * 功能：給 Client Component 做 Google 登入（signInWithOAuth，PKCE）、
 *       取得 session。呼叫 /api/* 時帶 `Authorization: Bearer <access_token>`。
 *       只用 anon key；service_role 僅存在伺服器端 src/lib/supabase.ts。
 */
'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function createSupabaseBrowser(): SupabaseClient {
  if (client) return client;
  client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    },
  );
  return client;
}
