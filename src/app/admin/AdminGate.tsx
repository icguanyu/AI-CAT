/**
 * 檔案：src/app/admin/AdminGate.tsx
 * 角色：前端層 — /admin 共用外殼：登入檢查 + 導覽列 + 角色分級
 * 功能：登入後打 /api/admin/whoami 拿角色。role === 'reviewer'（標註員，非完整管理員）：
 *       導覽列只留「標註審核」跟「回前台」，且只要網址不是 /admin/review 開頭就直接導回去
 *       （就算手動打網址也一樣）。完整管理員專用 API（總覽/測驗/帳號/題庫）本身也用
 *       requireAdmin 守門，標註員就算硬進去也拿不到資料。
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { getWhoAmI, AdminApiError, type WhoAmI } from '@/lib/admin-client';
import styles from './admin.module.css';

const FONT_SCALE_KEY = 'ai_cat_admin_font_scale';
const FONT_SCALE_MIN = 0.8;
const FONT_SCALE_MAX = 1.6;
const FONT_SCALE_STEP = 0.1;

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const sbRef = useRef<SupabaseClient | null>(null);
  const getSb = useCallback(() => {
    if (!sbRef.current) sbRef.current = createSupabaseBrowser();
    return sbRef.current;
  }, []);
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [configError, setConfigError] = useState<string | null>(null);
  const [who, setWho] = useState<WhoAmI | null | undefined>(undefined);
  const [whoError, setWhoError] = useState<string | null>(null);
  const [fontScale, setFontScale] = useState(1);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(FONT_SCALE_KEY));
      if (Number.isFinite(saved) && saved >= FONT_SCALE_MIN && saved <= FONT_SCALE_MAX) {
        setFontScale(saved);
      }
    } catch {
      // 無痕視窗等拿不到 localStorage 就用預設 100%
    }
  }, []);

  const adjustFontScale = useCallback((delta: number) => {
    setFontScale((prev) => {
      const next =
        Math.round(Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, prev + delta)) * 100) / 100;
      try {
        localStorage.setItem(FONT_SCALE_KEY, String(next));
      } catch {
        // 存不了就只在這次瀏覽有效
      }
      return next;
    });
  }, []);

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

  useEffect(() => {
    if (!session) {
      setWho(undefined);
      return;
    }
    let alive = true;
    getWhoAmI()
      .then((w) => alive && setWho(w))
      .catch((e: unknown) => {
        if (!alive) return;
        setWho(null);
        setWhoError(
          e instanceof AdminApiError && e.forbidden
            ? '這個帳號沒有後台權限（不在 ADMIN_EMAILS 或 REVIEWER_EMAILS 內）。'
            : e instanceof Error
              ? e.message
              : '讀取失敗',
        );
      });
    return () => {
      alive = false;
    };
  }, [session]);

  useEffect(() => {
    if (who?.role === 'reviewer' && !pathname.startsWith('/admin/review')) {
      router.replace('/admin/review');
    }
  }, [who, pathname, router]);

  const signIn = useCallback(() => {
    void getSb().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/admin')}`,
      },
    });
  }, [getSb]);

  // zoom 縮放整個後台（不會像 transform 那樣打斷 sticky／fixed 定位）。
  const wrapStyle: React.CSSProperties = { zoom: fontScale };

  if (configError) {
    return (
      <div className={styles.wrap} style={wrapStyle}>
        <p className={styles.state}>設定尚未完成：{configError}</p>
      </div>
    );
  }

  if (session === undefined) {
    return (
      <div className={styles.wrap} style={wrapStyle}>
        <p className={styles.state}>載入中…</p>
      </div>
    );
  }

  if (session === null) {
    return (
      <div className={styles.wrap} style={wrapStyle}>
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

  if (who === undefined) {
    return (
      <div className={styles.wrap} style={wrapStyle}>
        <p className={styles.state}>載入中…</p>
      </div>
    );
  }

  if (who === null) {
    return (
      <div className={styles.wrap} style={wrapStyle}>
        <p className={styles.state}>{whoError}</p>
      </div>
    );
  }

  const isReviewerOnly = who.role === 'reviewer';

  return (
    <div className={styles.wrap} style={wrapStyle}>
      <nav className={styles.nav}>
        <span className={styles.brand}>AI-CAT ADMIN</span>
        {!isReviewerOnly && (
          <>
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
          </>
        )}
        <Link className={styles.navLink} href="/admin/review">
          標註審核
        </Link>
        <span className={styles.navSpacer} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            className={styles.btn}
            style={{ padding: '3px 8px' }}
            aria-label="縮小字體"
            title="縮小字體"
            onClick={() => adjustFontScale(-FONT_SCALE_STEP)}
          >
            A-
          </button>
          <span style={{ fontSize: 11, color: '#56534b', minWidth: 34, textAlign: 'center' }}>
            {Math.round(fontScale * 100)}%
          </span>
          <button
            type="button"
            className={styles.btn}
            style={{ padding: '3px 8px' }}
            aria-label="放大字體"
            title="放大字體"
            onClick={() => adjustFontScale(FONT_SCALE_STEP)}
          >
            A+
          </button>
        </div>
        <Link className={styles.navLink} href="/">
          回前台
        </Link>
      </nav>
      {!isReviewerOnly || pathname.startsWith('/admin/review') ? children : null}
    </div>
  );
}
