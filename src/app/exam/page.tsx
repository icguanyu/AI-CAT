/**
 * 檔案：src/app/exam/page.tsx  →  路由 /exam
 * 角色：前端層 — 測驗主流程（Client Component）
 * 功能：Google 登入 → 開始檢測（/api/exam/start）→ 雙欄沙盒（左任務、右對話，
 *       串流 /api/chat）→ 提交評分（/api/evaluate）→ 顯示能力報告。
 *       另：開始畫面顯示已完成次數；API 回 401 時引導重新登入。
 *
 * Supabase client 只在瀏覽器端（useEffect / 事件處理，透過 getSb()）建立，
 * 避免 SSR 靜態外殼渲染時因缺少 NEXT_PUBLIC_ 環境變數而失敗。
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import type { Report, TrapReveal } from '@/types/exam';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import {
  getQuota,
  startExam,
  sendChat,
  evaluateExam,
  ApiError,
  type Quota,
  type StartResult,
  type FixtureDebug,
} from '@/lib/client-api';
import { readTextStream } from '@/lib/data-stream';
import { Markdown } from '@/components/Markdown';
import { ThemeToggle } from '@/components/ThemeToggle';
import { GoogleIcon } from '@/components/GoogleIcon';
import { AiCatMark } from '@/components/AiCatMark';

type Msg = { role: 'user' | 'assistant'; content: string };
type Phase = 'idle' | 'chatting' | 'evaluating' | 'done';

const METRIC_LABELS: Record<keyof Report['scores'], string> = {
  prompt_structure: '提示詞結構',
  decomposition: '問題拆解力',
  efficiency: '對話效率',
  critical_thinking: '批判思考',
  task_completion: '任務達成率',
};

/** 本地開發用：把場次資料存成 scripts/fixtures/ 吃的 JSON 檔。 */
const DEV = process.env.NODE_ENV !== 'production';
function downloadFixture(dbg: FixtureDebug) {
  const blob = new Blob([JSON.stringify(dbg, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fixture-${dbg.scenarioId}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExamPage() {
  const sbRef = useRef<SupabaseClient | null>(null);
  const getSb = useCallback(() => {
    if (!sbRef.current) sbRef.current = createSupabaseBrowser();
    return sbRef.current;
  }, []);

  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    let supabase: SupabaseClient;
    try {
      supabase = getSb();
    } catch (e) {
      setConfigError((e as Error).message);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s),
    );
    return () => sub.subscription.unsubscribe();
  }, [getSb]);

  const [phase, setPhase] = useState<Phase>('idle');
  const [exam, setExam] = useState<StartResult | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [userTurns, setUserTurns] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authExpired, setAuthExpired] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [trap, setTrap] = useState<TrapReveal | null>(null);
  const [exemplar, setExemplar] = useState('');
  const [dbg, setDbg] = useState<FixtureDebug | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // textarea 隨內容自動增高（上限 180px 後改捲動）
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input, phase]);

  const refreshQuota = useCallback(() => {
    getQuota()
      .then(setQuota)
      .catch(() => {
        /* 次數顯示失敗不擋流程 */
      });
  }, []);

  // 登入後、以及每次回到開始/報告畫面，更新次數顯示
  useEffect(() => {
    if (session) refreshQuota();
  }, [session, refreshQuota]);
  useEffect(() => {
    if (session && (phase === 'idle' || phase === 'done')) refreshQuota();
  }, [phase, session, refreshQuota]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  const handleErr = useCallback((e: unknown) => {
    const message = e instanceof Error ? e.message : '發生未預期錯誤';
    setError(message);
    if (e instanceof ApiError && e.isAuth) setAuthExpired(true);
  }, []);

  const signIn = useCallback(() => {
    void getSb().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }, [getSb]);

  const signOut = useCallback(async () => {
    await getSb().auth.signOut();
    setAuthExpired(false);
    setError(null);
    setPhase('idle');
    setExam(null);
  }, [getSb]);

  const reLogin = useCallback(async () => {
    await getSb().auth.signOut();
    signIn();
  }, [getSb, signIn]);

  const begin = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await startExam();
      setExam(r);
      setQuota(r.quota);
      setMessages([]);
      setUserTurns(0);
      setReport(null);
      setPhase('chatting');
    } catch (e) {
      handleErr(e);
    } finally {
      setBusy(false);
    }
  }, [handleErr]);

  const send = useCallback(async () => {
    if (!exam || busy) return;
    const text = input.trim();
    if (!text) return;
    if (text.length > exam.limits.maxInputChars) {
      setError(`超過 ${exam.limits.maxInputChars} 字上限`);
      return;
    }
    setError(null);
    setBusy(true);
    setInput('');
    setMessages((m) => [
      ...m,
      { role: 'user', content: text },
      { role: 'assistant', content: '' },
    ]);
    try {
      const res = await sendChat(exam.examId, text);
      for await (const chunk of readTextStream(res)) {
        setMessages((m) => {
          const copy = m.slice();
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = {
            role: 'assistant',
            content: last.content + chunk,
          };
          return copy;
        });
      }
      setUserTurns((n) => n + 1);
    } catch (e) {
      handleErr(e);
      setMessages((m) =>
        m[m.length - 1]?.content === '' ? m.slice(0, -1) : m,
      );
    } finally {
      setBusy(false);
    }
  }, [exam, input, busy, handleErr]);

  const submit = useCallback(async () => {
    if (!exam) return;
    setError(null);
    setBusy(true);
    setPhase('evaluating');
    try {
      const { report: rep, trap: tr, exemplar: ex, debug } =
        await evaluateExam(exam.examId);
      setReport(rep);
      setTrap(tr);
      setExemplar(ex);
      setDbg(debug);
      setPhase('done');
    } catch (e) {
      handleErr(e);
      setPhase('chatting');
    } finally {
      setBusy(false);
    }
  }, [exam, handleErr]);

  // ── 設定未完成 ──
  if (configError) {
    return (
      <main className="exam-wrap">
        <div className="center-card panel">
          <h2>設定尚未完成</h2>
          <p className="err">{configError}</p>
        </div>
      </main>
    );
  }

  // ── 載入中 ──
  if (session === undefined) {
    return (
      <main className="exam-wrap">
        <div className="center-card">
          <p>載入中…</p>
        </div>
      </main>
    );
  }

  // ── 未登入 / 登入失效 ──
  if (session === null || authExpired) {
    return (
      <main className="exam-wrap">
        <div className="center-card panel">
          <h2>{authExpired ? '登入已失效' : '開始檢測前請先登入'}</h2>
          <p className="section-sub">
            {authExpired
              ? '你的登入狀態已過期或無效，請重新登入。'
              : '使用 Google 登入，每個帳號提供 2 次免費檢測。'}
          </p>
          <button
            type="button"
            className="btn"
            onClick={authExpired ? reLogin : signIn}
          >
            {!authExpired && <GoogleIcon />}
            {authExpired ? '重新登入' : '使用 Google 登入'}
          </button>
          {authExpired && (
            <p className="signed-in">
              <button type="button" className="linkbtn" onClick={signOut}>
                只登出
              </button>
            </p>
          )}
        </div>
      </main>
    );
  }

  const meta = session.user.user_metadata ?? {};
  const displayName =
    (meta.full_name as string) ||
    (meta.name as string) ||
    session.user.email ||
    '使用者';
  const avatarUrl = (meta.avatar_url as string) || (meta.picture as string) || '';
  const outOfQuota = quota != null && quota.used >= quota.limit;
  const quotaText =
    quota != null ? `本帳號已完成 ${quota.used} / ${quota.limit} 次檢測` : null;

  const TopBar = (
    <div className="topbar">
      <Link href="/" className="topbar-brand" aria-label="AI-CAT 首頁">
        <AiCatMark size={18} />
      </Link>
      <span className="who">
        {avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar" src={avatarUrl} alt="" width={20} height={20} />
        )}
        {displayName}
      </span>
      {quotaText && <span>{quotaText}</span>}
      <button type="button" className="linkbtn" onClick={signOut}>
        登出
      </button>
      <ThemeToggle />
    </div>
  );

  // ── 開始畫面 ──
  if (phase === 'idle') {
    return (
      <main className="exam-wrap">
        {TopBar}
        <div className="center-card panel">
          <h2>AI 能力檢測</h2>
          <p className="section-sub">
            一場約 5–10 分鐘，最多 10 輪對話。準備好就開始。
          </p>
          {quotaText && <p className="quota-line">{quotaText}</p>}
          {error && (
            <div className="notice notice-error" role="alert">
              <strong>無法開始檢測</strong>
              <span>{error}</span>
            </div>
          )}
          <button
            type="button"
            className="btn"
            onClick={begin}
            disabled={busy || outOfQuota}
          >
            {outOfQuota ? '免費次數已用完' : busy ? '準備中…' : '開始檢測'}
          </button>
        </div>
      </main>
    );
  }

  // ── 報告畫面 ──
  if (phase === 'done' && report) {
    const keys = Object.keys(METRIC_LABELS) as (keyof Report['scores'])[];
    return (
      <main className="exam-wrap">
        {TopBar}
        <div className="panel report-card">
          <div className="meta-row">
            <strong>能力報告</strong>
            <span className="level-badge">{report.suggested_level}</span>
          </div>
          {keys.map((k) => (
            <div className="score-row" key={k}>
              <span>{METRIC_LABELS[k]}</span>
              <span className="score-bar">
                <span style={{ width: `${report.scores[k]}%` }} />
              </span>
              <span className="score-num">{report.scores[k]}</span>
            </div>
          ))}
          <p className="report-summary">{report.overall_summary}</p>

          {report.did_well.length > 0 && (
            <div className="fb-block">
              <h4>做得好</h4>
              <ul>
                {report.did_well.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {report.to_improve.length > 0 && (
            <div className="fb-block improve">
              <h4>可以更好</h4>
              <ul>
                {report.to_improve.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {trap && (
            <div className="trap-review">
              <div
                className={`trap-head ${trap.challenged ? 'ok' : 'miss'}`}
              >
                {trap.challenged
                  ? '你有質疑對話中出現的這則資訊'
                  : '你忽略了對話中一則錯誤資訊'}
              </div>
              <div className="trap-row wrong">
                <span className="trap-label">對話中出現</span>
                <p>{trap.injectionText}</p>
              </div>
              {trap.correction && (
                <div className="trap-row right">
                  <span className="trap-label">正確資訊</span>
                  <p>{trap.correction}</p>
                </div>
              )}
            </div>
          )}

          {exemplar && (
            <div className="exemplar">
              <div className="exemplar-head">L5 高手會怎麼用 AI 完成這題</div>
              <Markdown>{exemplar}</Markdown>
            </div>
          )}

          {DEV && dbg && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => downloadFixture(dbg)}
              title="存到 scripts/fixtures/ 給 npm run judge:reliability 用"
            >
              ⬇ 下載 fixture JSON（本地開發）
            </button>
          )}

          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setPhase('idle');
              setExam(null);
              setTrap(null);
              setExemplar('');
              setDbg(null);
            }}
          >
            回到開始
          </button>
        </div>
      </main>
    );
  }

  // ── 對話畫面（chatting / evaluating）──
  const maxTurns = exam?.limits.maxUserTurns ?? 5;
  const turnsLeft = maxTurns - userTurns;
  const canChat = phase === 'chatting' && !busy && turnsLeft > 0;

  return (
    <main className="exam-wrap">
      {TopBar}
      <div className="exam-grid">
        <aside className="panel">
          <div className="meta-row">
            <strong>任務說明</strong>
          </div>
          <div className="brief">{exam?.brief}</div>
        </aside>

        <section className="panel chat">
          <div className="meta-row">
            <span>
              第 {Math.min(userTurns + 1, maxTurns)} / {maxTurns} 輪
            </span>
            <button
              type="button"
              className="btn"
              onClick={submit}
              disabled={busy || messages.length === 0}
            >
              {phase === 'evaluating' ? '評分中…' : '提交評分'}
            </button>
          </div>

          <div className="chat-log" ref={logRef}>
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                {m.role === 'assistant' ? (
                  m.content ? (
                    <Markdown>{m.content}</Markdown>
                  ) : busy ? (
                    <span className="typing">思考中…</span>
                  ) : null
                ) : (
                  m.content
                )}
              </div>
            ))}
          </div>

          <div className="chat-input">
            <div className="composer">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                maxLength={exam?.limits.maxInputChars}
                placeholder={
                  turnsLeft > 0
                    ? `還可發言 ${turnsLeft} 次…（Enter 送出，Shift+Enter 換行）`
                    : '已達輪次上限，請提交評分'
                }
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (canChat && input.trim()) void send();
                  }
                }}
                disabled={!canChat}
              />
              {exam && input.length > 0 && (
                <span
                  className={`char-count ${
                    input.length > exam.limits.maxInputChars * 0.9 ? 'warn' : ''
                  }`}
                >
                  {input.length} / {exam.limits.maxInputChars}
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn send"
              onClick={() => void send()}
              disabled={!canChat || !input.trim()}
              aria-label="送出"
            >
              {busy && phase === 'chatting' ? '…' : '送出'}
            </button>
          </div>
          {error && <p className="err">{error}</p>}
        </section>
      </div>
    </main>
  );
}
