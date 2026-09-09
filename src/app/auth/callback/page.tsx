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
    <main className="auth-callback-wrap">
      <div className="thinking-cat" role="status" aria-label="登入中">
        <div className="thinking-cat__avatar">
          <svg
            viewBox="-8 -4 116 104"
            className="thinking-cat__svg"
            aria-hidden="true"
            focusable="false"
          >
            <g fill="none" stroke="currentColor" strokeWidth={6.5} strokeLinejoin="round">
              <polygon
                points="12,39.6 5,9 33,21"
                style={{ transformOrigin: '16px 38px' }}
                className="tc-earL"
              />
              <polygon
                points="88,39.6 95,9 67,21"
                style={{ transformOrigin: '84px 38px' }}
                className="tc-earR"
              />
              <polygon points="50,12 88,39.6 73.5,84.4 26.5,84.4 12,39.6" />
            </g>
            <g className="tc-blink" style={{ transformOrigin: '50px 48px' }}>
              <circle cx="37" cy="48" r="4.5" fill="currentColor" />
              <circle cx="63" cy="48" r="4.5" fill="currentColor" />
            </g>
            <g stroke="currentColor" strokeWidth={4.5} strokeLinecap="round">
              <g className="tc-whiskL">
                <line x1="-3" y1="58" x2="15" y2="58" />
                <line x1="-1" y1="69" x2="18" y2="69" />
              </g>
              <g className="tc-whiskR">
                <line x1="103" y1="58" x2="85" y2="58" />
                <line x1="101" y1="69" x2="82" y2="69" />
              </g>
            </g>
          </svg>
        </div>
        <div className="thinking-cat__body">
          <div className="thinking-cat__line">
            <span className="thinking-cat__text">登入中</span>
            <span className="thinking-cat__dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>
          <span className="thinking-cat__sub">AUTHENTICATING</span>
        </div>
      </div>
    </main>
  );
}
