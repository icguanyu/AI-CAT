/**
 * 檔案：src/app/me/layout.tsx
 * 角色：前端層 — /me 區段佈局（Server Component）
 * 功能：僅承載該路由的 metadata。個人檢測紀錄需登入、內容因人而異，
 *       標記 noindex / nofollow，不進搜尋索引。
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '我的檢測紀錄',
  description: '登入後查看你的歷次 AI 能力檢測：跨情境綜合分級、分數趨勢與逐場紀錄。',
  robots: { index: false, follow: false },
  alternates: { canonical: '/me' },
};

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
