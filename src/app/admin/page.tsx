/**
 * 檔案：src/app/admin/page.tsx  →  /admin
 * 角色：前端層 — 後台總覽（P1）
 * 功能：測驗量（24h/7d/30d/全部）、帳號數、試用漏斗與池用量、配額分布、分類覆蓋率。
 */
'use client';

import { useEffect, useState } from 'react';
import {
  getAdminOverview,
  AdminApiError,
  type AdminOverview,
} from '@/lib/admin-client';
import styles from './admin.module.css';

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getAdminOverview()
      .then((d) => alive && setData(d))
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof AdminApiError && e.forbidden) {
          setError('這個帳號不在後台管理員名單（ADMIN_EMAILS）內。');
        } else {
          setError(e instanceof Error ? e.message : '讀取失敗');
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <p className={styles.state}>{error}</p>;
  if (!data) return <p className={styles.state}>載入中…</p>;

  const maxBucket = Math.max(1, ...data.quotaBuckets.map((b) => b.count));
  const maxCat = Math.max(1, ...data.categoryCoverage.map((c) => c.count));

  return (
    <div>
      <h1 className={styles.h1}>總覽</h1>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>近 24 小時</div>
          <div className={styles.cardValue}>{data.exams.last24h}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>近 7 天</div>
          <div className={styles.cardValue}>{data.exams.last7d}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>近 30 天</div>
          <div className={styles.cardValue}>{data.exams.last30d}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>累計測驗</div>
          <div className={styles.cardValue}>{data.exams.total}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>帳號數</div>
          <div className={styles.cardValue}>{data.users}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>已達生涯上限</div>
          <div className={styles.cardValue}>{data.capHit}</div>
          <div className={styles.cardSub}>未來付費方案的高意願名單</div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>免登入試用漏斗（本月 {data.trial.month}）</div>
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>開始</div>
            <div className={styles.cardValue}>{data.trial.started}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>完成</div>
            <div className={styles.cardValue}>{data.trial.completed}</div>
            <div className={styles.cardSub}>
              {data.trial.started > 0
                ? `${Math.round((data.trial.completed / data.trial.started) * 100)}% 完成率`
                : '—'}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>登入認領</div>
            <div className={styles.cardValue}>{data.trial.claimed}</div>
            <div className={styles.cardSub}>
              {data.trial.completed > 0
                ? `${Math.round((data.trial.claimed / data.trial.completed) * 100)}% 轉換率`
                : '—'}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>月池用量</div>
            <div className={styles.cardValue}>
              {data.trial.monthUsed}/{data.trial.monthLimit}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>今日池用量</div>
            <div className={styles.cardValue}>
              {data.trial.dayUsed}/{data.trial.dayLimit}
            </div>
            {data.trial.exhausted && (
              <div className={styles.cardSub} style={{ color: '#b23b3b' }}>
                已用完
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>登入帳號配額分布</div>
        {data.quotaBuckets.map((b) => (
          <div className={styles.barRow} key={b.label}>
            <span className={styles.barLabel}>{b.label}</span>
            <span className={styles.barTrack}>
              <span
                className={styles.barFill}
                style={{ width: `${(b.count / maxBucket) * 100}%` }}
              />
            </span>
            <span className={styles.barCount}>{b.count}</span>
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>分類覆蓋率（近 20000 場）</div>
        {data.categoryCoverage.map((c) => (
          <div className={styles.barRow} key={c.category}>
            <span className={styles.barLabel}>{c.label}</span>
            <span className={styles.barTrack}>
              <span
                className={styles.barFill}
                style={{ width: `${(c.count / maxCat) * 100}%` }}
              />
            </span>
            <span className={styles.barCount}>{c.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
