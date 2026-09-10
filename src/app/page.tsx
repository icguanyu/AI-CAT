/**
 * 檔案：src/app/page.tsx  →  路由 /
 * 角色：前端層 — 產品著陸頁（對齊 AI-CAT 首頁方向.dc）
 * 功能：hairline 檔案風全寬區塊：header（不變）→ hero split（左文案 + 右能力模型）
 *       → 我們測什麼（大字維度列表）→ 運作方式（五步）→ 你會拿到什麼
 *       （真實 brief + 範例成績單）→ 螢光綠翻轉「測一次不代表你」→ 準備好了嗎
 *       + 本站平均。CTA 連 /exam。「本站平均」走 ISR。
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountMenu } from '@/components/AccountMenu';
import { HeroRadar } from '@/components/HeroRadar';
import { ResultCard } from '@/components/ResultCard';
import { SiteBenchmark } from '@/components/SiteBenchmark';
import { AiCatMark } from '@/components/AiCatMark';
import { CatDecor } from '@/components/CatDecor';
import { siteConfig } from '@/config/site';
import { getSiteStats } from '@/lib/site-stats';

// openGraph / twitter 由 root layout 提供完整版（type / siteName / locale / image）；
// 此頁不再覆寫 openGraph，否則會把 layout 的那些欄位整包蓋掉。
export const metadata: Metadata = {
  title: { absolute: siteConfig.title },
  description: siteConfig.description,
  alternates: { canonical: '/' },
};

// 「本站平均」要抓 DB，但不必即時——每 30 分鐘重新產生一次即可。
export const revalidate = 1800;

/** 「我們測什麼」——五個評分維度。 */
const DIMENSIONS = [
  { i: '01', t: '提示詞結構', d: '角色、脈絡與輸出格式限制' },
  { i: '02', t: '問題拆解力', d: '分階段引導而非一次全丟' },
  { i: '03', t: '對話效率', d: '產出品質 ÷ 有效輪次' },
  { i: '04', t: '批判思考', d: '不輕信 AI 所言，拒絕照單全收' },
  { i: '05', t: '任務達成率', d: '字數、格式、必含內容' },
];

/** 「運作方式」——五個步驟。 */
const STEPS = [
  {
    title: '選一題、先自評熟悉度',
    desc: '隨機抽真實職場情境，附任務與限制；你先自評對這領域多熟，讓評分更公平。',
  },
  {
    title: '在雙欄沙盒指揮 AI',
    desc: '看任務與限制，與平台 AI 助手對話、追問、修正——過程中系統會悄悄埋入一則錯誤資訊。',
  },
  {
    title: '提交 AI 裁判盲審',
    desc: '高階裁判模型依 rubric 審查完整對話歷程，輸出五維度結構化評分，不看你是誰。',
  },
  {
    title: '取得能力報告',
    desc: '五角雷達圖 + 綜合分級 L1–L5 + 做得好／可以更好 + L5 高手示範，可一鍵產生分享連結。',
  },
  {
    title: '多做幾場，看真實水準',
    desc: '每場自動存進「我的檢測紀錄」，跨情境彙總綜合分級與分數趨勢——做越多，估得越準。',
  },
];

/** 首頁「你會拿到什麼」用的靜態範例——一題真實情境的任務說明。 */
const SAMPLE_BRIEF = `情境：你是某台灣電商的客服人員。一位客戶因收到破損商品，來信表達不滿並要求退貨與說明。

任務：透過平台提供的 AI 助手，產出一封給該客戶的道歉信。

限制條件：
1. 繁體中文，200–300 字
2. 需包含：具體致歉、破損原因說明、退貨處理步驟、補償方案
3. 語氣專業、同理，不卸責
4. 結尾附客服聯絡方式（可用佔位符）`;

/** 對應上面那題的一張「範例成績單」——非真實資料，僅示意產出長相。 */
const SAMPLE_REPORT = {
  level: 'L3' as const,
  scores: {
    prompt_structure: 68,
    decomposition: 55,
    efficiency: 61,
    critical_thinking: 82,
    task_completion: 74,
  },
  summary:
    '你會主動質疑 AI 給的補償金額、要它說明依據，這點做得好；但第一則提示詞把角色、格式、字數、語氣一次全丟，前兩輪偏離字數限制，來回多花了兩輪。',
};

/** 螢光綠翻轉區右側：檢測完之後留下什麼。 */
const AFTER = [
  { t: '逐場分數與 L 分級', k: 'AUTO' },
  { t: '綜合能力雷達', k: '3 分類解鎖' },
  { t: '一鍵公開分享連結', k: '題目不外流' },
  { t: 'L5 高手示範', k: '逐點回饋' },
];

const FEATURES = [
  '真實職場情境的動態沙盒對話（非選擇題）',
  '開場自評領域熟悉度，校準評分公平性',
  '高階 AI 裁判盲審，輸出五維度分數與 L1–L5 分級',
  '幻覺陷阱：檢驗你是否照單全收 AI 的說法',
  '能力報告附 L5 高手示範與逐點回饋',
  '歷次紀錄自動留存，跨情境綜合分級與分數趨勢',
  '一鍵產生公開分享連結',
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteConfig.url}/#website`,
      url: siteConfig.url,
      name: siteConfig.title,
      alternateName: siteConfig.name,
      description: siteConfig.shortDescription,
      inLanguage: 'zh-Hant',
      publisher: { '@id': `${siteConfig.url}/#person` },
    },
    {
      '@type': 'Person',
      '@id': `${siteConfig.url}/#person`,
      name: siteConfig.author,
      url: siteConfig.url,
    },
    {
      '@type': 'WebApplication',
      '@id': `${siteConfig.url}/#webapp`,
      name: siteConfig.title,
      alternateName: siteConfig.name,
      url: siteConfig.url,
      description: siteConfig.shortDescription,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      browserRequirements: 'Requires JavaScript. Requires HTML5.',
      inLanguage: 'zh-Hant',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'TWD' },
      featureList: FEATURES,
      author: { '@id': `${siteConfig.url}/#person` },
    },
  ],
};

