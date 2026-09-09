/**
 * 檔案：src/app/s/[examId]/opengraph-image.tsx
 * 角色：前端層 — 公開分享頁的社群預覽卡片圖（1200×630）
 * 功能：貼連結到 Slack / Twitter / FB 時自動顯示。純文字版（全 ASCII，免載 CJK 字型）：
 *       品牌 + 分級 + 分級名稱 + AI SCORE + 網域。資料同 /s 頁的 getSharedCard()。
 */
import { ImageResponse } from 'next/og';
import { getSharedCard } from '@/lib/exam-reports';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'AI-CAT assessment result';

const LEVEL_NAME: Record<string, string> = {
  L1: 'AI NOVICE',
  L2: 'AI USER',
  L3: 'AI PRACTITIONER',
  L4: 'AI COLLABORATOR',
  L5: 'AI ORCHESTRATOR',
};

const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.ai-cat.app'
).replace(/^https?:\/\//, '');

export default async function Image({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const card = await getSharedCard(examId);

  const level = card?.suggested_level ?? '';
  const name = card
    ? LEVEL_NAME[card.suggested_level] ?? ''
    : 'AI COMPETENCY ASSESSMENT';
  const score = card
    ? Math.round(
        Object.values(card.scores).reduce((a, b) => a + b, 0) /
          Object.values(card.scores).length,
      )
    : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0b0c0d',
          color: '#f4f4f1',
          padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 16, height: 16, background: '#d8ff4f' }} />
          <span
            style={{ fontSize: 34, fontWeight: 800, letterSpacing: 3, marginLeft: 16 }}
          >
            AI-CAT
          </span>
          <span
            style={{ fontSize: 20, color: '#8a8f92', letterSpacing: 6, marginLeft: 20 }}
          >
            AI COMPETENCY ASSESSMENT
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{ fontSize: 200, fontWeight: 900, color: '#d8ff4f', lineHeight: 1 }}
          >
            {level || '—'}
          </span>
          <span
            style={{ fontSize: 44, letterSpacing: 10, color: '#a9aeb1', marginTop: 16 }}
          >
            {name}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 72, fontWeight: 800, color: '#f4f4f1' }}>
              {score || '—'}
            </span>
            <span
              style={{ fontSize: 28, letterSpacing: 5, color: '#8a8f92', marginLeft: 16 }}
            >
              AI SCORE
            </span>
          </div>
          <span style={{ fontSize: 26, letterSpacing: 4, color: '#8a8f92' }}>
            {SITE}
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
