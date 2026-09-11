/**
 * 檔案：src/app/admin/layout.tsx  →  /admin/*
 * 角色：前端層 — 後台區段佈局（Server Component）
 * 功能：標記 noindex（robots.txt 也擋了 /admin），實際登入/導覽交給 AdminGate。
 */
import type { Metadata } from 'next';
import AdminGate from './AdminGate';

export const metadata: Metadata = {
  title: '後台',
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminGate>{children}</AdminGate>;
}
