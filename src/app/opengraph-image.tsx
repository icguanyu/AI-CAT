/**
 * 檔案：src/app/opengraph-image.tsx  →  /opengraph-image
 * 角色：前端層 — 社群分享縮圖（Open Graph / Twitter 共用）
 * 功能：以 next/og 動態產生 1200×630 深色底圖：貓標記 + 字標 + 一句話。
 *       純內建字體，無外部資源。
 */
import { ImageResponse } from 'next/og';
import { siteConfig } from '@/config/site';

export const runtime = 'edge';
export const alt = siteConfig.title;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
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
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <svg width="96" height="92" viewBox="0 0 100 96">
            <g
              fill="none"
              stroke="#d8ff4f"
              strokeWidth={9}
              strokeLinejoin="round"
            >
              <polygon points="12,39.6 5,9 33,21" />
              <polygon points="88,39.6 95,9 67,21" />
              <polygon points="50,12 88,39.6 73.5,84.4 26.5,84.4 12,39.6" />
            </g>
            <circle cx="37" cy="50" r="6" fill="#d8ff4f" />
            <circle cx="63" cy="50" r="6" fill="#d8ff4f" />
          </svg>
          <div
            style={{
              fontSize: 64,
              fontWeight: 900,
              letterSpacing: '-0.03em',
            }}
          >
            AI-CAT
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.2 }}>
            你會「用 AI」嗎？來實測一次。
          </div>
          <div style={{ fontSize: 30, color: '#a9aeb1', lineHeight: 1.5 }}>
            動態沙盒實作 · AI 自動盲審 · 五維度能力雷達圖與 L1–L5 分級
          </div>
        </div>

        <div
          style={{
            fontSize: 24,
            letterSpacing: '0.18em',
            color: '#8a8f92',
          }}
        >
          AI COMPETENCY ASSESSMENT TOOL
        </div>
      </div>
    ),
    { ...size },
  );
}
