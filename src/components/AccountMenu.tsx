/**
 * 檔案：src/components/AccountMenu.tsx
 * 角色：前端層 — header 右上角的帳號選單
 * 功能：未登入顯示人像 icon → 下拉可切主題 / 用 Google 登入；
 *       已登入顯示頭像 → 下拉顯示名稱、主題切換、登出（我的檢測紀錄之後加）。
 *       亮 / 暗切換由選單內的 <ThemeToggle> 提供，不再單獨放 header。
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { ThemeToggle } from '@/components/ThemeToggle';
import { GoogleIcon } from '@/components/GoogleIcon';

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <path
        d="M4 20c0-4 3.6-6 8-6s8 2 8 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AccountMenu() {
  const sbRef = useRef<SupabaseClient | null>(null);
  const getSb = useCallback(() => {
    if (!sbRef.current) sbRef.current = createSupabaseBrowser();
    return sbRef.current;
  }, []);

  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    let sb: SupabaseClient;
    try {
      sb = getSb();
    } catch {
      setSession(null); // 設定未完成也照樣顯示（只是無法登入）
      return;
    }
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [getSb]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const signIn = useCallback(() => {
    const next = pathname || '/';
    void getSb().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }, [getSb, pathname]);

  const signOut = useCallback(async () => {
    setOpen(false);
    await getSb().auth.signOut();
  }, [getSb]);

  const user = session?.user;
  const meta = user?.user_metadata as
    | { full_name?: string; name?: string; avatar_url?: string; picture?: string }
    | undefined;
  const name = meta?.full_name || meta?.name || user?.email || '';
  const avatar = meta?.avatar_url || meta?.picture || '';

  return (
    <div className="acct" ref={rootRef}>
      <button
        type="button"
        className="acct-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="帳號選單"
        onClick={() => setOpen((v) => !v)}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="avatar"
            src={avatar}
            alt=""
            width={24}
            height={24}
            referrerPolicy="no-referrer"
          />
        ) : (
          <PersonIcon />
        )}
      </button>

      {open && (
        <div className="acct-menu" role="menu">
          {name && <div className="acct-name">{name}</div>}

          <div className="acct-row">
            <span className="mono-label">主題</span>
            <ThemeToggle />
          </div>

          <div className="acct-sep" />

          {user ? (
            <button
              type="button"
              className="acct-item"
              role="menuitem"
              onClick={signOut}
            >
              登出
            </button>
          ) : (
            <button
              type="button"
              className="acct-item"
              role="menuitem"
              onClick={signIn}
              disabled={session === undefined}
            >
              <GoogleIcon size={16} />
              使用 Google 登入
            </button>
          )}
        </div>
      )}
    </div>
  );
}
