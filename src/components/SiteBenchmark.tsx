/**
 * 檔案：src/components/SiteBenchmark.tsx
 * 角色：前端層 — 著陸頁「本站平均」區塊（Server Component，無互動）
 * 功能：顯示全站平均分級與平均 AI SCORE，誘發「我會在平均之上還是之下」的比較心理。
 *       stats 為 null（資料太少 / 讀取失敗）時不渲染。
 */
import { SHOW_COUNT_AT, type SiteStats } from '@/lib/site-stats';

export function SiteBenchmark({ stats }: { stats: SiteStats | null }) {
  if (!stats) return null;

  return (
    <div className="benchmark">
      <span className="benchmark-tag">本站受測者平均</span>
      <div className="benchmark-figures">
        <div className="benchmark-fig">
          <b>L{stats.avgLevelNumeric.toFixed(1)}</b>
          <span>平均分級</span>
        </div>
        <div className="benchmark-fig">
          <b>{stats.avgScore}</b>
          <span>AI SCORE</span>
        </div>
      </div>
      <p className="benchmark-cta">
        你會落在平均之上，還是之下？
        {stats.count >= SHOW_COUNT_AT && (
          <span className="benchmark-count">
            {' '}
            已累積 {stats.count.toLocaleString('en-US')} 場檢測
          </span>
        )}
      </p>
    </div>
  );
}
