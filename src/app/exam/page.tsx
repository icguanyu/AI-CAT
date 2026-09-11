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

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PageLoading } from '@/components/PageLoading';
import { useRouter, useSearchParams } from 'next/navigation';
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import {
  getQuota,
  startExam,
  sendChat,
  evaluateExam,
  getExamReport,
  ApiError,
  type Quota,
  type StartResult,
  type EvalResult,
} from '@/lib/client-api';
import { readTextStream } from '@/lib/data-stream';
import { useVoiceInput } from '@/lib/use-voice-input';
import {
  FAMILIARITY_LABEL,
  FAMILIARITY_DESC,
  CATEGORY_LABEL,
  type Familiarity,
} from '@/types/exam';
import { Markdown } from '@/components/Markdown';
import { AccountMenu } from '@/components/AccountMenu';
import { ReportView } from '@/components/ReportView';
import { LoginToSaveCard } from '@/components/LoginToSaveCard';
import {
  TurnstileWidget,
  turnstileEnabledClient,
} from '@/components/TurnstileWidget';
import { ThinkingCat } from '@/components/ThinkingCat';
import { EvaluatingCat } from '@/components/EvaluatingCat';
import { GoogleIcon } from '@/components/GoogleIcon';
import { AiCatMark } from '@/components/AiCatMark';

type Msg = { role: 'user' | 'assistant'; content: string };
type Phase = 'idle' | 'brief' | 'chatting' | 'evaluating' | 'result';
type TrialResult = EvalResult & {
  familiarity: Familiarity;
  transcript: Msg[] | null;
};

export default function ExamPage() {
  return (
    <Suspense
      fallback={
        <main className="exam-wrap">
          <div className="center-card">
            <PageLoading />
          </div>
        </main>
      }
    >
      <ExamPageInner />
    </Suspense>
  );
}

function ExamPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  // 免登入試用：start 失敗代碼（PUBLIC_POOL_EXHAUSTED / TRIAL_USED）與試用結果
  const [startCode, setStartCode] = useState<string | null>(null);
  const [trialResult, setTrialResult] = useState<TrialResult | null>(null);
  const [trialExamId, setTrialExamId] = useState<string | null>(null);
  const [tsToken, setTsToken] = useState('');
  const tsGate = turnstileEnabledClient();
  // 開場自評的領域熟悉度（給裁判校準 task_completion）
  const [familiarity, setFamiliarity] = useState<Familiarity>('mid');
  // 提交評分前的二次確認（避免誤按）
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  // 視窗是否為窄版（手機）：Enter 一律換行、輸入框改 sticky
  const [isNarrow, setIsNarrow] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // 語音輸入：按下麥克風時先記住現有內容，辨識結果接在後面
  const voiceBaseRef = useRef('');
  const maxInputChars = exam?.limits.maxInputChars ?? 4000;
  const {
    supported: voiceSupported,
    listening: voiceListening,
    error: voiceError,
    start: voiceStart,
    stop: voiceStop,
  } = useVoiceInput({
    onChange: (sessionText) => {
      const base = voiceBaseRef.current;
      const joiner = base && sessionText && !/\s$/.test(base) ? ' ' : '';
      setInput((base + joiner + sessionText).slice(0, maxInputChars));
    },
  });
  const toggleVoice = useCallback(() => {
    if (voiceListening) {
      voiceStop();
    } else {
      voiceBaseRef.current = input;
      voiceStart();
    }
  }, [voiceListening, voiceStart, voiceStop, input]);

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
    if (session && phase === 'idle') refreshQuota();
  }, [phase, session, refreshQuota]);

  // 免登入試用結果：帶 ?trial=<examId> 回來時，從 Redis 快照還原（重新整理不消失）
  useEffect(() => {
    const id = searchParams.get('trial');
    if (!id || session || trialResult) return;
    let alive = true;
    getExamReport(id)
      .then((b) => {
        if (!alive || !b.trial) return;
        setTrialExamId(id);
        setTrialResult({
          report: b.report,
          trap: b.trap,
          exemplar: b.exemplar,
          persisted: false,
          familiarity: b.familiarity ?? 'mid',
          transcript: b.transcript,
        });
        setPhase('result');
      })
      .catch(() => {
        /* 逾時或找不到 → 留在一般畫面 */
      });
    return () => {
      alive = false;
    };
  }, [searchParams, session, trialResult]);

  // 對話自動捲到底：桌機 .chat-log 自己會捲時只動它（不劫持整頁捲軸）；
  // 手機（.chat-log overflow:visible）才退回用哨兵捲整頁。
  useEffect(() => {
    const el = logRef.current;
    if (el && el.scrollHeight > el.clientHeight + 1) {
      el.scrollTop = el.scrollHeight;
    } else {
      logEndRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [messages]);

  // 切換情境／畫面（idle → brief → chatting …）時，整頁捲軸回到最上面
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [phase]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 820px)');
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // 手機不提供語音鈕（系統鍵盤本身就有語音輸入）；縮窗時若正在聽就收掉
  useEffect(() => {
    if (isNarrow && voiceListening) voiceStop();
  }, [isNarrow, voiceListening, voiceStop]);

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
    setStartCode(null);
    setBusy(true);
    try {
      const r = await startExam(tsToken || undefined);
      setExam(r);
      setQuota(r.quota);
      setMessages([]);
      setUserTurns(0);
      setFamiliarity('mid');
      setPhase('brief'); // 先看題目 → 自評熟悉度 → 開始對話
    } catch (e) {
      if (e instanceof ApiError && e.code) setStartCode(e.code);
      handleErr(e);
    } finally {
      setBusy(false);
    }
  }, [handleErr, tsToken]);

  const send = useCallback(async () => {
    if (!exam || busy) return;
    voiceStop();
    setConfirmingSubmit(false);
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
  }, [exam, input, busy, handleErr, voiceStop]);

  const submit = useCallback(async () => {
    if (!exam) return;
    voiceStop();
    setConfirmingSubmit(false);
    setError(null);
    setBusy(true);
    setPhase('evaluating');
    try {
      const res = await evaluateExam(exam.examId, familiarity);
      if (res.persisted) {
        // 登入版：報告已寫入 Supabase，轉結果頁（重新整理不消失）
        router.push(`/exam/result/${exam.examId}`);
      } else {
        // 免登入試用：結果只在 Redis，就地顯示 + 引導登入保存
        setTrialResult({ ...res, familiarity, transcript: messages });
        setTrialExamId(exam.examId);
        setPhase('result');
        setBusy(false);
        router.replace(`/exam?trial=${exam.examId}`);
      }
    } catch (e) {
      handleErr(e);
      setPhase('chatting');
      setBusy(false);
    }
  }, [exam, handleErr, router, voiceStop, familiarity, messages]);

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
          <PageLoading />
        </div>
      </main>
    );
  }

  // ── 登入已失效 ──
  if (authExpired) {
    return (
      <main className="exam-wrap">
        <div className="center-card panel">
          <h2>登入已失效</h2>
          <p className="section-sub">
            你的登入狀態已過期或無效，請重新登入。
          </p>
          <button type="button" className="btn" onClick={reLogin}>
            重新登入
          </button>
          <p className="signed-in">
            <button type="button" className="linkbtn" onClick={signOut}>
              只登出
            </button>
          </p>
        </div>
      </main>
    );
  }

  // ── 免登入試用：就地顯示結果 + 引導登入保存（登入 / 未登入都可能走到）──
  if (phase === 'result' && trialResult && trialExamId) {
    return (
      <main className="exam-wrap">
        <header className="result-topbar">
          <Link href="/" className="topbar-brand" aria-label="AI-CAT 首頁">
            <AiCatMark size={24} />
          </Link>
          <AccountMenu />
        </header>
        <LoginToSaveCard examId={trialExamId} />
        <ReportView
          report={trialResult.report}
          trap={trialResult.trap}
          exemplar={trialResult.exemplar}
          familiarity={trialResult.familiarity}
          transcript={trialResult.transcript}
          trial
        />
        <div className="trial-again">
          <Link className="btn ghost" href="/exam">
            回到開始
          </Link>
        </div>
      </main>
    );
  }

  // ── 未登入且還在開始畫面：免費試用一次（試用開始後 phase 會前進，就走下方一般流程）──
  if (session === null && phase === 'idle') {
    const poolMsg =
      startCode === 'PUBLIC_POOL_EXHAUSTED'
        ? '這個月的免費公開試用額度太熱門、已被用完。登入即可立刻用你自己的免費額度（每日 3 場）。'
        : startCode === 'TRIAL_USED'
          ? '你已用過一次免費試用了。登入即可繼續使用（每日 3 場免費，隔日重置）。'
          : null;
    return (
      <main className="exam-wrap">
        <div className="topbar">
          <Link href="/" className="topbar-brand" aria-label="AI-CAT 首頁">
            <AiCatMark size={18} />
          </Link>
          <AccountMenu />
        </div>
        <div className="center-card panel">
          <h2>AI 能力檢測</h2>
          {searchParams.get('claim') === 'failed' && (
            <div className="notice notice-error" role="alert">
              <span>沒能接回剛剛的試用結果（可能換了瀏覽器或清了 Cookie）。直接再測一場吧。</span>
            </div>
          )}
          {poolMsg ? (
            <>
              <p className="section-sub">{poolMsg}</p>
              <button type="button" className="btn" onClick={signIn}>
                <GoogleIcon />
                使用 Google 登入
              </button>
            </>
          ) : (
            <>
              <p className="section-sub">
                不用註冊，先免費試一場（約 5–10 分鐘）。試用結果需登入才會保存。
              </p>
              {error && (
                <div className="notice notice-error" role="alert">
                  <strong>無法開始</strong>
                  <span>{error}</span>
                </div>
              )}
              {tsGate && <TurnstileWidget onVerify={setTsToken} />}
              <div className="idle-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={begin}
                  disabled={busy || (tsGate && !tsToken)}
                >
                  {busy
                    ? '抽題中…'
                    : tsGate && !tsToken
                      ? '驗證中…'
                      : '免費試用一次（不需登入）'}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={signIn}
                >
                  <GoogleIcon />
                  登入後開始
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    );
  }

  const outOfDaily = quota != null && quota.dayUsed >= quota.dayLimit;
  const outOfTotal = quota != null && quota.used >= quota.limit;
  const outOfQuota = outOfDaily || outOfTotal;
  const quotaText =
    quota != null
      ? `今日 ${quota.dayUsed} / ${quota.dayLimit} 次 · 累計 ${quota.used} 次`
      : null;
  const quotaButtonText = outOfTotal
    ? '檢測次數已用完'
    : outOfDaily
      ? '今日次數已用完'
      : null;

  const TopBar = (
    <div className="topbar">
      <Link href="/" className="topbar-brand" aria-label="AI-CAT 首頁">
        <AiCatMark size={18} />
      </Link>
      {exam?.trial ? (
        <span className="trial-tag">試用模式 · 結果需登入保存</span>
      ) : (
        quotaText && <span>{quotaText}</span>
      )}
      <AccountMenu />
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
            {quotaButtonText ?? (busy ? '抽題中…' : '開始檢測')}
          </button>
        </div>
      </main>
    );
  }

  // ── 看題目 + 自評領域熟悉度（開始對話前）──
  if (phase === 'brief' && exam) {
    return (
      <main className="exam-wrap">
        {TopBar}
        <div className="center-card panel brief-gate">
          <div className="meta-row">
            <span className="task-head">
              <strong>你的任務</strong>
              <span className="task-cat">{CATEGORY_LABEL[exam.category]}</span>
            </span>
            <button
              type="button"
              className="linkbtn"
              onClick={() => {
                setPhase('idle');
                setExam(null);
              }}
            >
              換一題
            </button>
          </div>
          <p className="brief">{exam.brief}</p>

          <div className="familiarity-pick">
            <p className="fp-q">你對這個情境的領域熟悉度？</p>
            <div className="pill-toggle" role="group" aria-label="領域熟悉度">
              {(['high', 'mid', 'low'] as Familiarity[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  data-on={familiarity === f}
                  onClick={() => setFamiliarity(f)}
                >
                  {FAMILIARITY_LABEL[f]}
                </button>
              ))}
            </div>
            <dl className="fp-opts">
              {(['high', 'mid', 'low'] as Familiarity[]).map((f) => (
                <div key={f} data-on={familiarity === f}>
                  <dt>{FAMILIARITY_LABEL[f]}</dt>
                  <dd>{FAMILIARITY_DESC[f]}</dd>
                </div>
              ))}
            </dl>
            <p className="fp-hint">
              誠實選就好——評分會據此校準，任務達成率只看題目明列的要求。
            </p>
          </div>

          <button
            type="button"
            className="btn"
            onClick={() => setPhase('chatting')}
          >
            開始對話
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
            <span className="task-head">
              <strong>任務說明</strong>
              {exam?.category && (
                <span className="task-cat">{CATEGORY_LABEL[exam.category]}</span>
              )}
            </span>
          </div>
          <div className="brief">{exam?.brief}</div>
        </aside>

        <section className="panel chat">
          {phase === 'evaluating' && (
            <div className="chat-overlay">
              <EvaluatingCat />
            </div>
          )}
          <div className="meta-row chat-head">
            <strong className="chat-head-title">
              <AiCatMark size={16} />
              AI 助手
            </strong>
            <span>
              第 {Math.min(userTurns + 1, maxTurns)} / {maxTurns} 輪
            </span>
          </div>

          <div className="chat-log" ref={logRef}>
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                {m.role === 'assistant' ? (
                  m.content ? (
                    <Markdown>{m.content}</Markdown>
                  ) : busy ? (
                    <ThinkingCat />
                  ) : null
                ) : (
                  m.content
                )}
              </div>
            ))}
            <div ref={logEndRef} className="chat-end" aria-hidden="true" />
          </div>

          <div className="chat-input">
            <div className="chat-input-row">
            <div className="composer">
              <textarea
                ref={inputRef}
                rows={2}
                value={input}
                maxLength={exam?.limits.maxInputChars}
                placeholder={
                  turnsLeft > 0
                    ? isNarrow
                      ? `還可發言 ${turnsLeft} 次…（點右側按鈕送出）`
                      : `還可發言 ${turnsLeft} 次…（Enter 送出，Shift+Enter 換行）`
                    : '已達輪次上限，請提交評分'
                }
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  // 手機一律換行；輸入法選字（IME composing）中按 Enter 不送出
                  if (
                    e.key === 'Enter' &&
                    !e.shiftKey &&
                    !isNarrow &&
                    !e.nativeEvent.isComposing
                  ) {
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
            {voiceSupported && !isNarrow && (
              <button
                type="button"
                className={`btn mic${voiceListening ? ' listening' : ''}`}
                onClick={toggleVoice}
                disabled={!canChat}
                aria-pressed={voiceListening}
                aria-label={voiceListening ? '停止語音輸入' : '語音輸入'}
                title={voiceListening ? '停止語音輸入' : '語音輸入'}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    fill="currentColor"
                    d="M12 15a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v5a4 4 0 0 0 4 4Zm7-4a7 7 0 0 1-6 6.93V21h-2v-3.07A7 7 0 0 1 5 11h2a5 5 0 0 0 10 0h2Z"
                  />
                </svg>
              </button>
            )}
            <button
              type="button"
              className="btn send"
              onClick={() => void send()}
              disabled={!canChat || !input.trim()}
              aria-label="送出"
              title="送出"
            >
              {busy && phase === 'chatting' ? (
                <span className="send-spinner" aria-hidden="true" />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    fill="currentColor"
                    d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z"
                  />
                </svg>
              )}
            </button>
            </div>
            {isNarrow && canChat && (
              <p className="input-tip">
                想用語音？直接點手機鍵盤上的麥克風即可口述輸入
              </p>
            )}
            {confirmingSubmit ? (
              <div className="submit-confirm" role="alertdialog" aria-live="polite">
                <p>提交後就不能再跟 AI 對話了，確定交出去評分嗎？</p>
                <div className="submit-confirm-actions">
                  <button
                    type="button"
                    className="btn chat-submit"
                    onClick={submit}
                    disabled={busy}
                  >
                    <AiCatMark size={15} />
                    確定提交
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setConfirmingSubmit(false)}
                    disabled={busy}
                  >
                    再想想
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn chat-submit"
                onClick={() => setConfirmingSubmit(true)}
                disabled={busy || messages.length === 0}
              >
                <AiCatMark size={16} />
                提交評分
              </button>
            )}
          </div>
          {voiceListening && (
            <p className="voice-hint" aria-live="polite">
              聆聽中…請開始說話，說完再按一次麥克風
            </p>
          )}
          {voiceError && <p className="err">{voiceError}</p>}
          {error && <p className="err">{error}</p>}
        </section>
      </div>
    </main>
  );
}
