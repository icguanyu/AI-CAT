/**
 * 檔案：src/app/sitemap.ts  →  /sitemap.xml
 * 角色：前端層 — 網站地圖
 * 功能：列出可被索引的公開頁面。/exam 為登入後的互動工具，不列入。
 */
import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

/** 內容實際更新日；改版時再動，別用 new Date()（每次請求都變會被搜尋引擎打折）。 */
const HOME_UPDATED = new Date('2026-09-09');
const LEGAL_UPDATED = new Date('2026-09-08');

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;

  return [
    {
      url: base,
      lastModified: HOME_UPDATED,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/privacy`,
      lastModified: LEGAL_UPDATED,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${base}/privacy/en`,
      lastModified: LEGAL_UPDATED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/ip`,
      lastModified: LEGAL_UPDATED,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${base}/ip/en`,
      lastModified: LEGAL_UPDATED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
