/**
 * 檔案：src/app/twitter-image.tsx  →  /twitter-image
 * 角色：前端層 — Twitter/X 分享縮圖，圖像內容與 Open Graph 圖相同。
 */
import { siteConfig } from '@/config/site';

export { default } from './opengraph-image';

export const runtime = 'edge';
export const alt = siteConfig.title;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
