/**
 * 檔案：src/app/me/page.tsx  →  /me
 * 角色：前端層 — 個人檢測歷史列表
 * 功能：驗證登入 → GET /api/me/exams → 逐列（標題 · 日期 · L 分級 · 五維迷你條 ·
 *       分類 / 熟悉度標籤）→ 點列進 /exam/result/:examId。綜合分數彙總留待 P2。
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { getMyExams, type ExamListItem } from '@/lib/client-api';
import { AccountMenu } from '@/components/AccountMenu';
import { AiCatMark } from '@/components/AiCatMark';
import {
  CATEGORY_LABEL,
  FAMILIARITY_LABEL,
  type Report,
} from '@/types/exam';

const DIM_ORDER: (keyof Report['scores'])[] = [
  'prompt_structure',
  'decomposition',
  'efficiency',
  'critical_thinking',
  'task_completion',
];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export default function MyExamsPage() {
  const sbRef = useRef<SupabaseClient | null>(null);
  const getSb = useCallback(() => {
    if (!sbRef.current) sbRef.current = createSupabaseBrowser();
    return sbRef.current;
  }, []);

  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [exams, setExams] = useState<ExamListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let sb: SupabaseClient;
    try {
      sb = getSb();
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [getSb]);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    getMyExams()
      .then((r) => alive && setExams(r))
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : '讀取檢測紀錄失敗');
      });
    return () => {
      alive = false;
    };
  }, [session]);

  const signIn = useCallback(() => {
    void getSb().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/me')}`,
      },
    });
  }, [getSb]);

  const Header = (
    <header className="result-topbar">
      <Link href="/" className="topbar-brand" aria-label="AI-CAT 首頁">
        <AiCatMark size={18} />
      </Link>
      <AccountMenu />
    </header>
  );

  if (error) {
    return (
      <main className="exam-wrap">
        {Header}
        <div className="center-card panel">
          <h2>無法顯示紀錄</h2>
          <p className="section-sub">{error}</p>
          <Link className="btn ghost" href="/exam">
            回到檢測
          </Link>
        </div>
      </main>
    );
  }

  if (session === null) {
    return (
      <main className="exam-wrap">
        {Header}
        <div className="center-card panel">
          <h2>請先登入</h2>
          <p className="section-sub">登入後即可查看你的檢測紀錄。</p>
          <button type="button" className="btn" onClick={signIn}>
            使用 Google 登入
          </button>
        </div>
      </main>
    );
  }

  if (session === undefined || exams === null) {
    return (
      <main className="exam-wrap">
        {Header}
        <div className="center-card">
          <p>載入中…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="exam-wrap">
      {Header}
      <div className="me-view">
        <div className="me-head">
          <h1 className="result-title">我的檢測紀錄</h1>
          <span className="mono-label">{exams.length} 場</span>
        </div>

        {exams.length === 0 ? (
          <div className="center-card panel">
            <p className="section-sub">還沒有任何紀錄。</p>
            <Link className="btn" href="/exam">
              開始第一次檢測
            </Link>
          </div>
        ) : (
          <ul className="me-list">
            {exams.map((e) => (
              <li key={e.examId}>
                <Link className="me-row" href={`/exam/result/${e.examId}`}>
                  <span className="me-lv">{e.suggestedLevel}</span>
                  <span className="me-main">
                    <span className="me-title">
                      {e.titleZh ?? '（未命名情境）'}
                    </span>
                    <span className="me-tags">
                      {e.category && (
                        <span className="me-chip">
                          {CATEGORY_LABEL[e.category]}
                        </span>
                      )}
                      {e.familiarity && (
                        <span className="me-chip ghost">
                          {FAMILIARITY_LABEL[e.familiarity]}
                        </span>
                      )}
                      {e.shared && <span className="me-chip ghost">已分享</span>}
                    </span>
                    <span className="me-bars" aria-hidden="true">
                      {DIM_ORDER.map((k) => (
                        <span key={k}>
                          <span style={{ height: `${e.scores[k]}%` }} />
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="me-side">
                    <span className="me-score">{e.weightedAverage}</span>
                    <span className="me-date">{fmtDate(e.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link className="btn ghost" href="/exam" style={{ marginTop: 8 }}>
          再測一次
        </Link>
      </div>
    </main>
  );
}
