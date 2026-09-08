/**
 * 檔案：src/components/EvaluatingCat.tsx
 * 角色：前端層 — 「AI-CAT 評分中」全畫面等待指示器
 * 功能：提交評分後、跳轉結果頁前顯示。純 CSS 動畫的貓＋一道光掃過臉
 *       （取自「AI-CAT Thinking 動畫」設計稿 §02 掃描狀態，工具感最強），
 *       搭配「評分中」＋三點跳動＋等寬狀態標。
 *       等待超過 30 秒時，追加一段文案提醒使用者不要離開畫面。
 *       顏色走主題變數；尊重 prefers-reduced-motion（動畫在 globals.css 內關閉）。
 */
'use client';

import { useEffect, useId, useState } from 'react';

export function EvaluatingCat() {
  const clipId = useId();
  const [longWait, setLongWait] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLongWait(true), 30_000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="evaluating" role="status" aria-live="polite">
      <svg
        viewBox="-8 -4 116 104"
        className="evaluating__cat"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <clipPath id={clipId}>
            <polygon points="50,12 88,39.6 73.5,84.4 26.5,84.4 12,39.6" />
          </clipPath>
        </defs>
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={6.5}
          strokeLinejoin="round"
        >
          <polygon points="12,39.6 5,9 33,21" />
          <polygon points="88,39.6 95,9 67,21" />
          <polygon points="50,12 88,39.6 73.5,84.4 26.5,84.4 12,39.6" />
        </g>
        <g clipPath={`url(#${clipId})`}>
          <rect
            className="evaluating__scan"
            x="12"
            y="8"
            width="76"
            height="3.5"
            fill="currentColor"
          />
        </g>
        <circle cx="37" cy="48" r="4.5" fill="currentColor" />
        <circle cx="63" cy="48" r="4.5" fill="currentColor" />
        <g stroke="currentColor" strokeWidth={4.5} strokeLinecap="round">
          <line x1="-3" y1="58" x2="15" y2="58" />
          <line x1="-1" y1="69" x2="18" y2="69" />
          <line x1="103" y1="58" x2="85" y2="58" />
          <line x1="101" y1="69" x2="82" y2="69" />
        </g>
      </svg>

      <div className="evaluating__line">
        <span className="evaluating__text">評分中</span>
        <span className="evaluating__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>
      <span className="evaluating__sub">AI JUDGE · SCORING</span>

      {longWait && (
        <p className="evaluating__hint">
          正在努力分析整段對話，通常再幾秒就好。
          <br />
          請不要關閉或離開這個畫面。
        </p>
      )}
    </div>
  );
}
