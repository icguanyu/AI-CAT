/**
 * 檔案：src/app/me/page.tsx  →  /me
 * 角色：前端層 — 個人檢測歷史 + 綜合能力估計
 * 功能：驗證登入 → GET /api/me/exams →
 *       ① 綜合分級卡（相異分類近期加權；≥3 種分類才解鎖 L）+ 五大能力橫條
 *       ② 分數走勢（最近 20 場，hover 看單場資訊、含 L3 門檻線）
 *       ③ 歷史列表（可依分類 / 已分享篩選、分批載入）→ /exam/result/:examId
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { PageLoading } from '@/components/PageLoading';
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { getMyExams, type ExamListItem } from '@/lib/client-api';
import { aggregateExams } from '@/lib/aggregate';
import { AccountMenu } from '@/components/AccountMenu';
import { AiCatMark } from '@/components/AiCatMark';
import { ScoreTrend, type TrendPoint } from '@/components/ScoreTrend';
import { ProfilePrompt } from '@/components/ProfilePrompt';
import {
  CATEGORY_LABEL,
  FAMILIARITY_LABEL,
  LEVEL_NAME,
  type Category,
  type Report,
} from '@/types/exam';

const DIM_ORDER: (keyof Report['scores'])[] = [
  'prompt_structure',
  'decomposition',
  'efficiency',
  'critical_thinking',
  'task_completion',
];

const DIM_LABEL: Record<keyof Report['scores'], string> = {
  prompt_structure: '提示詞結構',
  decomposition: '問題拆解力',
  efficiency: '對話效率',
  critical_thinking: '批判思考',
  task_completion: '任務達成率',
};

/** 歷史列表一次顯示幾筆，「載入更多」每按一次 +PAGE。 */
const PAGE = 10;

