/**
 * 檔案：src/components/ScoreTrend.tsx
 * 角色：前端層 — /me 的「分數走勢」迷你折線圖（無動畫）
 * 功能：吃一串「舊 → 新」排序的加權平均分（0–100），畫一條折線 + 淡填色，
 *       標出最新一點。純 SVG、顏色走主題 token；少於兩點不畫。
 */
const W = 320;
const H = 84;
const PAD = 10;

export function ScoreTrend({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const n = values.length;
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (n - 1);
  const y = (v: number) => PAD + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - PAD * 2);

  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const base = (H - PAD).toFixed(1);
  const area = `${x(0).toFixed(1)},${base} ${line} ${x(n - 1).toFixed(1)},${base}`;
  const last = values[n - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="score-trend"
      role="img"
      aria-label={`分數走勢，由舊到新：${values.join('、')}`}
    >
      {[25, 50, 75].map((g) => (
        <line
          key={g}
          x1={PAD}
          x2={W - PAD}
          y1={y(g)}
          y2={y(g)}
          style={{ stroke: 'var(--grid)' }}
        />
      ))}
      <polygon points={area} style={{ fill: 'var(--radar-fill)' }} />
      <polyline
        points={line}
        style={{ fill: 'none', stroke: 'var(--radar-stroke)', strokeWidth: 2 }}
      />
      <circle
        cx={x(n - 1)}
        cy={y(last)}
        r="3.5"
        style={{ fill: 'var(--radar-stroke)' }}
      />
    </svg>
  );
}
