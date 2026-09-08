/**
 * 檔案：src/components/ScoreRadar.tsx
 * 角色：前端層 — 報告 / 分享卡片用的「靜態」五維雷達圖（無動畫）
 * 功能：吃五個分數（依 METRIC_LABELS 的鍵序：提示詞結構 / 問題拆解 / 對話效率 /
 *       批判思考 / 任務達成），畫一次。幾何沿用 HeroRadar；顏色走主題 token，
 *       亮 / 暗都能呈現。
 */
type Anchor = 'start' | 'middle' | 'end';

/** 五軸單位向量（外頂點 − 圓心 200,200）：↑ ↗ ↘ ↙ ↖ */
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
const LABEL_POS: [number, number, Anchor][] = [
  [200, 30, 'middle'],
  [362, 150, 'start'],
  [300, 350, 'middle'],
  [100, 350, 'middle'],
  [38, 150, 'end'],
];
const DEFAULT_LABELS = ['提示結構', '問題拆解', '對話效率', '批判思考', '任務達成'];

function vertex(i: number, s: number): [number, number] {
  return [200 + (AXIS[i][0] * s) / 100, 200 + (AXIS[i][1] * s) / 100];
}
const polyPoints = (scores: number[]) =>
  scores
    .map((s, i) =>
      vertex(i, s)
        .map((n) => n.toFixed(1))
        .join(','),
    )
    .join(' ');

export function ScoreRadar({
  scores,
  labels = DEFAULT_LABELS,
  className,
}: {
  scores: number[];
  labels?: string[];
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      role="img"
      aria-label={`五維能力雷達圖：${labels
        .map((l, i) => `${l} ${Math.round(scores[i] ?? 0)}`)
        .join('、')}`}
    >
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
            r="4"
            style={{ fill: 'var(--radar-stroke)' }}
          />
        );
      })}
      {labels.map((label, i) => {
        const [x, y, anchor] = LABEL_POS[i];
        return (
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
        );
      })}
    </svg>
  );
}
