/**
 * 檔案：src/components/TurnstileWidget.tsx
 * 角色：前端層 — Cloudflare Turnstile 小工具（免登入試用的人機驗證）
 * 功能：NEXT_PUBLIC_TURNSTILE_SITE_KEY 有設才渲染；載入 CF 腳本、render 一個
 *       interaction-only 的 widget，通過後把 token 交給 onVerify。沒設 → 不渲染。
 */
'use client';

import { useEffect, useRef } from 'react';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function turnstileEnabledClient(): boolean {
  return !!SITE_KEY;
}

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
      appearance?: string;
      theme?: string;
    },
  ) => string;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile script failed'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function TurnstileWidget({
  onVerify,
  onExpire,
}: {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    let widgetId: string | null = null;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !boxRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(boxRef.current, {
          sitekey: SITE_KEY,
          callback: (token) => onVerify(token),
          'expired-callback': () => {
            onVerify('');
            onExpire?.();
          },
          'error-callback': () => onVerify(''),
          appearance: 'interaction-only',
          theme: 'auto',
        });
      })
      .catch(() => {
        /* 腳本掛掉：後端 verifyTurnstile 服務不可用時也會放行 */
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          /* ignore */
        }
      }
    };
  }, [onVerify, onExpire]);

  if (!SITE_KEY) return null;
  return <div ref={boxRef} className="turnstile-box" />;
}