/** 先隱藏「你會拿到什麼」區塊——改回 true 即恢復。 */
const SHOW_SAMPLE = false;

export default async function HomePage() {
  const siteStats = await getSiteStats();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="lp">
        <CatDecor className="cat-watermark" animated />

        <div className="lp-card">
          <header className="lp-header">
            <div className="lp-brand">
              <AiCatMark size={24} />
              <span className="wordmark">AI-CAT</span>
              <span className="mono-label">AI 能力檢測工具</span>
            </div>
            <div className="right">
              <span className="mono-label">AI COMPETENCY ASSESSMENT TOOL</span>
              <AccountMenu />
            </div>
          </header>

          {/* ── Hero split ─────────────────────────────── */}
          <div className="lp-hero-split">
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
                <a className="cta-link" href="#dims">
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

            <aside className="lp-panel">
              <div className="lp-panel-head">
                <span>CAPABILITY MODEL</span>
                <span>SAMPLE REPORT</span>
              </div>
              <HeroRadar />
            </aside>
          </div>

          {/* ── 我們測什麼 ─────────────────────────────── */}
          <section className="lp-sec lp-sec--split" id="dims">
            <div className="lp-sec-head">
              <h2>
                我們測
                <br />
                什麼
              </h2>
              <p>
                五個維度、一次檢測全部覆蓋。由高階裁判模型依 rubric 盲審評分。
              </p>
            </div>
            <div className="dim-list">
              {DIMENSIONS.map((m) => (
                <div className="dim-row" key={m.i}>
                  <span className="dim-n">{m.i}</span>
                  <span className="dim-t">{m.t}</span>
                  <span className="dim-d">{m.d}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── 運作方式 ──────────────────────────────── */}
          <section className="lp-sec" id="how">
            <div className="lp-sec-bar">
              <h2>運作方式</h2>
              <span className="sec-aside">
                一場約 5–10 分鐘，最多 10 輪對話
              </span>
            </div>
            <div className="flow-grid">
              {STEPS.map((s, i) => (
                <div className="flow-cell" key={s.title}>
                  <span
                    className="flow-n"
                    data-last={i === STEPS.length - 1 ? 'true' : undefined}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flow-t">{s.title}</span>
                  <span className="flow-d">{s.desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── 你會拿到什麼（真實 brief + 範例成績單）── 先隱藏 ── */}
          {SHOW_SAMPLE && (
            <section className="lp-sec" id="sample">
              <div className="lp-sec-bar">
                <h2>你會拿到什麼</h2>
                <span className="sec-aside">
                  真實情境題 · 一場你主導的對話 · 能力檢測結果
                </span>
              </div>
              <div className="sample-io">
                <div className="sample-brief">
                  <div className="sample-tag">你會拿到的題目</div>
                  <div className="brief">{SAMPLE_BRIEF}</div>
                </div>
                <div className="sample-result">
                  <div className="sample-tag">完成後你會拿到的成績單</div>
                  <ResultCard
                    level={SAMPLE_REPORT.level}
                    scores={SAMPLE_REPORT.scores}
                    summary={SAMPLE_REPORT.summary}
                  />
                  <p className="sample-note">
                    此為範例，實際分數與總評依你的對話生成。完整報告另附「做得好／可以更好」與 L5 示範。
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ── 螢光綠翻轉：一次分數不代表你 ───────────── */}
          <section className="lp-flip">
            <div className="lp-flip-lead">
              <h2>
                一次分數
                <br />
                不代表你。
              </h2>
              <p>
                同一個人，換個情境分數可能差很多。多測幾場，每場都會自動存進「我的檢測紀錄」，
                幫你整理出跨情境的綜合分級和分數變化——測越多次，越接近你真正的實力。
              </p>
            </div>
            <div className="lp-flip-list">
              {AFTER.map((a) => (
                <div className="flip-row" key={a.t}>
                  <span className="flip-t">{a.t}</span>
                  <span className="flip-k">{a.k}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── 準備好了嗎 + 本站平均 ─────────────────── */}
          <section className="lp-sec lp-sec--cta" id="start">
           
            <div className="lp-cta-lead">
              <h2>準備好了嗎？ <CatDecor className="cat-peek" animated /></h2>
              <p>
                無需註冊，免費體驗。想保存結果、追蹤進步，可用 Google 登入——
                登入後每日 3 場免費（隔日重置），免費帳號累計上限 21 次。
              </p>
              <Link className="cta" href="/exam">
                免費體驗 →
              </Link>
              <p className="lp-cta-fine">
                對話內容會送交 AI 模型評分，詳見{' '}
                <Link href="/privacy">隱私政策</Link>。
              </p>
            </div>
            <SiteBenchmark stats={siteStats} />
          </section>
        </div>

        <footer>
          <CatDecor className="cat-foot" />
          <p className="footer-links">
            <Link href="/privacy">隱私政策</Link>
            <span>·</span>
            <Link href="/ip">智慧財產權宣告</Link>
          </p>
          <p style={{ marginTop: 10 }}>
            © 2026 icguanyu. 版權所有，保留一切權利。
          </p>
        </footer>
      </div>
    </>
  );
}
