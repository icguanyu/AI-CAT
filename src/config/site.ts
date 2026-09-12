/**
 * 檔案：src/config/site.ts
 * 角色：設定層 — 全站基本資料（SEO / metadata / sitemap / robots 共用）
 * 功能：集中站點網址、名稱、描述、關鍵字。網址優先讀 NEXT_PUBLIC_SITE_URL，
 *       其次 Vercel 佈署網址，最後回退到正式網域。
 */

const PROD_URL = 'https://www.ai-cat.app';

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  // 只有「預覽」佈署才退回自身 *.vercel.app 網址；正式站一律用正式網域，
  // 以免 canonical / sitemap / OG 指到某一次佈署的臨時網址（需自行把
  // NEXT_PUBLIC_VERCEL_ENV / NEXT_PUBLIC_VERCEL_URL 對應到系統變數才會生效）。
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL?.trim();
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview' && vercel) {
    return `https://${vercel.replace(/\/$/, '')}`;
  }

  return PROD_URL;
}

export const siteConfig = {
  url: resolveSiteUrl(),
  name: 'AI-CAT',
  title: 'AI-CAT｜AI 能力檢測工具',
  shortDescription:
    'AI 能力檢測工具 — 免安裝、線上就能測：用生成式 AI 動態沙盒實作 + AI 裁判盲審，量化你「用 AI」的實作能力，並追蹤每次進步。',
  description:
    'AI Competency Assessment Tool — 免安裝、免跑考場，線上就能測。捨棄選擇題，用真實職場情境的生成式 AI 動態沙盒實作與 AI 裁判盲審，量化你與 AI 協作的效率與思辨能力。5–10 分鐘一場，產出五維度能力雷達圖與 L1–L5 分級，歷次紀錄自動留存、跨情境彙總分級與分數趨勢，並可一鍵產生公開分享連結。',
  keywords: [
    'AI 能力檢測',
    '生成式AI能力評測',
    'AI 素養',
    'AI 自我評測',
    '線上 AI 測驗',
    'prompt engineering',
    '提示詞工程',
    'AI competency assessment',
    'AI 協作能力',
    '批判思考',
    'AI-CAT',
  ],
  // OG 用的 locale 需是 Facebook 支援值；台灣正體中文用 zh_TW。
  locale: 'zh_TW',
  author: 'icguanyu',
} as const;

export type SiteConfig = typeof siteConfig;
