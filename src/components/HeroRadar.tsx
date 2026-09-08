/**
 * 檔案：src/components/HeroRadar.tsx
 * 角色：前端層 — 著陸頁右側「能力模型」示意雷達圖（動態）
 * 功能：每 5 秒切換 L1→L2→…→L5→L1；雷達多邊形以 requestAnimationFrame
 *       逐幀插值 morph（非 slide / 非圖片切換），AI SCORE 數字同步跳動。
 *       尊重 prefers-reduced-motion（直接跳值不做動畫）。
 */
'use client';

import { useEffect, useRef, useState } from 'react';

/** 五軸單位向量（外頂點 - 圓心(200,200)）：描述↑ / 委派↗ / 任務達成↘ / 審慎↙ / 辨別↖ */
const AXIS: [number, number][] = [
  [0, -150],
  [142.7, -46.4],
  [88.2, 121.4],
  [-88.2, 121.4],
  [-142.7, -46.4],
];
const RINGS = [
  '200,50 342.7,153.6 288.2,321.4 111.8,321.4 57.3,153.6',
  '200,100 295.1,169.1 258.8,281 141.2,281 104.9,169.1',
  '200,150 247.6,184.5 229.4,240.5 170.6,240.5 152.4,184.5',
];
const SPOKES = [
  '200,50',
  '342.7,153.6',
  '288.2,321.4',
  '111.8,321.4',
  '57.3,153.6',
];
type Anchor = 'start' | 'middle' | 'end';
const LABELS: [string, number, number, Anchor][] = [
  ['描述', 200, 32, 'middle'],
  ['委派', 356, 150, 'start'],
  ['任務達成', 300, 347, 'middle'],
  ['審慎', 100, 347, 'middle'],
  ['辨別', 44, 150, 'end'],
];

const LEVELS = [
  {
    code: 'L1',
    name: 'AI NOVICE',
    desc: '還在把 AI 當搜尋引擎，少給脈絡、也少驗證輸出。',
    scores: [28, 20, 42, 18, 30],
  },
  {
    code: 'L2',
    name: 'AI USER',
    desc: '能讓 AI 產出堪用結果，但多半一次丟完、少追問。',
    scores: [46, 38, 56, 34, 48],
  },
  {
    code: 'L3',
    name: 'AI PRACTITIONER',
    desc: '會拆步驟、要求格式，開始檢查 AI 給的內容。',
    scores: [64, 58, 72, 52, 65],
  },
  {
    code: 'L4',
    name: 'AI COLLABORATOR',
    desc: '能駕馭 AI 完成複雜任務，並主動檢查與修正 AI 的輸出。',
    scores: [86, 78, 91, 74, 83],
  },
  {
    code: 'L5',
    name: 'AI ORCHESTRATOR',
    desc: '把 AI 當協作者：分工、交叉驗證，逐步收斂到高品質成品。',
    scores: [95, 92, 96, 90, 93],
  },
];

const START = 3; // L4，與 Hero.dc 靜態稿一致
const CYCLE_MS = 5000;
const TWEEN_MS = 900;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function vertex(i: number, s: number): [number, number] {
  return [200 + (AXIS[i][0] * s) / 100, 200 + (AXIS[i][1] * s) / 100];
}
const polyPoints = (scores: number[]) =>
  scores
    .map((s, i) => vertex(i, s).map((n) => n.toFixed(1)).join(','))
    .join(' ');
const mean = (a: number[]) =>
  Math.round(a.reduce((s, n) => s + n, 0) / a.length);

export function HeroRadar() {
  const [idx, setIdx] = useState(START);
  const [scores, setScores] = useState<number[]>(LEVELS[START].scores);
  const scoresRef = useRef(scores);
  scoresRef.current = scores;
  const rafRef = useRef<number | null>(null);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setInterval(
      () => setIdx((i) => (i + 1) % LEVELS.length),
      CYCLE_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const target = LEVELS[idx].scores;
    if (reduced.current) {
      setScores(target);
      return;
    }
    const from = scoresRef.current.slice();
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / TWEEN_MS);
      const e = easeOutCubic(t);
      setScores(from.map((f, k) => f + (target[k] - f) * e));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [idx]);

  const lvl = LEVELS[idx];

  return (
    <>
      <svg viewBox="0 0 400 400" aria-hidden="true">
        {RINGS.map((p, i) => (
          <polygon
            key={p}
            points={p}
            style={{
              fill: i === 0 ? 'var(--radar-base)' : 'none',
              stroke: 'var(--grid)',
            }}
          />
        ))}
        {SPOKES.map((p) => (
          <line
            key={p}
            x1="200"
            y1="200"
            x2={p.split(',')[0]}
            y2={p.split(',')[1]}
            style={{ stroke: 'var(--grid)' }}
          />
        ))}
        <polygon
          points={polyPoints(scores)}
          style={{
            fill: 'var(--radar-fill)',
            stroke: 'var(--radar-stroke)',
            strokeWidth: 2,
          }}
        />
        {scores.map((s, i) => {
          const [x, y] = vertex(i, s);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="4.5"
              style={{ fill: 'var(--radar-stroke)' }}
            />
          );
        })}
        {LABELS.map(([label, x, y, anchor]) => (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor={anchor}
            fontSize="13"
            style={{
              fill: 'var(--fg-muted)',
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            {label}
          </text>
        ))}
      </svg>

      <div className="lp-level" key={lvl.code}>
        <div>
          <div className="lvl">
            <b>{lvl.code}</b>
            <span>{lvl.name}</span>
          </div>
          <p>{lvl.desc}</p>
        </div>
        <div className="score">
          <div className="s">{mean(scores)}</div>
          <div className="k">AI SCORE</div>
        </div>
      </div>
    </>
  );
}
