/**
 * 檔案：src/app/layout.tsx
 * 角色：前端層 — App Router 根佈局
 * 功能：載入字體（Archivo / IBM Plex Mono / Noto Sans TC）與全域樣式，
 *       在 <head> 塞免閃爍的主題 script（讀 localStorage → 設 <html data-theme>），
 *       設定預設 <title> / description。
 */
import type { Metadata } from 'next';
import { IBM_Plex_Mono, Noto_Sans_TC } from 'next/font/google';
import './globals.css';

const sans = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-sans-loaded',
  display: 'swap',
  preload: false,
});
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono-loaded',
  display: 'swap',
});

// <head> inline：在首次繪製前決定主題，避免亮暗閃爍
const themeScript = `(function(){try{var k='ai-cat-theme',t=localStorage.getItem(k);if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){}})();`;

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
    <html
      lang="zh-Hant"
      className={`${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
