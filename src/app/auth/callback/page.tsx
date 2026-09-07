/**
 * 檔案：src/app/auth/callback/page.tsx  →  路由 /auth/callback
 * 角色：前端層 — Google OAuth 導回落點
 * 功能：Supabase client（detectSessionInUrl）會自動用網址上的 code 換 session，
 *       這裡等 session 就緒後導向 /exam；逾時則回首頁。
 */
'use client';

import { useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function AuthCallbackPage() {
  useEffect(() => {
    const supabase = createSupabaseBrowser();
    const goExam = () => window.location.replace('/exam');

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) goExam();
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goExam();
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
