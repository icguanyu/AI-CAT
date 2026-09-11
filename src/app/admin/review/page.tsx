/**
 * 檔案：src/app/admin/review/page.tsx  →  /admin/review
 * 角色：前端層 — 標註審核佇列（P3：對訓練資料最關鍵的一塊）
 * 功能：列出測驗，可切換「只看未標註」；點列進去標註頁。
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getReviewQueue,
  AdminApiError,
  type ReviewQueueRow,
} from '@/lib/admin-client';
import { CATEGORY_LABEL } from '@/types/exam';
import ReviewGuide from './ReviewGuide';
import styles from '../admin.module.css';

const PAGE = 20;

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(
        d.getDate(),
      ).padStart(2, '0')}`;
}

export default function AdminReviewQueuePage() {
  const [onlyUnlabeled, setOnlyUnlabeled] = useState(true);
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<ReviewQueueRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    getReviewQueue({ onlyUnlabeled, limit: PAGE, offset })
      .then((r) => {
        if (!alive) return;
        setRows(r.rows);
        setTotal(r.total);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof AdminApiError && e.forbidden) {
          setError('這個帳號不在後台管理員名單內。');
        } else {
          setError(e instanceof Error ? e.message : '讀取失敗');
        }
      });
    return () => {
      alive = false;
    };
  }, [onlyUnlabeled, offset]);

  if (error) return <p className={styles.state}>{error}</p>;

  return (
    <div>
      <h1 className={styles.h1}>
        標註審核 <ReviewGuide />
      </h1>
      <p style={{ fontSize: 12.5, color: '#56534b', marginBottom: 14 }}>
        每個維度先看 AI 打的分，同意就直接送出（預設已幫你選最接近的桶）；
        不同意才手動改。這批標註是評估裁判準不準、以後訓練專屬裁判的原始資料。
      </p>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={onlyUnlabeled}
          onChange={(e) => {
            setOffset(0);
            setOnlyUnlabeled(e.target.checked);
          }}
        />
        只看我尚未標註（可能已有其他人標過）
      </label>

      {!rows ? (
        <p className={styles.state}>載入中…</p>
      ) : rows.length === 0 ? (
        <p className={styles.state}>
          {onlyUnlabeled ? '都標完了 🎉' : '沒有符合的紀錄。'}
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>時間</th>
                <th>題目</th>
                <th>分類</th>
                <th>分級</th>
                <th>AI 分數</th>
                <th>有陷阱</th>
                <th>質疑</th>
                <th>我標了嗎</th>
                <th>標註人數</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.examId}>
                  <td>{fmt(r.createdAt)}</td>
                  <td>
                    <Link className={styles.rowLink} href={`/admin/review/${r.examId}`}>
                      {r.titleZh ?? r.examId.slice(0, 8)}
                    </Link>
                  </td>
                  <td>{r.category ? CATEGORY_LABEL[r.category] : '—'}</td>
                  <td>{r.level}</td>
                  <td>{r.weightedAverage}</td>
                  <td>{r.noTrap ? '無陷阱題' : r.hasTrap ? '有生效' : '未生效'}</td>
                  <td>{r.hasTrap ? (r.challenged ? '✓' : '') : '—'}</td>
                  <td>
                    <span className={`${styles.pill} ${r.labeledByMe ? styles.ok : styles.warn}`}>
                      {r.labeledByMe ? '已標註' : '未標註'}
                    </span>
                  </td>
                  <td>{r.reviewerCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.pagerRow}>
        <span>
          共 {total} 筆 · 第 {Math.floor(offset / PAGE) + 1} 頁
        </span>
        <span style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={styles.btn}
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE))}
          >
            上一頁
          </button>
          <button
            type="button"
            className={styles.btn}
            disabled={offset + PAGE >= total}
            onClick={() => setOffset(offset + PAGE)}
          >
            下一頁
          </button>
        </span>
      </div>
    </div>
  );
}
