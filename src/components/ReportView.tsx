/**
 * 檔案：src/components/ReportView.tsx
 * 角色：前端層 — 測驗報告的呈現（完成頁與 /exam/result/:examId 共用）
 * 功能：上半「可分享的結果卡片」（雷達 + 分級 + 分數 + 一句總評 + 品牌）＋
 *       下半「詳細分析」（進度條、做得好 / 可以更好、陷阱對照、L5 示範）。
 *       只負責畫；分享旗標的切換與資料抓取由呼叫端處理。
 */
'use client';

import { useState } from 'react';
import { Markdown } from '@/components/Markdown';
import { ResultCard, type CardOrientation } from '@/components/ResultCard';
import {
  FAMILIARITY_LABEL,
  type Report,
  type TrapReveal,
  type Familiarity,
} from '@/types/exam';
import type { FixtureDebug } from '@/lib/client-api';

const METRIC_LABELS: Record<keyof Report['scores'], string> = {
  prompt_structure: '提示詞結構',
  decomposition: '問題拆解力',
  efficiency: '對話效率',
  critical_thinking: '批判思考',
  task_completion: '任務達成率',
};

const DEV = process.env.NODE_ENV !== 'production';

function downloadFixture(dbg: FixtureDebug) {
  const blob = new Blob([JSON.stringify(dbg, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fixture-${dbg.scenarioId}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ShareControls {
  shared: boolean;
  /** 完整可分享網址（已含 origin）；shared 為 true 時有效。 */
  url: string;
  busy: boolean;
  onToggle: () => void;
}

export function ReportView({
  report,
  trap,
  exemplar,
  name = null,
  familiarity = null,
  debug = null,
  share,
  trial = false,
}: {
  report: Report;
  trap: TrapReveal | null;
  exemplar: string;
  /** 受測者顯示名稱；顯示在結果卡片上。 */
  name?: string | null;
  /** 開場自評的領域熟悉度；顯示為分數的脈絡。 */
  familiarity?: Familiarity | null;
  debug?: FixtureDebug | null;
  share?: ShareControls;
  /** 免登入試用：隱藏「截圖分享」提示（改由外層的登入卡承擔訊息）。 */
  trial?: boolean;
}) {
  const [orient, setOrient] = useState<CardOrientation>('portrait');
  const [copied, setCopied] = useState(false);
  const keys = Object.keys(METRIC_LABELS) as (keyof Report['scores'])[];

  const copyLink = async () => {
    if (!share?.url) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* 剪貼簿不可用就算了，網址仍顯示在畫面上 */
    }
  };

  const nativeShare = async () => {
    if (!share?.url) return;
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: 'AI-CAT 檢測結果', url: share.url });
        return;
      } catch {
        /* 使用者取消或不支援，退回複製 */
      }
    }
    copyLink();
  };

  return (
    <div className="report-view">
      {/* ── 完成 · 可分享的結果卡片 ── */}
      <section className="result-section">
        <div className="result-head">
          <h2 className="result-title">檢測完成</h2>
          <div
            className="pill-toggle orient-toggle"
            role="group"
            aria-label="結果卡片版面"
          >
            <button
              type="button"
              data-on={orient === 'portrait'}
              onClick={() => setOrient('portrait')}
            >
              直式
            </button>
            <button
              type="button"
              data-on={orient === 'landscape'}
              onClick={() => setOrient('landscape')}
            >
              橫式
            </button>
          </div>
        </div>

        <ResultCard
          level={report.suggested_level}
          scores={report.scores}
          summary={report.overall_summary}
          orientation={orient}
          name={name}
        />

        {share ? (
          <div className="share-box">
            {share.shared ? (
              <>
                <div className="share-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={nativeShare}
                    disabled={share.busy}
                  >
                    分享結果
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={copyLink}
                    disabled={share.busy}
                  >
                    {copied ? '已複製' : '複製連結'}
                  </button>
                  <button
                    type="button"
                    className="linkbtn"
                    onClick={share.onToggle}
                    disabled={share.busy}
                  >
                    收回分享
                  </button>
                </div>
                <p className="share-url">{share.url}</p>
                <p className="share-note">
                  這個連結任何人都能看到「上方卡片」（雷達、分級、分數、一句總評），
                  但看不到下方的陷阱對照與 L5 示範。
                </p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={share.onToggle}
                  disabled={share.busy}
                >
                  {share.busy ? '處理中…' : '建立分享連結'}
                </button>
                <p className="share-note">
                  按下後會產生一個公開連結，只顯示上方卡片，不含陷阱內容與 L5 示範。
                  可隨時收回。
                </p>
              </>
            )}
          </div>
        ) : trial ? null : (
          <p className="result-hint">截圖這張卡片即可分享到社群。</p>
        )}
      </section>

      {/* ── 分隔 ── */}
      <div className="report-divider">
        <span className="mono-label">分析報告</span>
      </div>

      {/* ── 詳細分析報告 ── */}
      <section className="panel report-card">
        <div className="meta-row">
          <strong>詳細分析</strong>
          <span className="level-badge">{report.suggested_level}</span>
        </div>
        {familiarity && familiarity !== 'mid' && (
          <p className="familiarity-note">
            作答時你自評對這個領域「{FAMILIARITY_LABEL[familiarity]}」——
            {familiarity === 'low'
              ? '任務達成率只依題目白紙黑字的限制評分，不因不熟領域細節而扣分。'
              : '任務達成率以較高標準檢視。'}
          </p>
        )}
        {keys.map((k) => (
          <div className="score-row" key={k}>
            <span>{METRIC_LABELS[k]}</span>
            <span className="score-bar">
              <span style={{ width: `${report.scores[k]}%` }} />
            </span>
            <span className="score-num">{report.scores[k]}</span>
          </div>
        ))}
        <p className="report-summary">{report.overall_summary}</p>

        {report.did_well.length > 0 && (
          <div className="fb-block">
            <h4>做得好</h4>
            <ul>
              {report.did_well.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {report.to_improve.length > 0 && (
          <div className="fb-block improve">
            <h4>可以更好</h4>
            <ul>
              {report.to_improve.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {trap && (
          <div className="trap-review">
            <div className={`trap-head ${trap.challenged ? 'ok' : 'miss'}`}>
              {trap.challenged
                ? '你有質疑對話中出現的這則資訊'
                : '你忽略了對話中一則錯誤資訊'}
            </div>
            <div className="trap-row wrong">
              <span className="trap-label">對話中出現</span>
              <p>{trap.injectionText}</p>
            </div>
            {trap.correction && (
              <div className="trap-row right">
                <span className="trap-label">正確資訊</span>
                <p>{trap.correction}</p>
              </div>
            )}
          </div>
        )}

        {exemplar && (
          <details className="exemplar">
            <summary className="exemplar-head">
              L5 高手會怎麼用 AI 完成這題
            </summary>
            <div className="exemplar-body">
              <Markdown>{exemplar}</Markdown>
            </div>
          </details>
        )}
      </section>

      {DEV && debug && (
        <button
          type="button"
          className="btn ghost"
          onClick={() => downloadFixture(debug)}
          title="存到 scripts/fixtures/ 給 npm run judge:reliability 用"
        >
          ⬇ 下載 fixture JSON（本地開發）
        </button>
      )}
    </div>
  );
}
