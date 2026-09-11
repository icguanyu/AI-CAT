/**
 * 檔案：src/app/exam/result/[examId]/page.tsx  →  /exam/result/:examId
 * 角色：前端層 — 已提交測驗的結果頁（可重新整理、可產生分享連結）
 * 功能：驗證登入 → GET /api/exam/:examId/report 取回本人報告 → <ReportView>。
 *       未登入導去登入並帶 next 參數；403 / 404 給明確訊息。
 *       「建立分享連結」呼叫 /api/exam/:examId/share，公開卡片只含非機密欄位。
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageLoading } from '@/components/PageLoading';
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import {
  getExamReport,
  setExamShared,
  type ReportBundle,
} from '@/lib/client-api';
import { ReportView } from '@/components/ReportView';
import { AccountMenu } from '@/components/AccountMenu';
import { AiCatMark } from '@/components/AiCatMark';

export default function ResultPage() {
  const params = useParams<{ examId: string }>();
  const examId = params.examId;

  const sbRef = useRef<SupabaseClient | null>(null);
  const getSb = useCallback(() => {
    if (!sbRef.current) sbRef.current = createSupabaseBrowser();
    return sbRef.current;
  }, []);

  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [bundle, setBundle] = useState<ReportBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);

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
    if (!session || !examId) return;
    let alive = true;
    getExamReport(examId)
      .then((b) => alive && setBundle(b))
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : '讀取報告失敗');
      });
    return () => {
      alive = false;
    };
  }, [session, examId]);

  const signIn = useCallback(() => {
    const next = `/exam/result/${examId}`;
    void getSb().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }, [getSb, examId]);

  const sessionName = useMemo(() => {
    const m = session?.user.user_metadata as
      | Record<string, unknown>
      | undefined;
    const pick = (v: unknown) =>
      typeof v === 'string' && v.trim() ? v.trim() : null;
    return pick(m?.full_name) ?? pick(m?.name) ?? null;
  }, [session]);

  const shareUrl = useMemo(
    () =>
      typeof window !== 'undefined' ? `${window.location.origin}/s/${examId}` : '',
    [examId],
  );

  const toggleShare = useCallback(async () => {
    if (!bundle) return;
    setShareBusy(true);
    try {
      const r = await setExamShared(examId, !bundle.shared);
      setBundle({ ...bundle, shared: r.shared });
    } catch (e) {
      setError(e instanceof Error ? e.message : '變更分享狀態失敗');
    } finally {
      setShareBusy(false);
    }
  }, [bundle, examId]);

  const Header = (
    <header className="result-topbar">
      <Link href="/" className="topbar-brand" aria-label="AI-CAT 首頁">
        <AiCatMark size={18} />
      </Link>
      <AccountMenu />
    </header>
  );

  if (error) {
    const isAuth = error.includes('登入');
    return (
      <main className="exam-wrap">
        {Header}
        <div className="center-card panel">
          <h2>{isAuth ? '請先登入' : '無法顯示報告'}</h2>
          <p className="section-sub">{error}</p>
          {isAuth ? (
            <button type="button" className="btn" onClick={signIn}>
              使用 Google 登入
            </button>
          ) : (
            <Link className="btn ghost" href="/exam">
              回到檢測
            </Link>
          )}
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
          <p className="section-sub">登入後即可查看你的檢測結果。</p>
          <button type="button" className="btn" onClick={signIn}>
            使用 Google 登入
          </button>
        </div>
      </main>
    );
  }

  if (session === undefined || !bundle) {
    return (
      <main className="exam-wrap">
        {Header}
        <div className="center-card">
          <PageLoading />
        </div>
      </main>
    );
  }

  return (
    <main className="exam-wrap">
      {Header}
      <ReportView
        report={bundle.report}
        trap={bundle.trap}
        exemplar={bundle.exemplar}
        name={bundle.name ?? sessionName}
        familiarity={bundle.familiarity}
        transcript={bundle.transcript}
        share={{
          shared: bundle.shared,
          url: shareUrl,
          busy: shareBusy,
          onToggle: toggleShare,
        }}
      />
      <div className="report-view" style={{ marginTop: 16 }}>
        <Link className="btn ghost" href="/exam">
          再測一次
        </Link>
      </div>
    </main>
  );
}
