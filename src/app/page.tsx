/**
 * 檔案：src/app/page.tsx  →  路由 /
 * 角色：前端層 — 產品著陸頁（對齊 AI-CAT Hero.dc）
 * 功能：Hero 一屏（header / 左文案 + 右能力模型 sample panel / 底部五大維度），
 *       其後接運作方式、最終 CTA、頁尾。純靜態 Server Component，CTA 連 /exam。
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HeroRadar } from '@/components/HeroRadar';
import { AiCatMark } from '@/components/AiCatMark';
import { GoogleIcon } from '@/components/GoogleIcon';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: { absolute: siteConfig.title },
  description: siteConfig.description,
  alternates: { canonical: '/' },
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.shortDescription,
    url: '/',
  },
};

const METRICS = [
  { i: '01', t: '提示詞結構', d: '角色、脈絡與輸出格式限制' },
  { i: '02', t: '問題拆解力', d: '分階段引導而非一次全丟' },
  { i: '03', t: '對話效率', d: '產出品質 ÷ 有效輪次' },
  { i: '04', t: '批判思考', d: '不輕信 AI 所言，拒絕照單全收' },
  { i: '05', t: '任務達成率', d: '字數、格式、必含內容' },
];

const STEPS = [
  {
    title: '進入雙欄測驗沙盒',
    desc: '左側是職場情境任務與限制條件，右側是與 AI 助手對話的視窗。',
  },
  {
    title: '用你的方式指揮 AI',
    desc: '下提示詞、追問、修正。過程中系統會悄悄埋入一則錯誤資訊。',
  },
  {
    title: '提交給 AI 裁判盲審',
    desc: '高階裁判模型依 rubric 審查完整對話歷程，輸出結構化評分。',
  },
  {
    title: '取得能力報告',
    desc: '五角雷達圖 + 綜合分級（L1–L5）+ 做得好／可以更好 + L5 示範。',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: siteConfig.title,
  alternateName: siteConfig.name,
  url: siteConfig.url,
  description: siteConfig.shortDescription,
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Web',
  inLanguage: 'zh-Hant',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'TWD' },
  author: { '@type': 'Person', name: siteConfig.author },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="lp">
        <header className="lp-header">
          <div className="lp-brand">
            <AiCatMark size={24} />
            <span className="wordmark">AI-CAT</span>
            <span className="mono-label">AI 能力檢測工具</span>
          </div>
          <div className="right">
            <span className="mono-label">AI COMPETENCY ASSESSMENT TOOL</span>
            <ThemeToggle />
          </div>
        </header>

        <main className="lp-main">
          <section className="lp-hero">
            <span className="eyebrow">
              <span className="dot" />
              <span>ASSESSMENT · NOT A QUIZ</span>
            </span>
            <h1>
              你會<span className="hl">「用 AI」</span>嗎？
              <br />
              <span className="sub">來實測一次。</span>
            </h1>
            <p>
              不是測你知不知道 AI，而是測你能不能駕馭 AI。
              真實職場情境、動態沙盒實作、AI 自動盲審。
            </p>
            <div className="lp-cta">
              <Link className="cta" href="/exam">
                開始檢測 →
              </Link>
              <a className="cta-link" href="#how">
                先看評分方法
              </a>
            </div>
            <div className="lp-metrics">
              <div>
                <div className="n">
                  5–10 <span>MIN</span>
                </div>
                <div className="k">單次檢測</div>
              </div>
              <div>
                <div className="n">
                  多種 <span>SCENARIOS</span>
                </div>
                <div className="k">隨機職場情境</div>
              </div>
              <div>
                <div className="n">L1 – L5</div>
                <div className="k">能力分級</div>
              </div>
            </div>
          </section>

          <section className="lp-panel">
            <div className="lp-panel-head">
              <span>CAPABILITY MODEL</span>
              <span>SAMPLE REPORT</span>
            </div>
            <HeroRadar />
          </section>
        </main>

        <div className="lp-foot">
          {METRICS.map((m) => (
            <div key={m.i}>
              <span className="i">{m.i}</span>
              <span className="t">{m.t}</span>
              <span className="d">{m.d}</span>
            </div>
          ))}
        </div>
      </div>

      <section id="how">
        <div className="wrap">
          <h2>運作方式</h2>
          <p className="section-sub">一場檢測約 5–10 分鐘，最多 10 輪對話。</p>
          <div className="steps">
            {STEPS.map((s) => (
              <div className="step" key={s.title}>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="start">
        <div className="wrap">
          <h2>準備好了嗎？</h2>
          <p className="section-sub">
            使用 Google 登入即可開始，每個帳號提供 2 次免費檢測。
          </p>
          <div className="highlight">
            <ul>
              <li>多種職場情境題，每次隨機抽選（如行銷文案、行政數據、工程除錯等）</li>
              <li>真實沙盒對話，非題庫選擇題</li>
              <li>檢測結果即時產生，附 L5 示範</li>
              <li>
                對話內容會送交 AI 模型評分，詳見{' '}
                <Link href="/privacy">隱私政策</Link>
              </li>
            </ul>
            <p style={{ marginTop: 24 }}>
              <Link className="cta" href="/exam">
                <GoogleIcon />
                使用 Google 登入並開始
              </Link>
            </p>
          </div>
        </div>
      </section>

      <footer>
        <p className="footer-links">
          <Link href="/privacy">隱私政策</Link>
          <span>·</span>
          <Link href="/ip">智慧財產權宣告</Link>
        </p>
        <p style={{ marginTop: 10 }}>
          © 2026 icguanyu. 版權所有，保留一切權利。
        </p>
      </footer>
    </>
  );
}