type Filter = 'all' | 'shared' | Category;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(
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
  const [filter, setFilter] = useState<Filter>('all');
  const [visible, setVisible] = useState(PAGE);

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

  useEffect(() => setVisible(PAGE), [filter]);

  const agg = useMemo(() => aggregateExams(exams ?? []), [exams]);

  /** 最近 20 場，舊 → 新（走勢圖用；帶標題 / 日期 / 分類 / 分級供 tooltip）。 */
  const trend = useMemo<TrendPoint[]>(
    () =>
      (exams ?? [])
        .slice(0, 20)
        .map((e) => ({
          value: e.weightedAverage,
          date: fmtDate(e.createdAt),
          title: e.titleZh ?? '（未命名情境）',
          category: e.category ? CATEGORY_LABEL[e.category] : null,
          level: e.suggestedLevel,
        }))
        .reverse(),
    [exams],
  );

  /** 走勢右側「最新 vs 近 k 場」的變化量。 */
  const trendDelta = useMemo(() => {
    if (trend.length < 2) return null;
    const k = Math.min(4, trend.length - 1);
    const last = trend[trend.length - 1].value;
    const prev = trend[trend.length - 1 - k].value;
    return { diff: last - prev, k, last };
  }, [trend]);

  /** 歷史最高的加權平均分（用來標「個人最佳」）；只有一場時不標。 */
  const personalBest = useMemo(
    () =>
      exams && exams.length > 1
        ? Math.max(...exams.map((e) => e.weightedAverage))
        : null,
    [exams],
  );

  /** 出現過的分類（篩選列用），依場次序。 */
  const catsPresent = useMemo(() => {
    const seen = new Set<Category>();
    for (const e of exams ?? []) if (e.category) seen.add(e.category);
    return [...seen];
  }, [exams]);

  const anyShared = useMemo(
    () => (exams ?? []).some((e) => e.shared),
    [exams],
  );

  const filtered = useMemo(() => {
    const list = exams ?? [];
    if (filter === 'all') return list;
    if (filter === 'shared') return list.filter((e) => e.shared);
    return list.filter((e) => e.category === filter);
  }, [exams, filter]);

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
        <AiCatMark size={24} />
        <span className="me-brand-word">AI-CAT</span>
      </Link>
      <div className="me-top-actions">
        <Link href="/exam" className="me-new-btn">
          開始新檢測
        </Link>
        <AccountMenu />
      </div>
    </header>
  );

  if (error) {
    return (
      <main className="exam-wrap me-page">
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
      <main className="exam-wrap me-page">
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
      <main className="exam-wrap me-page">
        {Header}
        <div className="center-card">
          <PageLoading />
        </div>
      </main>
    );
  }

  const cMax = agg.composite ? Math.max(...agg.composite) : 0;
  const cMin = agg.composite ? Math.min(...agg.composite) : 0;
  const dimNote =
    agg.composite && cMax - cMin >= 8
      ? `${DIM_LABEL[DIM_ORDER[agg.composite.indexOf(cMax)]]} 最穩，${
          DIM_LABEL[DIM_ORDER[agg.composite.indexOf(cMin)]]
        } 相對還有空間。`
      : agg.composite
        ? '五維表現相當平均，沒有明顯短板。'
        : null;

  return (
    <main className="exam-wrap me-page">
      {Header}
      <div className="me-view">
        <div className="me-head">
          <h1 className="me-h1">我的檢測紀錄</h1>
          {/* <span className="mono-label">
            {exams.length} 場 · {agg.distinctCategories} / 3 種分類
          </span> */}
        </div>

        <ProfilePrompt />

        {exams.length === 0 ? (
          <div className="center-card panel">
            <p className="section-sub">還沒有任何紀錄。</p>
            <Link className="btn" href="/exam">
              開始第一次檢測
            </Link>
          </div>
        ) : (
          <>
            {agg.composite && (
              <section className="me-grid2">
                <div className="me-col">
                  <div className="me-card-head">
                    <span className="mono-label">綜合分級</span>
                    <span className="mono-label me-dim">
                      {agg.compositeLevel ? '已解鎖' : '尚未解鎖'}
                    </span>
                  </div>

                  <div className="me-comp-lv">
                    <b className={agg.compositeLevel ? '' : 'ghost'}>
                      {agg.compositeLevel ?? 'L?'}
                    </b>
                    {agg.compositeLevel ? (
                      <span className="me-comp-meta">
                        <span className="me-comp-name">
                          {LEVEL_NAME[agg.compositeLevel]}
                        </span>
                        <span className="me-comp-score">
                          AI SCORE <b>{agg.compositeAverage}</b>
                        </span>
                      </span>
                    ) : (
                      <p className="me-comp-gate">
                        再完成 {agg.gateNeeded} 種分類，就能算出你的綜合分級
                      </p>
                    )}
                  </div>

                  <div className="me-catrows">
                    {agg.perCategory.map((c) => (
                      <div
                        className={`me-catrow${c.stale ? ' stale' : ''}`}
                        key={c.category}
                        title={
                          c.stale
                            ? `${c.ageDays} 天沒重測，對綜合估計的影響已降低`
                            : undefined
                        }
                      >
                        <span className="me-catrow-name">{c.label}</span>
                        <span className="me-catrow-bar">
                          <span style={{ width: `${c.average}%` }} />
                        </span>
                        <span className="me-catrow-val">
                          {c.average} · {c.level}
                          {c.stale && (
                            <em className="me-catrow-age">{c.ageDays}天前</em>
                          )}
                        </span>
                      </div>
                    ))}
                    {Array.from({ length: agg.gateNeeded }).map((_, i) => (
                      <div className="me-catrow ghost" key={`ghost-${i}`}>
                        <span className="me-catrow-name">待完成</span>
                        <span className="me-catrow-bar" />
                        <Link href="/exam" className="me-catrow-go">
                          去檢測
                        </Link>
                      </div>
                    ))}
                  </div>

                  {agg.perCategory.some((c) => c.stale) && (
                    <p className="me-comp-hint">
                      久沒重測的分類，對綜合估計的影響會逐漸降低（約 45 天減半）。
                    </p>
                  )}
                </div>

                <div className="me-col">
                  <div className="me-card-head">
                    <span className="mono-label">五大能力</span>
                    <span className="mono-label me-dim">
                      {agg.distinctCategories} 類 · 近期加權
                    </span>
                  </div>

                  <div className="me-abil-rows">
                    {DIM_ORDER.map((k, i) => {
                      const v = agg.composite![i];
                      const cls =
                        v === cMax && cMax !== cMin
                          ? ' is-top'
                          : v === cMin && cMax !== cMin
                            ? ' is-low'
                            : '';
                      return (
                        <div className={`me-abil-row${cls}`} key={k}>
                          <span className="me-abil-name">{DIM_LABEL[k]}</span>
                          <span className="me-abil-bar">
                            <span style={{ width: `${v}%` }} />
                          </span>
                          <span className="me-abil-val">{v}</span>
                        </div>
                      );
                    })}
                  </div>

                  {dimNote && <p className="me-abil-note">{dimNote}</p>}
                </div>
              </section>
            )}

            {trend.length >= 2 && (
              <section className="me-panel me-trend">
                <div className="me-card-head">
                  <span className="mono-label">
                    分數走勢 · 最近 {trend.length} 場
                  </span>
                  <span className="me-trend-legend">
                    <span>
                      <i className="sw-line" />
                      單場分數
                    </span>
                    <span>
                      <i className="sw-dash" />
                      L3 門檻
                    </span>
                  </span>
                </div>
                <div className="me-trend-body">
                  <div className="me-trend-chart">
                    <ScoreTrend points={trend} />
                  </div>
                  {trendDelta && (
                    <div className="me-trend-rail">
                      <span className="mono-label me-dim">最新</span>
                      <span className="me-trend-latest">{trendDelta.last}</span>
                      <span
                        className={`me-trend-delta${
                          trendDelta.diff > 0
                            ? ' up'
                            : trendDelta.diff < 0
                              ? ' down'
                              : ''
                        }`}
                      >
                        {trendDelta.diff > 0 ? '+' : ''}
                        {trendDelta.diff} · 近 {trendDelta.k} 場
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}

            <div className="me-hist-head">
              <span className="mono-label">歷史紀錄 · {exams.length}</span>
              <div className="me-filters">
                <button
                  type="button"
                  className={`me-fchip${filter === 'all' ? ' on' : ''}`}
                  onClick={() => setFilter('all')}
                >
                  全部
                </button>
                {catsPresent.map((c) => (
                  <button
                    type="button"
                    key={c}
                    className={`me-fchip${filter === c ? ' on' : ''}`}
                    onClick={() => setFilter(c)}
                  >
                    {CATEGORY_LABEL[c]}
                  </button>
                ))}
                {anyShared && (
                  <button
                    type="button"
                    className={`me-fchip${filter === 'shared' ? ' on' : ''}`}
                    onClick={() => setFilter('shared')}
                  >
                    已分享
                  </button>
                )}
              </div>
            </div>

            <div className="me-list">
              {filtered.slice(0, visible).map((e) => {
                const best =
                  personalBest != null && e.weightedAverage === personalBest;
                return (
                  <Link
                    className={`me-row${best ? ' best' : ''}`}
                    href={`/exam/result/${e.examId}`}
                    key={e.examId}
                  >
                    <span className="me-lv">
                      <b>{e.suggestedLevel}</b>
                      <span className="me-lv-bar">
                        <span style={{ width: `${e.weightedAverage}%` }} />
                      </span>
                    </span>
                    <span className="me-main">
                      <span className="me-title">
                        {e.titleZh ?? '（未命名情境）'}
                      </span>
                      <span className="me-tags">
                        {e.category && (
                          <span className="me-chip out">
                            {CATEGORY_LABEL[e.category]}
                          </span>
                        )}
                        {e.familiarity && (
                          <span className="me-chip">
                            {FAMILIARITY_LABEL[e.familiarity]}
                          </span>
                        )}
                        {best && <span className="me-chip hl">個人最佳</span>}
                        {e.shared && <span className="me-chip">已分享</span>}
                      </span>
                    </span>
                    <span className="me-side">
                      <span className="me-score">{e.weightedAverage}</span>
                      <span className="me-date">{fmtDate(e.createdAt)}</span>
                    </span>
                  </Link>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <p className="section-sub me-empty-filter">
                這個篩選沒有紀錄。
              </p>
            )}

            {filtered.length > visible && (
              <button
                type="button"
                className="me-more"
                onClick={() => setVisible((v) => v + PAGE)}
              >
                載入更多 · 還有 {filtered.length - visible} 場
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
