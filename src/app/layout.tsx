/**
 * 檔案：src/app/layout.tsx
 * 角色：前端層 — App Router 根佈局
 * 功能：載入字體（Archivo / IBM Plex Mono / Noto Sans TC）與全域樣式，
 *       在 <head> 塞免閃爍的主題 script（讀 localStorage → 設 <html data-theme>），
 *       設定預設 <title> / description。
 */
import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Noto_Sans_TC } from 'next/font/google';
import { siteConfig } from '@/config/site';
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
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: '%s｜AI-CAT',
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.author }],
  creator: siteConfig.author,
  publisher: siteConfig.author,
  category: 'education',
  alternates: {
    canonical: '/',
  },
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.shortDescription,
    url: siteConfig.url,
    locale: siteConfig.locale,
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.title,
    description: siteConfig.shortDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f1ec' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0c0d' },
  ],
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
