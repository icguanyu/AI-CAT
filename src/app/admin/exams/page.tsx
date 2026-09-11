/**
 * 檔案：src/app/admin/exams/page.tsx  →  /admin/exams
 * 角色：前端層 — 測驗查詢列表（P1）
 * 功能：依 email / examId 片段、分類、分級篩選，分頁瀏覽，點列進詳細頁。
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  listAdminExams,
  AdminApiError,
  type AdminExamRow,
} from '@/lib/admin-client';
import { CATEGORY_IDS, CATEGORY_LABEL, type Category, type LevelCode } from '@/types/exam';
import styles from '../admin.module.css';

const LEVELS: LevelCode[] = ['L1', 'L2', 'L3', 'L4', 'L5'];
const PAGE = 50;

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(
        d.getDate(),
      ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
        d.getMinutes(),
      ).padStart(2, '0')}`;
}

export default function AdminExamsPage() {
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [level, setLevel] = useState<LevelCode | ''>('');
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<AdminExamRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    listAdminExams({
      q: q || undefined,
      category: category || undefined,
      level: level || undefined,
      limit: PAGE,
      offset,
    })
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
  }, [q, category, level, offset]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    setQ(qInput.trim());
  };

  if (error) return <p className={styles.state}>{error}</p>;

  return (
    <div>
      <h1 className={styles.h1}>測驗查詢</h1>

      <form className={styles.filters} onSubmit={submitSearch}>
        <input
          className={styles.input}
          placeholder="email 片段或 examId 片段"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        <select
          className={styles.select}
          value={category}
          onChange={(e) => {
            setOffset(0);
            setCategory(e.target.value as Category | '');
          }}
        >
          <option value="">全部分類</option>
          {CATEGORY_IDS.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={level}
          onChange={(e) => {
            setOffset(0);
            setLevel(e.target.value as LevelCode | '');
          }}
        >
          <option value="">全部分級</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <button type="submit" className={styles.btn}>
          搜尋
        </button>
      </form>

      {!rows ? (
        <p className={styles.state}>載入中…</p>
      ) : rows.length === 0 ? (
        <p className={styles.state}>沒有符合的紀錄。</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>時間</th>
                <th>Email</th>
                <th>題目</th>
                <th>分類</th>
                <th>分級</th>
                <th>分數</th>
                <th>質疑</th>
                <th>已分享</th>
                <th>裁判版本</th>
                <th>輪次</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.examId}>
                  <td>{fmt(r.createdAt)}</td>
                  <td>
                    <Link className={styles.rowLink} href={`/admin/exams/${r.examId}`}>
                      {r.email ?? r.userId.slice(0, 8)}
                    </Link>
                  </td>
                  <td>{r.titleZh ?? '—'}</td>
                  <td>{r.category ? CATEGORY_LABEL[r.category] : '—'}</td>
                  <td>{r.level}</td>
                  <td>{r.weightedAverage}</td>
                  <td>{r.challenged ? '✓' : ''}</td>
                  <td>{r.shared ? '✓' : ''}</td>
                  <td>{r.judgeVersion ?? '—'}</td>
                  <td>{r.turns ?? '—'}</td>
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
