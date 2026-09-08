/**
 * 檔案：src/app/manifest.ts  →  /manifest.webmanifest
 * 角色：前端層 — Web App Manifest（基本 PWA / 安裝資訊）
 */
import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.title,
    short_name: siteConfig.name,
    description: siteConfig.shortDescription,
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0c0d',
    theme_color: '#0b0c0d',
    lang: 'zh-Hant',
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/apple-icon.png', type: 'image/png', sizes: '180x180' },
    ],
  };
}
