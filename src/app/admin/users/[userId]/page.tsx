/**
 * 檔案：src/app/admin/users/[userId]/page.tsx  →  /admin/users/:userId
 * 角色：前端層 — 單一帳號配額調整（P2：輕量操作，comp / 客訴處理用）
 * 功能：顯示目前配額與自填分群資料，可手動改「生涯已用 / 生涯上限 / 今日已用」；
 *       只送有改過的欄位。另附連結去看這個人的測驗紀錄。
 */
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getAdminUser,
  updateAdminUserQuota,
  AdminApiError,
  type AdminUserRow,
} from '@/lib/admin-client';
import styles from '../../admin.module.css';

export default function AdminUserDetailPage() {
  const params = useParams<{ userId: string }>();
  const [user, setUser] = useState<AdminUserRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [freeLimit, setFreeLimit] = useState('');
  const [used, setUsed] = useState('');
  const [dayUsed, setDayUsed] = useState('');

  const load = () => {
    getAdminUser(params.userId)
      .then((u) => {
        setUser(u);
        setFreeLimit(String(u.freeLimit));
        setUsed(String(u.used));
        setDayUsed(String(u.dayUsed));
      })
      .catch((e: unknown) => {
        if (e instanceof AdminApiError && e.forbidden) {
          setError('這個帳號不在後台管理員名單內。');
        } else {
          setError(e instanceof Error ? e.message : '讀取失敗');
        }
      });
  };

  useEffect(load, [params.userId]);

  if (error) return <p className={styles.state}>{error}</p>;
  if (!user) return <p className={styles.state}>載入中…</p>;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedAt(null);
    try {
      const patch: { freeLimit?: number; used?: number; dayUsed?: number } = {};
      const fl = Number(freeLimit);
      const u = Number(used);
      const du = Number(dayUsed);
      if (Number.isFinite(fl) && fl !== user.freeLimit) patch.freeLimit = fl;
      if (Number.isFinite(u) && u !== user.used) patch.used = u;
      if (Number.isFinite(du) && du !== user.dayUsed) patch.dayUsed = du;
      const updated = await updateAdminUserQuota(params.userId, patch);
      setUser(updated);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p style={{ marginBottom: 12 }}>
        <Link className={styles.rowLink} href="/admin/users">
          ← 回帳號查詢
        </Link>
      </p>
      <h1 className={styles.h1}>{user.email ?? user.userId}</h1>

      <div className={styles.detailGrid}>
        <div className={styles.kv}>
          <span className={styles.kvLabel}>姓名</span>
          <span>{user.fullName ?? '—'}</span>
        </div>
        <div className={styles.kv}>
          <span className={styles.kvLabel}>自填年齡 / 學歷 / 性別</span>
          <span>
            {user.ageBand ?? '—'} / {user.education ?? '—'} / {user.gender ?? '—'}
          </span>
        </div>
        <div className={styles.kv}>
          <span className={styles.kvLabel}>今日日期記錄</span>
          <span>{user.dayDate ?? '—'}</span>
        </div>
        <div className={styles.kv}>
          <span className={styles.kvLabel}>測驗紀錄</span>
          <span>
            {user.email && (
              <Link
                className={styles.rowLink}
                href={`/admin/exams?q=${encodeURIComponent(user.email)}`}
              >
                查看這個人的所有測驗 →
              </Link>
            )}
          </span>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>調整配額</div>
        <form onSubmit={save} className={styles.detailGrid}>
          <label className={styles.kv}>
            <span className={styles.kvLabel}>生涯已用</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              value={used}
              onChange={(e) => setUsed(e.target.value)}
            />
          </label>
          <label className={styles.kv}>
            <span className={styles.kvLabel}>生涯上限（free_limit）</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              value={freeLimit}
              onChange={(e) => setFreeLimit(e.target.value)}
            />
          </label>
          <label className={styles.kv}>
            <span className={styles.kvLabel}>今日已用</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              value={dayUsed}
              onChange={(e) => setDayUsed(e.target.value)}
            />
          </label>
          <div className={styles.kv} style={{ justifyContent: 'flex-end' }}>
            <span className={styles.kvLabel}>&nbsp;</span>
            <button type="submit" className={styles.btn} disabled={saving}>
              {saving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </form>
        {savedAt && (
          <p style={{ fontSize: 12, color: '#1e874b', marginTop: 8 }}>已儲存。</p>
        )}
      </div>
    </div>
  );
}
