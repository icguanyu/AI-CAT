/**
 * 檔案：src/app/layout.tsx
 * 角色：前端層 — App Router 根佈局
 * 功能：包住所有頁面的 <html>/<body>，載入全域樣式 globals.css，
 *       設定預設 <title> 與 meta description（SEO / 分享用）。
 */
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI-CAT｜AI 能力檢測工具',
  description:
    'AI Competency Assessment Tool — 捨棄選擇題，透過動態沙盒實作與 AI 自動盲審，量化你與 AI 協作的效率與思辨能力。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
