/**
 * 檔案：src/app/admin/AdminGate.tsx
 * 角色：前端層 — /admin 共用外殼：登入檢查 + 導覽列
 * 功能：只驗證「有沒有登入」；是不是後台管理員由每支 /api/admin/* 自己判斷
 *       （client 端拿不到 ADMIN_EMAILS），不是管理員時個別頁面會顯示 403。
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import styles from './admin.module.css';

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const sbRef = useRef<SupabaseClient | null>(null);
  const getSb = useCallback(() => {
    if (!sbRef.current) sbRef.current = createSupabaseBrowser();
    return sbRef.current;
  }, []);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    let sb: SupabaseClient;
    try {
      sb = getSb();
    } catch (e) {
      setConfigError((e as Error).message);
      return;
    }
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [getSb]);

  const signIn = useCallback(() => {
    void getSb().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/admin')}`,
      },
    });
  }, [getSb]);

  if (configError) {
    return (
      <div className={styles.wrap}>
        <p className={styles.state}>設定尚未完成：{configError}</p>
      </div>
    );
  }

  if (session === undefined) {
    return (
      <div className={styles.wrap}>
        <p className={styles.state}>載入中…</p>
      </div>
    );
  }

  if (session === null) {
    return (
      <div className={styles.wrap}>
        <p className={styles.state}>
          這是後台，需要登入且在管理員名單內。
          <button
            type="button"
            className={styles.btn}
            style={{ marginLeft: 10 }}
            onClick={signIn}
          >
            使用 Google 登入
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <nav className={styles.nav}>
        <span className={styles.brand}>AI-CAT ADMIN</span>
        <Link className={styles.navLink} href="/admin">
          總覽
        </Link>
        <Link className={styles.navLink} href="/admin/exams">
          測驗查詢
        </Link>
        <Link className={styles.navLink} href="/admin/users">
          帳號查詢
        </Link>
        <Link className={styles.navLink} href="/admin/scenarios">
          題庫健檢
        </Link>
        <span className={styles.navSpacer} />
        <Link className={styles.navLink} href="/">
          回前台
        </Link>
      </nav>
      {children}
    </div>
  );
}
