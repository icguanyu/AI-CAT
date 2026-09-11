/**
 * 檔案：src/app/admin/scenarios/page.tsx  →  /admin/scenarios
 * 角色：前端層 — 題庫健檢（P1）
 * 功能：每題被抽中次數、平均加權分、陷阱出現/被識破次數——抓「壞掉的題目」。
 *       只讀，題目內容仍在 scenarios.local.json / Supabase Table Editor 維護。
 */
'use client';

import { useEffect, useState } from 'react';
import {
  getScenarioHealth,
  AdminApiError,
  type ScenarioHealthRow,
} from '@/lib/admin-client';
import { CATEGORY_LABEL } from '@/types/exam';
import styles from '../admin.module.css';

export default function AdminScenariosPage() {
  const [rows, setRows] = useState<ScenarioHealthRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getScenarioHealth()
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
  }, []);

  if (error) return <p className={styles.state}>{error}</p>;
  if (!rows) return <p className={styles.state}>載入中…</p>;

  return (
    <div>
      <h1 className={styles.h1}>題庫健檢</h1>
      <p style={{ fontSize: 12.5, color: '#56534b', marginBottom: 14 }}>
        統計取近 20000 場提交紀錄。「陷阱出現」= 陷阱有真的說出口；「被識破」= 受測者有質疑。
        識破率長期是 0% 的題，代表陷阱可能太隱晦、或根本沒錯，值得重看。
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>題目</th>
              <th>分類</th>
              <th>狀態</th>
              <th>被抽中</th>
              <th>平均分</th>
              <th>陷阱出現</th>
              <th>被識破</th>
              <th>識破率</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .slice()
              .sort((a, b) => b.served - a.served)
              .map((r) => (
                <tr key={r.id}>
                  <td>{r.titleZh}</td>
                  <td>{r.category ? CATEGORY_LABEL[r.category] : '—'}</td>
                  <td>
                    <span className={`${styles.pill} ${r.active ? styles.ok : styles.warn}`}>
                      {r.active ? '上線中' : '已停用'}
                    </span>
                  </td>
                  <td>{r.served}</td>
                  <td>{r.avgScore ?? '—'}</td>
                  <td>{r.trapShown}</td>
                  <td>{r.trapCaught}</td>
                  <td>
                    {r.trapShown > 0
                      ? `${Math.round((r.trapCaught / r.trapShown) * 100)}%`
                      : '—'}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
