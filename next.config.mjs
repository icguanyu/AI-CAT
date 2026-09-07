/**
 * 檔案：next.config.mjs
 * 角色：建置設定 — Next.js 專案設定
 * 功能：目前僅啟用 React strict mode；日後放圖片網域、security headers、
 *       redirects/rewrites、實驗性選項等。
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
