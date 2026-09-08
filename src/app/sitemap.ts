/**
 * 檔案：src/app/sitemap.ts  →  /sitemap.xml
 * 角色：前端層 — 網站地圖
 * 功能：列出可被索引的公開頁面。/exam 為登入後的互動工具，不列入。
 */
import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const base = siteConfig.url;

  return [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${base}/privacy/en`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/ip`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${base}/ip/en`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
