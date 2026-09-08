/**
 * 檔案：src/app/exam/layout.tsx
 * 角色：前端層 — /exam 區段佈局（Server Component）
 * 功能：僅承載該路由的 metadata。互動檢測沙盒需登入、內容因人而異，
 *       故標記 noindex / nofollow，不進搜尋索引。
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '開始檢測',
  description: '登入後開始一場 AI 能力檢測：雙欄沙盒對話，結束後由 AI 裁判盲審評分。',
  robots: { index: false, follow: false },
  alternates: { canonical: '/exam' },
};

export default function ExamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
