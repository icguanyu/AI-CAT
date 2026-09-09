/**
 * 檔案：src/app/page.tsx  →  路由 /
 * 角色：前端層 — 產品著陸頁（對齊 AI-CAT Hero.dc）
 * 功能：Hero 一屏（header / 左文案 + 右能力模型 sample panel / 底部五大維度），
 *       其後接運作方式、最終 CTA、頁尾。純靜態 Server Component，CTA 連 /exam。
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountMenu } from '@/components/AccountMenu';
import { HeroRadar } from '@/components/HeroRadar';
import { ResultCard } from '@/components/ResultCard';
import { AiCatMark } from '@/components/AiCatMark';
import { CatDecor } from '@/components/CatDecor';
import { siteConfig } from '@/config/site';

// openGraph / twitter 由 root layout 提供完整版（type / siteName / locale / image）；
// 此頁不再覆寫 openGraph，否則會把 layout 的那些欄位整包蓋掉。
export const metadata: Metadata = {
  title: { absolute: siteConfig.title },
  description: siteConfig.description,
  alternates: { canonical: '/' },
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
    title: '選一題、先自評熟悉度',
    desc: '隨機抽一個真實職場情境（附任務與限制條件）；你先自評對這個領域有多熟，讓評分更公平。',
  },
  {
    title: '在雙欄沙盒裡指揮 AI',
    desc: '左側是任務，右側是與 AI 助手對話。下提示詞、追問、修正——過程中系統會悄悄埋入一則錯誤資訊。',
  },
  {
    title: '提交給 AI 裁判盲審',
    desc: '高階裁判模型依 rubric 審查完整對話歷程，輸出五維度結構化評分，不看你是誰。',
  },
  {
    title: '取得能力報告',
    desc: '五角雷達圖 + 綜合分級（L1–L5）+ 做得好／可以更好 + L5 高手示範，並可一鍵產生公開分享連結。',
  },
  {
    title: '多做幾場，看真實水準',
    desc: '每場自動存進「我的檢測紀錄」，跨情境彙總出綜合分級與分數趨勢——做越多，估得越準。',
  },
];

/** 首頁「你會拿到什麼」用的靜態範例——一題真實情境的任務說明。 */
const SAMPLE_BRIEF = `情境：你是某台灣電商的客服人員。一位客戶因收到破損商品，來信表達不滿並要求退貨與說明。

任務：透過右側 AI 助手，產出一封給該客戶的道歉信。

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

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="lp">
        <CatDecor className="cat-watermark" />
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

      <section id="sample">
        <div className="wrap">
          <h2>你會拿到什麼</h2>
          <p className="section-sub">
            一題像這樣的職場情境、一場你主導的對話，換一張能力成績單。
          </p>
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
                orientation="portrait"
              />
              <p className="sample-note">
                此為範例，實際分數與總評依你的對話生成。完整報告另附「做得好／可以更好」與 L5 高手示範。
              </p>
            </div>
          </div>
        </div>
      </section>

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

      <section id="after">
        <div className="wrap">
          <h2>檢測完之後</h2>
          <p className="section-sub">
            一次分數只是切片，多做幾場才看得出真實水準。
          </p>
          <div className="steps">
            <div className="step">
              <div>
                <h3>你的檢測紀錄</h3>
                <p>
                  每場自動存進「我的檢測紀錄」：逐場分數、L 分級與情境分類一目了然，
                  並跨情境彙總出綜合能力雷達與綜合分級——完成 3 種不同分類就解鎖，做越多估得越準。
                </p>
              </div>
            </div>
            <div className="step">
              <div>
                <h3>分享你的成績</h3>
                <p>
                  一鍵產生公開連結，只顯示雷達圖、分級、分數與一句總評，帶 AI-CAT 品牌視覺；
                  題目內容與逐點回饋不會外流。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="start">
        <CatDecor className="cat-peek" animated />
        <div className="wrap">
          <h2>準備好了嗎？</h2>
          <p className="section-sub">
            不用註冊，先免費試一場。想保存結果、追蹤進步再用 Google 登入——
            登入後每日 3 場免費（隔日重置），帳號累計上限 21 場。
          </p>
          <div className="highlight">
            <ul>
              <li>
                多種職場情境題，每次隨機抽選（行銷文案、行政數據、工程除錯、8D 改善…）
              </li>
              <li>真實沙盒對話，非題庫選擇題</li>
              <li>檢測結果即時產生，附 L5 高手示範與逐點回饋</li>
              <li>歷次紀錄留存於「我的檢測紀錄」，可跨情境看綜合分級與趨勢</li>
              <li>
                對話內容會送交 AI 模型評分，詳見{' '}
                <Link href="/privacy">隱私政策</Link>
              </li>
            </ul>
            <p style={{ marginTop: 24 }}>
              <Link className="cta" href="/exam">
                免費試一場 →
              </Link>
            </p>
          </div>
        </div>
      </section>

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
    </>
  );
}
