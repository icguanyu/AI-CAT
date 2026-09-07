/**
 * 檔案：next.config.mjs
 * 角色：建置設定 — Next.js 專案設定
 * 功能：目前僅啟用 React strict mode；日後放圖片網域、security headers、
 *       redirects/rewrites、實驗性選項等。
 *       末尾初始化 OpenNext 的 dev hook，讓 `next dev` 也能取用 Cloudflare 綁定。
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;

// 讓本機 `next dev` 能透過 getCloudflareContext() 取用 Cloudflare 綁定 / env。
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();
