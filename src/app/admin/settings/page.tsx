/**
 * 檔案：src/app/admin/settings/page.tsx  →  /admin/settings
 * 角色：前端層 — 後台可調參數
 * 功能：目前只有一筆「裁判 self-consistency 次數」；改了立即生效（下一次評分就吃到，
 *       app-settings.ts 快取 60 秒），不用改 code、不用 redeploy。
 *       新增設定：改 admin-data.ts 的 KNOWN_SETTINGS，這個頁面會自動列出來。
 */
'use client';

import { useEffect, useState } from 'react';
import {
  getAppSettings,
  setAppSetting,
  resetAppSetting,
  AdminApiError,
  type AppSettingRow,
} from '@/lib/admin-client';
import styles from '../admin.module.css';

export default function AdminSettingsPage() {
  const [rows, setRows] = useState<AppSettingRow[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const load = () =>
    getAppSettings()
      .then((r) => {
        setRows(r);
        setDrafts(Object.fromEntries(r.map((row) => [row.key, String(row.value)])));
      })
      .catch((e: unknown) => {
        setError(
          e instanceof AdminApiError && e.forbidden
            ? '這個帳號不在後台管理員名單內。'
            : e instanceof Error
              ? e.message
              : '讀取失敗',
        );
      });

  useEffect(() => {
    load();
  }, []);

  const save = async (row: AppSettingRow) => {
    const n = Number(drafts[row.key]);
    if (!Number.isFinite(n)) return;
    setBusyKey(row.key);
    setSavedKey(null);
    try {
      const saved = await setAppSetting(row.key, n);
      setRows((prev) => prev?.map((r) => (r.key === row.key ? saved : r)) ?? prev);
      setDrafts((d) => ({ ...d, [row.key]: String(saved.value) }));
      setSavedKey(row.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setBusyKey(null);
    }
  };

  const reset = async (row: AppSettingRow) => {
    setBusyKey(row.key);
    setSavedKey(null);
    try {
      const saved = await resetAppSetting(row.key);
      setRows((prev) => prev?.map((r) => (r.key === row.key ? saved : r)) ?? prev);
      setDrafts((d) => ({ ...d, [row.key]: String(saved.value) }));
      setSavedKey(row.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : '還原失敗');
    } finally {
      setBusyKey(null);
    }
  };

  if (error) return <p className={styles.state}>{error}</p>;
  if (!rows) return <p className={styles.state}>載入中…</p>;

  return (
    <div>
      <h1 className={styles.h1}>設定</h1>
      <p style={{ fontSize: 12.5, color: '#56534b', marginBottom: 14 }}>
        改了立即生效（下一次評分就吃到，最多延遲到 60 秒快取過期）。不會動到已經算完的舊報告。
      </p>
      {rows.map((row) => (
        <div key={row.key} className={styles.card} style={{ marginBottom: 14 }}>
          <div className={styles.cardLabel}>{row.label}</div>
          <p style={{ fontSize: 12.5, color: '#56534b', margin: '6px 0 12px' }}>
            {row.description}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input
              className={styles.input}
              style={{ minWidth: 80, maxWidth: 100, flex: 'none' }}
              type="number"
              min={row.min}
              max={row.max}
              step={1}
              value={drafts[row.key] ?? ''}
              onChange={(e) =>
                setDrafts((d) => ({ ...d, [row.key]: e.target.value }))
              }
            />
            <span style={{ fontSize: 12, color: '#8a8778' }}>
              範圍 {row.min}–{row.max}；預設 {row.default}
            </span>
            <button
              type="button"
              className={styles.btn}
              disabled={busyKey === row.key}
              onClick={() => save(row)}
            >
              {busyKey === row.key ? '處理中…' : '儲存'}
            </button>
            {row.overridden && (
              <button
                type="button"
                className={styles.btn}
                disabled={busyKey === row.key}
                onClick={() => reset(row)}
              >
                還原成預設值
              </button>
            )}
            {savedKey === row.key && (
              <span style={{ fontSize: 12, color: '#3a7d3a' }}>已儲存</span>
            )}
          </div>
          <p style={{ fontSize: 11, color: '#8a8778', marginTop: 8 }}>
            {row.overridden
              ? `目前使用後台設定值（${row.updatedBy ?? '未知'} 於 ${row.updatedAt ? new Date(row.updatedAt).toLocaleString('zh-TW') : '未知時間'} 改的）`
              : '目前使用預設值（還沒被後台改過）'}
          </p>
        </div>
      ))}
    </div>
  );
}
