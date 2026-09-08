/**
 * 檔案：src/app/auth/callback/page.tsx  →  路由 /auth/callback
 * 角色：前端層 — Google OAuth 導回落點
 * 功能：Supabase client（detectSessionInUrl）會自動用網址上的 code 換 session，
 *       這裡等 session 就緒後導向 next（預設 /exam）；逾時則回首頁。
 */
'use client';

import { useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

/** 只允許站內相對路徑，擋開放重導。 */
function safeNext(): string {
  try {
    const n = new URLSearchParams(window.location.search).get('next');
    if (n && n.startsWith('/') && !n.startsWith('//')) return n;
  } catch {
    /* ignore */
  }
  return '/exam';
}

export default function AuthCallbackPage() {
  useEffect(() => {
    let supabase;
    const dest = safeNext();
    try {
      supabase = createSupabaseBrowser();
    } catch {
      window.location.replace('/exam'); // /exam 會顯示設定錯誤說明
      return;
    }
    const goNext = () => window.location.replace(dest);

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) goNext();
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goNext();
    });
    const timeout = setTimeout(() => window.location.replace('/?auth=failed'), 8000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <main className="exam-wrap">
      <div className="center-card">
        <p>登入中…</p>
      </div>
    </main>
  );
}
