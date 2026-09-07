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

export class SupabaseConfigError extends Error {}

export function createSupabaseBrowser(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new SupabaseConfigError(
      '前端 Supabase 環境變數未設定。請在 Vercel 專案 Settings → Environment Variables ' +
        '加上 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY（值取自 Supabase ' +
        'Project Settings → API），再重新部署。',
    );
  }

  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
  return client;
}
