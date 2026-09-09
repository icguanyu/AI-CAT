/**
 * 檔案：src/config/site.ts
 * 角色：設定層 — 全站基本資料（SEO / metadata / sitemap / robots 共用）
 * 功能：集中站點網址、名稱、描述、關鍵字。網址優先讀 NEXT_PUBLIC_SITE_URL，
 *       其次 Vercel 佈署網址，最後回退到正式網域。
 */

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`;

  return 'https://www.ai-cat.app';
}

export const siteConfig = {
  url: resolveSiteUrl(),
  name: 'AI-CAT',
  title: 'AI-CAT｜AI 能力檢測工具',
  shortDescription: 'AI 能力檢測工具 — 用動態沙盒實作與 AI 自動盲審，量化你駕馭 AI 的能力。',
  description:
    'AI Competency Assessment Tool — 捨棄選擇題，透過動態沙盒實作與 AI 自動盲審，量化你與 AI 協作的效率與思辨能力。5–10 分鐘一場，產出五維度能力雷達圖與 L1–L5 分級。',
  keywords: [
    'AI 能力檢測',
    'AI 素養',
    'prompt engineering',
    '提示詞工程',
    'AI competency assessment',
    'AI 協作',
    '批判思考',
    'LLM',
    'AI-CAT',
  ],
  locale: 'zh_Hant_TW',
  author: 'icguanyu',
} as const;

export type SiteConfig = typeof siteConfig;
