/**
 * 檔案：src/app/admin/review/[examId]/page.tsx  →  /admin/review/:examId
 * 角色：前端層 — 標註頁本體（P3：對訓練資料最關鍵的一塊）
 * 功能：讀逐字稿 + AI 給的分數 → 每個維度選一個桶（預設同意 AI，零點擊）；
 *       確認「質疑陷阱」判定對不對；留一句備註。存檔或存檔後跳下一筆未標註的。
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getReviewItem,
  saveReviewLabel,
  getReviewQueue,
  AdminApiError,
  type AdminExamDetail,
  type JudgeLabel,
} from '@/lib/admin-client';
import {
  CATEGORY_LABEL,
  FAMILIARITY_LABEL,
  TRAP_TYPE_LABEL,
  VERIFY_DIFFICULTY_LABEL,
} from '@/types/exam';
import { AiCatMark } from '@/components/AiCatMark';
import {
  SCORE_KEYS,
  SCORE_KEY_LABEL,
  SCORE_BUCKETS,
  SCORE_BUCKET_LABEL,
  nearestBucket,
  type ScoreBucket,
  type ScoreKey,
} from '@/types/label';
import ReviewGuide from '../ReviewGuide';
import styles from '../../admin.module.css';

export default function AdminReviewItemPage() {
  const params = useParams<{ examId: string }>();
  const router = useRouter();

  const [exam, setExam] = useState<AdminExamDetail | null>(null);
  const [myLabel, setMyLabel] = useState<JudgeLabel | null>(null);
  const [otherLabels, setOtherLabels] = useState<JudgeLabel[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [scores, setScores] = useState<Record<ScoreKey, ScoreBucket> | null>(null);
  const [challengedCorrect, setChallengedCorrect] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState<'save' | 'next' | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getReviewItem(params.examId)
      .then(({ exam: e, myLabel: label, otherLabels: others }) => {
        if (!alive) return;
        setExam(e);
        setMyLabel(label);
        setOtherLabels(others);
        setScores(
          label?.scores ??
            (Object.fromEntries(
              SCORE_KEYS.map((k) => [k, nearestBucket(e.report.scores[k])]),
            ) as Record<ScoreKey, ScoreBucket>),
        );
        setChallengedCorrect(label?.challengedCorrect ?? null);
        setNote(label?.note ?? '');
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof AdminApiError && err.forbidden) {
          setError('這個帳號不在後台管理員名單內。');
        } else {
          setError(err instanceof Error ? err.message : '讀取失敗');
        }
      });
    return () => {
      alive = false;
    };
  }, [params.examId]);

  const scoreKeys = useMemo(() => SCORE_KEYS, []);

  if (error) return <p className={styles.state}>{error}</p>;
  if (!exam || !scores) return <p className={styles.state}>載入中…</p>;

  const save = async (goNext: boolean) => {
    setSaving(goNext ? 'next' : 'save');
    setSavedMsg(null);
    try {
      await saveReviewLabel(exam.examId, { scores, challengedCorrect, note });
      if (!goNext) {
        setSavedMsg('已儲存。');
        setSaving(null);
        return;
      }
      const q = await getReviewQueue({ onlyUnlabeled: true, limit: 1, offset: 0 });
      const nextItem = q.rows.find((r) => r.examId !== exam.examId) ?? q.rows[0];
      if (nextItem) {
        router.push(`/admin/review/${nextItem.examId}`);
      } else {
        router.push('/admin/review');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗');
      setSaving(null);
    }
  };

  return (
    <div>
      <p style={{ marginBottom: 12 }}>
        <Link className={styles.rowLink} href="/admin/review">
          ← 回審核佇列
        </Link>{' '}
        <ReviewGuide />
        {myLabel && (
          <span className={`${styles.pill} ${styles.ok}`} style={{ marginLeft: 10 }}>
            你標過了（{new Date(myLabel.updatedAt).toLocaleDateString('zh-TW')}）
          </span>
        )}
        {otherLabels.length > 0 && (
          <span className={`${styles.pill} ${styles.warn}`} style={{ marginLeft: 10 }}>
            另有 {otherLabels.length} 人標過
          </span>
        )}
      </p>
      <h1 className={styles.h1}>
        {exam.titleZh ?? exam.examId} · AI 判 {exam.report.suggested_level} ·{' '}
        {exam.weightedAverage} 分
      </h1>

      <div className={styles.reviewGrid}>
        <div className={styles.reviewMain}>
          <div className={styles.detailGrid}>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>分類</span>
              <span>{exam.category ? CATEGORY_LABEL[exam.category] : '—'}</span>
            </div>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>熟悉度自評</span>
              <span>{exam.familiarity ? FAMILIARITY_LABEL[exam.familiarity] : '—'}</span>
            </div>
            {!exam.noTrap && (
              <div className={styles.kv}>
                <span className={styles.kvLabel}>陷阱型別 / 難度</span>
                <span>
                  {exam.trapType ? TRAP_TYPE_LABEL[exam.trapType] : '—'} ·{' '}
                  {exam.verifyDifficulty ? VERIFY_DIFFICULTY_LABEL[exam.verifyDifficulty] : '—'}
                </span>
              </div>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>題目內容（受測者當時看到的任務與限制）</div>
            {exam.brief ? (
              <p className={styles.brief}>{exam.brief}</p>
            ) : (
              <p className={styles.state} style={{ padding: 0 }}>
                還原不到原題目（題庫可能已異動或刪除這個變體）。
              </p>
            )}
          </div>

          <div className={`${styles.section} ${styles.hypothesis}`}>
            <div className={styles.sectionTitle}>
              AI 裁判的總評 / 回饋
              <span className={styles.pill}>僅供參考</span>
            </div>
            <p style={{ fontSize: 12.5 }}>{exam.report.overall_summary}</p>
            {exam.report.did_well.length > 0 && (
              <>
                <p style={{ fontSize: 11, color: '#1e874b', marginTop: 8, fontWeight: 700 }}>
                  做得好
                </p>
                <ul style={{ fontSize: 12.5, paddingLeft: 18 }}>
                  {exam.report.did_well.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}
            {exam.report.to_improve.length > 0 && (
              <>
                <p style={{ fontSize: 11, color: '#b23b3b', marginTop: 8, fontWeight: 700 }}>
                  可以更好
                </p>
                <ul style={{ fontSize: 12.5, paddingLeft: 18 }}>
                  {exam.report.to_improve.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {exam.trap && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>植入的陷阱</div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>錯誤敘述</span>
                <span>{exam.trap.injectionText}</span>
              </div>
              {exam.trap.correction && (
                <div className={styles.kv}>
                  <span className={styles.kvLabel}>正確資訊</span>
                  <span>{exam.trap.correction}</span>
                </div>
              )}
            </div>
          )}

          <div className={styles.section}>
            <div className={styles.sectionTitle}>對話逐字稿</div>
            {!exam.transcript || exam.transcript.length === 0 ? (
              <p className={styles.state} style={{ padding: 0 }}>沒有逐字稿。</p>
            ) : (
              <div className={styles.transcript}>
                {exam.transcript.map((m, i) => (
                  <div
                    key={i}
                    className={`${styles.msg} ${m.role === 'user' ? styles.user : styles.assistant}`}
                  >
                    <span className={styles.msgRole}>
                      {m.role === 'assistant' && <AiCatMark size={12} />}
                      {m.role === 'user' ? '使用者' : 'AI'}
                    </span>
                    {m.content}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.reviewSidebar}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>你的標註 —— 每個維度選一個程度（已預設同意 AI）</div>
            {scoreKeys.map((k) => (
              <div key={k} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 13 }}>{SCORE_KEY_LABEL[k]}</strong>
                  <span style={{ fontSize: 11, color: '#56534b' }}>
                    AI 給 {exam.report.scores[k]} 分（最接近「{SCORE_BUCKET_LABEL[nearestBucket(exam.report.scores[k])]}」）
                  </span>
                  {otherLabels.map((l) => (
                    <span
                      key={l.reviewerEmail}
                      className={`${styles.pill} ${l.scores[k] === scores[k] ? styles.ok : styles.warn}`}
                      title={l.reviewerEmail}
                    >
                      {l.reviewerEmail.split('@')[0]}：{SCORE_BUCKET_LABEL[l.scores[k]]}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {SCORE_BUCKETS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      className={styles.btn}
                      style={
                        scores[k] === b
                          ? { background: '#16181a', color: '#f4f3ee', borderColor: '#16181a' }
                          : undefined
                      }
                      onClick={() => setScores({ ...scores, [k]: b })}
                    >
                      {SCORE_BUCKET_LABEL[b]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {exam.trap != null ? (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                AI 判定「受測者是否質疑陷阱」= {exam.report.user_challenged ? '有質疑' : '沒有質疑'}，對嗎？
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(
                  [
                    ['correct', true, '判斷正確'],
                    ['incorrect', false, '判斷錯誤'],
                    ['skip', null, '不確定 / 跳過'],
                  ] as const
                ).map(([key, val, text]) => (
                  <button
                    key={key}
                    type="button"
                    className={styles.btn}
                    style={
                      challengedCorrect === val
                        ? { background: '#16181a', color: '#f4f3ee', borderColor: '#16181a' }
                        : undefined
                    }
                    onClick={() => setChallengedCorrect(val)}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className={styles.section}>
            <div className={styles.sectionTitle}>備註（選填）</div>
            <textarea
              className={styles.input}
              style={{ width: '100%', minHeight: 70, fontFamily: 'inherit' }}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：AI 漏看了使用者其實有要求逐步列式驗算…"
            />
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={styles.btn}
              disabled={saving !== null}
              onClick={() => save(false)}
            >
              {saving === 'save' ? '儲存中…' : '儲存'}
            </button>
            <button
              type="button"
              className={styles.btn}
              style={{ background: '#16181a', color: '#f4f3ee', borderColor: '#16181a' }}
              disabled={saving !== null}
              onClick={() => save(true)}
            >
              {saving === 'next' ? '處理中…' : '儲存並下一筆未標註 →'}
            </button>
            {savedMsg && <span style={{ fontSize: 12, color: '#1e874b' }}>{savedMsg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
