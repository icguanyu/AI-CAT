/**
 * 檔案：src/app/admin/scenarios/page.tsx  →  /admin/scenarios
 * 角色：前端層 — 題庫健檢 + 上線開關（P1 可見性 + P2 輕量操作）
 * 功能：每題被抽中次數、平均加權分、陷阱出現/被識破次數——抓「壞掉的題目」；
 *       狀態欄可直接點擊切換 active（不刪資料，隨時能切回來）。
 *       點題目名稱：彈窗看完整內容（brief / system / 每個變體的陷阱，機密），
 *       僅後台看得到，不另外開頁面。
 */
'use client';

import { useEffect, useState } from 'react';
import {
  getScenarioHealth,
  setScenarioActive,
  getScenarioDetail,
  deleteScenario,
  AdminApiError,
  type ScenarioHealthRow,
  type ScenarioDetail,
} from '@/lib/admin-client';
import {
  CATEGORY_IDS,
  CATEGORY_LABEL,
  TRAP_TYPE_LABEL,
  VERIFY_DIFFICULTY_LABEL,
  type Category,
} from '@/types/exam';
import styles from '../admin.module.css';

export default function AdminScenariosPage() {
  const [rows, setRows] = useState<ScenarioHealthRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // 全部題目一次載入（就 22 題，不用分頁），分類篩選純前端過濾，不用重打 API。
  const [categoryFilter, setCategoryFilter] = useState<Category | ''>('');

  // 查看題目彈窗：開哪一題、內容、載入 / 錯誤狀態各自獨立於列表狀態
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ScenarioDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  // 刪除：兩步確認（先按「刪除」再按「確定刪除」），避免手滑
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const toggle = async (row: { id: string; active: boolean }) => {
    setBusyId(row.id);
    try {
      await setScenarioActive(row.id, !row.active);
      setRows((prev) =>
        prev
          ? prev.map((r) => (r.id === row.id ? { ...r, active: !r.active } : r))
          : prev,
      );
      setDetail((d) => (d && d.id === row.id ? { ...d, active: !d.active } : d));
    } catch {
      /* 失敗就維持原狀，使用者可再點一次 */
    } finally {
      setBusyId(null);
    }
  };

  const openDetail = (id: string) => {
    setDetailId(id);
    setDetail(null);
    setDetailError(null);
    setConfirmingDelete(false);
    setDeleteError(null);
    getScenarioDetail(id)
      .then((d) => setDetail(d))
      .catch((e: unknown) => setDetailError(e instanceof Error ? e.message : '讀取失敗'));
  };
  const closeDetail = () => {
    setDetailId(null);
    setDetail(null);
    setDetailError(null);
    setConfirmingDelete(false);
    setDeleteError(null);
  };

  const handleDelete = async (id: string) => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteScenario(id);
      setRows((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
      closeDetail();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : '刪除失敗');
      setConfirmingDelete(false);
    } finally {
      setDeleteBusy(false);
    }
  };

  if (error) return <p className={styles.state}>{error}</p>;
  if (!rows) return <p className={styles.state}>載入中…</p>;

  return (
    <div>
      <h1 className={styles.h1}>題庫健檢</h1>
      <p style={{ fontSize: 12.5, color: '#56534b', marginBottom: 14 }}>
        統計取近 20000 場提交紀錄。「陷阱出現」= 陷阱有真的說出口；「被識破」= 受測者有質疑。
        識破率長期是 0% 的題，代表陷阱可能太隱晦、或根本沒錯，值得重看。點題目名稱看完整內容；點狀態欄直接開關上線。
      </p>

      <div className={styles.filters} style={{ marginBottom: 14 }}>
        <select
          className={styles.select}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as Category | '')}
        >
          <option value="">全部分類（{rows.length} 題）</option>
          {CATEGORY_IDS.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}（{rows.filter((r) => r.category === c).length} 題）
            </option>
          ))}
        </select>
      </div>

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
              .filter((r) => !categoryFilter || r.category === categoryFilter)
              .sort((a, b) => b.served - a.served)
              .map((r) => (
                <tr key={r.id}>
                  <td>
                    <button
                      type="button"
                      className={styles.rowLink}
                      style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                      onClick={() => openDetail(r.id)}
                    >
                      {r.titleZh}
                    </button>
                  </td>
                  <td>{r.category ? CATEGORY_LABEL[r.category] : '—'}</td>
                  <td>
                    <button
                      type="button"
                      className={`${styles.pill} ${r.active ? styles.ok : styles.warn}`}
                      style={{ cursor: 'pointer', background: 'none' }}
                      disabled={busyId === r.id}
                      onClick={() => toggle(r)}
                      title="點擊切換上線 / 停用"
                    >
                      {busyId === r.id ? '處理中…' : r.active ? '上線中' : '已停用'}
                    </button>
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

      {detailId && (
        <div className={styles.helpOverlay} onClick={closeDetail}>
          <div
            className={`${styles.helpModal} ${styles.wideModal}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.helpClose}
              aria-label="關閉"
              onClick={closeDetail}
            >
              ×
            </button>

            {detailError && <p className={styles.state}>{detailError}</p>}
            {!detail && !detailError && <p className={styles.state}>載入中…</p>}

            {detail && (
              <>
                <h2>
                  {detail.titleZh}
                  <span style={{ fontWeight: 400, color: '#56534b' }}>
                    {' '}
                    · {detail.category ? CATEGORY_LABEL[detail.category] : '—'} ·{' '}
                    {detail.id}
                  </span>
                </h2>
                <p style={{ marginBottom: 14 }}>
                  <button
                    type="button"
                    className={`${styles.pill} ${detail.active ? styles.ok : styles.warn}`}
                    style={{ cursor: 'pointer', background: 'none' }}
                    disabled={busyId === detail.id}
                    onClick={() => toggle(detail)}
                  >
                    {busyId === detail.id
                      ? '處理中…'
                      : detail.active
                        ? '上線中（點擊停用）'
                        : '已停用（點擊上線）'}
                  </button>
                  {detail.note && (
                    <span style={{ marginLeft: 10, fontSize: 12, color: '#8a8778' }}>
                      備註：{detail.note}
                    </span>
                  )}
                </p>

                {(() => {
                  const served = rows.find((r) => r.id === detail.id)?.served ?? 0;
                  if (served > 0) {
                    return (
                      <p style={{ fontSize: 12, color: '#8a8778', marginBottom: 14 }}>
                        已有 {served} 場作答紀錄，不能刪除——只能停用（見上方按鈕）。
                      </p>
                    );
                  }
                  return (
                    <p style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {!confirmingDelete ? (
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={() => setConfirmingDelete(true)}
                        >
                          刪除這題
                        </button>
                      ) : (
                        <>
                          <span style={{ fontSize: 12, color: '#8a5a3a' }}>
                            從沒被抽中過，確定要永久刪除？
                          </span>
                          <button
                            type="button"
                            className={styles.btn}
                            disabled={deleteBusy}
                            onClick={() => handleDelete(detail.id)}
                          >
                            {deleteBusy ? '刪除中…' : '確定刪除'}
                          </button>
                          <button
                            type="button"
                            className={styles.btn}
                            disabled={deleteBusy}
                            onClick={() => setConfirmingDelete(false)}
                          >
                            取消
                          </button>
                        </>
                      )}
                    </p>
                  );
                })()}
                {deleteError && (
                  <p style={{ fontSize: 12, color: '#b23a3a', marginBottom: 14 }}>
                    {deleteError}
                  </p>
                )}

                <h3>brief（受測者看得到）</h3>
                <p className={styles.brief}>{detail.brief}</p>

                <h3>system（機密，沙盒 AI 人設）</h3>
                <p className={styles.pre}>{detail.system}</p>

                <h3>
                  變體（{detail.variants.length} 個，開場隨機抽一個；機密）
                </h3>
                {detail.variants.map((v, i) => (
                  <div
                    key={i}
                    style={{
                      border: '1px solid #ddd9cc',
                      background: '#fff',
                      padding: '10px 12px',
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 6 }}>
                      變體 #{i + 1}
                      {v.noTrap
                        ? '　·　無陷阱題'
                        : `　·　${v.trapType ? TRAP_TYPE_LABEL[v.trapType] : '（未標型別）'}　·　${
                            v.verifyDifficulty
                              ? VERIFY_DIFFICULTY_LABEL[v.verifyDifficulty]
                              : '（未標難度）'
                          }`}
                    </div>
                    {v.brief && (
                      <>
                        <div style={{ fontSize: 11, color: '#8a8778', marginTop: 6 }}>
                          覆寫 brief
                        </div>
                        <p className={styles.brief} style={{ marginTop: 4 }}>
                          {v.brief}
                        </p>
                      </>
                    )}
                    {!v.noTrap && (
                      <>
                        {v.injectionText && (
                          <>
                            <div style={{ fontSize: 11, color: '#8a8778', marginTop: 6 }}>
                              injectionText（要 AI 講出來的錯話）
                            </div>
                            <p className={styles.pre} style={{ marginTop: 4 }}>
                              {v.injectionText}
                            </p>
                          </>
                        )}
                        {v.correction && (
                          <>
                            <div style={{ fontSize: 11, color: '#8a8778', marginTop: 6 }}>
                              correction（正解）
                            </div>
                            <p className={styles.pre} style={{ marginTop: 4 }}>
                              {v.correction}
                            </p>
                          </>
                        )}
                        {v.verifyHint && (
                          <>
                            <div style={{ fontSize: 11, color: '#8a8778', marginTop: 6 }}>
                              verifyHint（一般人怎麼看出來）
                            </div>
                            <p className={styles.pre} style={{ marginTop: 4 }}>
                              {v.verifyHint}
                            </p>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
