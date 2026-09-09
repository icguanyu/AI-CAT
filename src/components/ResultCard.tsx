/**
 * 檔案：src/components/ResultCard.tsx
 * 角色：前端層 — 測驗「完成頁」的可分享結果卡片
 * 功能：品牌視覺（AiCatMark + 字標 + mono 標籤）+ 靜態雷達圖 + 分級(L1–L5) +
 *       綜合分數 + 一句總評。直式 / 橫式兩種版面（由 orientation 決定）。
 *       跟隨亮 / 暗主題（全走 CSS token）。此檔只負責 UI，不含分享 / 匯出邏輯。
 */
'use client';

import { LEVEL_NAME, type Report } from '@/types/exam';
import { AiCatMark } from '@/components/AiCatMark';
import { ScoreRadar } from '@/components/ScoreRadar';

/** 與 METRIC_LABELS 相同的鍵序（雷達五軸的順序）。 */
const ORDER: (keyof Report['scores'])[] = [
  'prompt_structure',
  'decomposition',
  'efficiency',
  'critical_thinking',
  'task_completion',
];

const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-cat-dusky.vercel.app'
).replace(/^https?:\/\//, '');

export type CardOrientation = 'portrait' | 'landscape';

export function ResultCard({
  level,
  scores,
  summary,
  orientation,
  name,
}: {
  level: Report['suggested_level'];
  scores: Report['scores'];
  summary: string;
  orientation: CardOrientation;
  /** 受測者顯示名稱；有值才在卡片上顯示。 */
  name?: string | null;
}) {
  const arr = ORDER.map((k) => scores[k]);
  const overall = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

  return (
    <div className={`result-card ${orientation}`}>
      <div className="rc-brand">
        <AiCatMark size={20} />
        <span className="rc-word">AI-CAT</span>
        <span className="mono-label">AI 能力檢測</span>
      </div>

      <div className="rc-body">
        <div className="rc-radar">
          <ScoreRadar scores={arr} />
        </div>

        <div className="rc-meta">
          {name ? <p className="rc-name">{name}</p> : null}
          <div className="rc-level">
            <b>{level}</b>
            <span>{LEVEL_NAME[level]}</span>
          </div>
          <div className="rc-score">
            <span className="n">{overall}</span>
            <span className="k">AI SCORE</span>
          </div>
          <p className="rc-summary">{summary}</p>
        </div>
      </div>

      <div className="rc-foot">
        <span className="mono-label">AI COMPETENCY ASSESSMENT</span>
        <span className="mono-label">{SITE}</span>
      </div>
    </div>
  );
}
