/**
 * 檔案：src/components/ScoreTrend.tsx
 * 角色：前端層 — /me 的「分數走勢」折線圖（Recharts）
 * 功能：吃一串「舊 → 新」排序的場次（加權平均分 0–100 + 日期 / 標題 / 分類 / 分級），
 *       畫一條折線；滑鼠移過去的點顯示該場的日期、標題、分類、分數與分級。
 *       線與格線走主題 token；少於兩點不畫。
 */
'use client';

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LevelCode } from '@/types/exam';

export interface TrendPoint {
  /** 加權平均分（0–100）。 */
  value: number;
  /** 顯示用日期字串。 */
  date: string;
  /** 情境標題。 */
  title: string;
  /** 分類中文名；沒有就 null。 */
  category: string | null;
  /** 該場分級。 */
  level: LevelCode;
}

interface TipProps {
  active?: boolean;
  payload?: { payload: TrendPoint }[];
}

function TrendTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="trend-tip">
      <p className="trend-tip__date">{p.date}</p>
      <p className="trend-tip__title">{p.title}</p>
      <p className="trend-tip__meta">
        {p.category ? <span className="trend-tip__cat">{p.category}</span> : null}
        <span className="trend-tip__score">
          {p.value}
          <em>{p.level}</em>
        </span>
      </p>
    </div>
  );
}

export function ScoreTrend({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) return null;
  return (
    <div className="score-trend">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          margin={{ top: 8, right: 10, bottom: 4, left: 10 }}
        >
          <XAxis dataKey="date" hide />
          <YAxis domain={[0, 100]} hide />
          <Tooltip
            content={<TrendTip />}
            cursor={{ stroke: 'var(--grid)', strokeWidth: 1 }}
            wrapperStyle={{ outline: 'none' }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--radar-stroke)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--radar-stroke)', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: 'var(--radar-stroke)', strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
