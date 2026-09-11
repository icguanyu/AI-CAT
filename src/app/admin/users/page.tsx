/**
 * 檔案：src/app/admin/users/page.tsx  →  /admin/users
 * 角色：前端層 — 帳號查詢（P2：輕量操作）
 * 功能：依 email 片段搜尋（空白 = 前 50 筆），列出配額用量與自填分群資料，
 *       點列進 /admin/users/:userId 調整配額。
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  searchAdminUsers,
  AdminApiError,
  type AdminUserRow,
} from '@/lib/admin-client';
import styles from '../admin.module.css';

export default function AdminUsersPage() {
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    searchAdminUsers(q)
      .then((r) => alive && setRows(r))
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
  }, [q]);

  if (error) return <p className={styles.state}>{error}</p>;

  return (
    <div>
      <h1 className={styles.h1}>帳號查詢</h1>

      <form
        className={styles.filters}
        onSubmit={(e) => {
          e.preventDefault();
          setQ(qInput.trim());
        }}
      >
        <input
          className={styles.input}
          placeholder="email 片段（留空看前 50 筆）"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        <button type="submit" className={styles.btn}>
          搜尋
        </button>
      </form>

      {!rows ? (
        <p className={styles.state}>載入中…</p>
      ) : rows.length === 0 ? (
        <p className={styles.state}>沒有符合的帳號。</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>姓名</th>
                <th>生涯已用/上限</th>
                <th>今日已用</th>
                <th>年齡/學歷/性別</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId}>
                  <td>
                    <Link className={styles.rowLink} href={`/admin/users/${r.userId}`}>
                      {r.email ?? r.userId.slice(0, 8)}
                    </Link>
                  </td>
                  <td>{r.fullName ?? '—'}</td>
                  <td>
                    {r.used}/{r.freeLimit}
                    {r.used >= r.freeLimit && (
                      <span className={`${styles.pill} ${styles.warn}`} style={{ marginLeft: 6 }}>
                        已達上限
                      </span>
                    )}
                  </td>
                  <td>{r.dayUsed}</td>
                  <td>
                    {r.ageBand ?? '—'} / {r.education ?? '—'} / {r.gender ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
