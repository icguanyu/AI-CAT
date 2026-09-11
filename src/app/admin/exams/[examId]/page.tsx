/**
 * 檔案：src/app/admin/exams/[examId]/page.tsx  →  /admin/exams/:examId
 * 角色：前端層 — 單場測驗完整資料（P1）
 * 功能：分數、裁判原始輸出、陷阱資訊、投入訊號、對話逐字稿——支援除錯 / 稽核。
 */
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getAdminExamDetail,
  setExamExcluded,
  AdminApiError,
  type AdminExamDetail,
} from '@/lib/admin-client';
import {
  CATEGORY_LABEL,
  FAMILIARITY_LABEL,
  TRAP_TYPE_LABEL,
  VERIFY_DIFFICULTY_LABEL,
} from '@/types/exam';
import styles from '../../admin.module.css';

const METRIC_LABELS: Record<string, string> = {
  prompt_structure: '提示詞結構',
  decomposition: '問題拆解力',
  efficiency: '對話效率',
  critical_thinking: '批判思考',
  task_completion: '任務達成率',
};

export default function AdminExamDetailPage() {
  const params = useParams<{ examId: string }>();
  const [data, setData] = useState<AdminExamDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [excludeBusy, setExcludeBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getAdminExamDetail(params.examId)
      .then((d) => alive && setData(d))
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
  }, [params.examId]);

  if (error) return <p className={styles.state}>{error}</p>;
  if (!data) return <p className={styles.state}>載入中…</p>;

  const scoreKeys = Object.keys(METRIC_LABELS) as (keyof typeof data.report.scores)[];

  const toggleExclude = async () => {
    setExcludeBusy(true);
    try {
      await setExamExcluded(data.examId, !data.excludedFromTraining);
      setData({ ...data, excludedFromTraining: !data.excludedFromTraining });
    } catch {
      /* 失敗就維持原狀 */
    } finally {
      setExcludeBusy(false);
    }
  };

  return (
    <div>
      <p style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
        <Link className={styles.rowLink} href="/admin/exams">
          ← 回測驗查詢
        </Link>
        <button
          type="button"
          className={`${styles.pill} ${data.excludedFromTraining ? styles.warn : styles.ok}`}
          style={{ cursor: 'pointer', background: 'none' }}
          disabled={excludeBusy}
          onClick={toggleExclude}
          title="標記後，日後匯出訓練資料會跳過這筆；不影響評分或使用者看到的報告"
        >
          {excludeBusy
            ? '處理中…'
            : data.excludedFromTraining
              ? '已排除訓練集（點擊取消）'
              : '納入訓練集（點擊排除）'}
        </button>
      </p>
      <h1 className={styles.h1}>
        {data.titleZh ?? data.examId} · {data.report.suggested_level} ·{' '}
        {data.weightedAverage} 分
      </h1>

      <div className={styles.detailGrid}>
        <div className={styles.kv}>
          <span className={styles.kvLabel}>使用者</span>
          <span>
            <Link className={styles.rowLink} href={`/admin/users/${data.userId}`}>
              {data.email ?? data.userId}
            </Link>
          </span>
        </div>
        <div className={styles.kv}>
          <span className={styles.kvLabel}>提交時間</span>
          <span>{new Date(data.createdAt).toLocaleString('zh-TW')}</span>
        </div>
        <div className={styles.kv}>
          <span className={styles.kvLabel}>分類</span>
          <span>{data.category ? CATEGORY_LABEL[data.category] : '—'}</span>
        </div>
        <div className={styles.kv}>
          <span className={styles.kvLabel}>熟悉度自評</span>
          <span>{data.familiarity ? FAMILIARITY_LABEL[data.familiarity] : '—'}</span>
        </div>
        <div className={styles.kv}>
          <span className={styles.kvLabel}>自填年齡 / 學歷 / 性別</span>
          <span>
            {data.ageBand ?? '—'} / {data.education ?? '—'} / {data.gender ?? '—'}
          </span>
        </div>
        <div className={styles.kv}>
          <span className={styles.kvLabel}>裁判版本</span>
          <span>{data.judgeVersion ?? '—'}</span>
        </div>
        <div className={styles.kv}>
          <span className={styles.kvLabel}>已分享</span>
          <span>{data.shared ? '是' : '否'}</span>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>題目內容（受測者當時看到的任務與限制）</div>
        {data.brief ? (
          <p className={styles.brief}>{data.brief}</p>
        ) : (
          <p className={styles.state} style={{ padding: 0 }}>
            還原不到原題目（題庫可能已異動或刪除這個變體）。
          </p>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>五維分數</div>
        {scoreKeys.map((k) => (
          <div className={styles.barRow} key={k}>
            <span className={styles.barLabel}>{METRIC_LABELS[k]}</span>
            <span className={styles.barTrack}>
              <span
                className={styles.barFill}
                style={{ width: `${data.report.scores[k]}%` }}
              />
            </span>
            <span className={styles.barCount}>{data.report.scores[k]}</span>
          </div>
        ))}
        <p style={{ fontSize: 12.5, marginTop: 10 }}>{data.report.overall_summary}</p>
      </div>

      {(data.report.did_well.length > 0 || data.report.to_improve.length > 0) && (
        <div className={styles.detailGrid}>
          {data.report.did_well.length > 0 && (
            <div>
              <div className={styles.sectionTitle}>做得好</div>
              <ul style={{ fontSize: 12.5, paddingLeft: 18 }}>
                {data.report.did_well.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {data.report.to_improve.length > 0 && (
            <div>
              <div className={styles.sectionTitle}>可以更好</div>
              <ul style={{ fontSize: 12.5, paddingLeft: 18 }}>
                {data.report.to_improve.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>陷阱</div>
        {data.noTrap ? (
          <p className={styles.state} style={{ padding: 0 }}>
            這題本身沒有陷阱（no-trap 變體）。
          </p>
        ) : !data.trap ? (
          <p className={styles.state} style={{ padding: 0 }}>
            已排定注入輪次 {data.injectAtTurn ?? '—'}，但沒有生效（未走到該輪 / 沒說出口）。
          </p>
        ) : (
          <div className={styles.detailGrid}>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>型別 / 難度</span>
              <span>
                {data.trapType ? TRAP_TYPE_LABEL[data.trapType] : '—'} ·{' '}
                {data.verifyDifficulty ? VERIFY_DIFFICULTY_LABEL[data.verifyDifficulty] : '—'}
              </span>
            </div>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>受測者是否質疑</span>
              <span
                className={`${styles.pill} ${data.trap.challenged ? styles.ok : styles.warn}`}
                style={{ width: 'fit-content' }}
              >
                {data.trap.challenged ? '有質疑' : '沒有質疑'}
              </span>
            </div>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>植入的錯誤敘述</span>
              <span>{data.trap.injectionText}</span>
            </div>
            {data.trap.correction && (
              <div className={styles.kv}>
                <span className={styles.kvLabel}>正確資訊</span>
                <span>{data.trap.correction}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {data.engagement && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>投入程度訊號</div>
          <div className={styles.detailGrid}>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>耗時</span>
              <span>{data.engagement.elapsedSec} 秒</span>
            </div>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>發話輪次</span>
              <span>{data.engagement.userTurns}</span>
            </div>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>輸入字數</span>
              <span>{data.engagement.userCharsTotal}</span>
            </div>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>走到注入輪</span>
              <span>
                {data.engagement.reachedInjection == null
                  ? '—'
                  : data.engagement.reachedInjection
                    ? '是'
                    : '否'}
              </span>
            </div>
          </div>
        </div>
      )}

      {data.judgeRaw && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>裁判原始輸出（未加工）</div>
          <pre className={styles.pre}>{JSON.stringify(data.judgeRaw, null, 2)}</pre>
        </div>
      )}

      {data.exemplar && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>L5 示範</div>
          <pre className={styles.pre}>{data.exemplar}</pre>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          對話逐字稿{data.transcript ? `（${data.transcript.length} 則）` : ''}
        </div>
        {!data.transcript || data.transcript.length === 0 ? (
          <p className={styles.state} style={{ padding: 0 }}>
            沒有逐字稿（此欄上線前的舊報告）。
          </p>
        ) : (
          <div className={styles.transcript}>
            {data.transcript.map((m, i) => (
              <div
                key={i}
                className={`${styles.msg} ${m.role === 'user' ? styles.user : styles.assistant}`}
              >
                <span className={styles.msgRole}>{m.role === 'user' ? '使用者' : 'AI'}</span>
                {m.content}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
