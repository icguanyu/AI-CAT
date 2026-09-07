/**
 * 檔案：src/lib/supabase-browser.ts
 * 角色：前端層 — 瀏覽器端 Supabase client
 * 功能：給 Client Component 用來做 Google 登入（signInWithOAuth）與取得 session。
 *       前端呼叫 /api/* 時，要帶 `Authorization: Bearer <access_token>`，
 *       token 來自這裡的 session。UI 於 Phase 4 建立。
 *
 * 只用 anon key（瀏覽器可見）；service_role 僅存在於伺服器端 src/lib/supabase.ts。
 */
'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
