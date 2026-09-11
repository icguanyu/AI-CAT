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
      // 互動工具、登入流程、API、個人頁、個人分享頁、後台不進索引
      disallow: ['/exam', '/me', '/s/', '/auth/', '/api/', '/admin'],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: new URL(siteConfig.url).host,
  };
}
