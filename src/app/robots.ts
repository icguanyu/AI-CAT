/**
 * 檔案：src/app/robots.ts  →  /robots.txt
 * 角色：前端層 — 搜尋引擎爬取規則
 * 功能：開放首頁與說明頁，擋掉互動工具、驗證流程與 API；指向 sitemap。
 */
import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/exam', '/auth/', '/api/'],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
