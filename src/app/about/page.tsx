/**
 * 檔案：src/app/about/page.tsx  →  路由 /about
 * 角色：前端層 — 可索引的「檢測與計分說明」頁（SEO：把藏在程式碼裡的具體規則攤開成
 *       可被搜尋引擎摘要的內容，同時承接 FAQ 結構化資料）
 * 功能：純靜態說明文字，不含任何真實題目內容或陷阱細節（那些要留到測驗本身才看得到）。
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { CATEGORY_LABEL, LEVEL_NAME, type Category } from '@/types/exam';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'AI 能力檢測怎麼測、怎麼計分',
  description:
    'AI-CAT 如何檢測你的 AI 能力：真實職場情境沙盒對話（不是選擇題）、五維度加權計分規則、L1–L5 分級門檻、11 種情境分類與免費額度說明。',
  alternates: { canonical: '/about' },
};

/** 五維度權重，對齊 src/lib/scoring.ts 的 WEIGHTS——改動請同步。 */
const DIMENSIONS = [
  { t: '提示詞結構', w: 25, d: '角色、脈絡與輸出格式限制是否明確' },
  { t: '問題拆解力', w: 20, d: '是否分階段引導、逐步確認，而非一次全丟' },
  { t: '對話效率', w: 15, d: '最終成品品質 ÷ 有效輪次' },
  { t: '批判思考', w: 25, d: '是否識別並糾正 AI 給出的錯誤資訊' },
  { t: '任務達成率', w: 15, d: '對話中實際產出的成品是否滿足所有限制條件' },
];

/** 分級門檻，對齊 src/lib/scoring.ts 的 computeLevel()——改動請同步。 */
const LEVEL_ROWS: { code: keyof typeof LEVEL_NAME; range: string }[] = [
  { code: 'L1', range: '低於 40 分' },
  { code: 'L2', range: '40–54 分' },
  { code: 'L3', range: '55–69 分' },
  { code: 'L4', range: '70–84 分' },
  { code: 'L5', range: '85 分以上' },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'AI-CAT 免費嗎？',
    a: '免登入可先試用一場（最多 6 輪對話）。登入後每日 3 場免費、隔日重置，免費帳號生涯累計上限 21 場，目前沒有付費方案。',
  },
  {
    q: '跟坊間選擇題型的 AI 能力認證有什麼不同？',
    a: 'AI-CAT 不是選擇題題庫，也不核發正式證書——它是一個自我評測工具：你要在真實職場情境的沙盒裡實際跟 AI 助手對話、產出成品，由高階 AI 裁判模型盲審整段對話，量化你「駕馭 AI」的實作能力，而不是「認不認識 AI 名詞」。',
  },
  {
    q: '分數是怎麼算出來的？',
    a: '五個維度（提示詞結構、問題拆解力、對話效率、批判思考、任務達成率）各自 0–100 分，依固定權重加權平均成一個總分，再對應到 L1–L5 分級。同一套權重不因題目或情境分類而異。',
  },
  {
    q: '陷阱題會怎麼影響分級？',
    a: '每場對話系統有機率悄悄埋入一則錯誤資訊。如果它確實出現在對話裡、但你沒有質疑或查證就照單全收，不論加權分數多高，那場分級最高只到 L3。',
  },
  {
    q: '多久可以測一次？',
    a: '單場約 5–10 分鐘、最多 10 輪對話。登入帳號每日可開始 3 場（隔日重置），做越多場，跨情境的綜合分級估得越準。',
  },
  {
    q: '我的對話內容會被看到嗎？',
    a: '對話內容會送交 AI 模型評分並保存為逐字稿，僅用於顯示你的結果與改進評分模型。公開分享連結只會顯示雷達圖、分級、分數與一句總評，不含題目內容或逐字稿，詳見隱私政策。',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function AboutPage() {
  const categories = Object.keys(CATEGORY_LABEL) as Category[];

  return (
    <main className="legal">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="legal-nav">
        <Link className="back" href="/">
          ← 回首頁
        </Link>
        <Link className="back" href="/exam">
          直接開始檢測 →
        </Link>
      </div>

      <h1>AI 能力檢測怎麼測、怎麼計分</h1>
      <p className="updated">AI-CAT · AI 能力自我評測工具</p>

      <p>
        AI-CAT 不是選擇題題庫、也不核發正式證書——它是一個<strong>生成式 AI 能力自我評測工具</strong>：
        免安裝、免跑考場，線上就能測，用真實職場情境的動態沙盒對話，量化你「駕馭 AI」的實作能力，
        而不是「認不認識 AI 名詞」。以下把測驗流程與計分規則完整攤開，不含任何真實題目內容。
      </p>

      <h2>怎麼測</h2>
      <ul>
        <li>免登入即可先試用一場，不用安裝任何東西，瀏覽器打開就能測。</li>
        <li>系統隨機抽一個真實職場情境，附任務說明與限制條件；你先自評對這個領域有多熟，讓評分更公平。</li>
        <li>在雙欄沙盒裡跟平台的生成式 AI 助手對話、追問、修正——最多 10 輪，單則輸入上限 1000 字。</li>
        <li>過程中系統有機率悄悄埋入一則錯誤資訊，測試你是否照單全收。</li>
        <li>提交後由高階 AI 裁判模型盲審完整對話歷程，不知道你是誰，輸出五維度結構化評分。</li>
        <li>免登入試用最多 6 輪對話、結果不保存；登入後每日 3 場免費、生涯累計上限 21 場。</li>
      </ul>

      <h2 id="scoring">怎麼計分：五個維度</h2>
      <p>五個維度各自 0–100 分，依固定權重加權平均成一個總分；同一套權重不因題目或情境分類而異：</p>
      <ul>
        {DIMENSIONS.map((d) => (
          <li key={d.t}>
            <strong>
              {d.t}（{d.w}%）
            </strong>
            ：{d.d}
          </li>
        ))}
      </ul>

      <h2>分級對照</h2>
      <p>加權總分依下列門檻對應到 L1–L5：</p>
      <ul>
        {LEVEL_ROWS.map((r) => (
          <li key={r.code}>
            <strong>
              {r.code} {LEVEL_NAME[r.code]}
            </strong>
            ：{r.range}
          </li>
        ))}
      </ul>
      <p>
        另有一條規則上限：陷阱資訊確實出現在對話裡、但你沒有質疑或查證就照單全收，
        不論加權分數多高，那場分級最高只到 <strong>L3</strong>。
      </p>

      <h2>涵蓋哪些情境類型</h2>
      <p>題庫依職場情境分成 11 個分類，每次隨機抽一題：</p>
      <ul>
        {categories.map((c) => (
          <li key={c}>{CATEGORY_LABEL[c]}</li>
        ))}
      </ul>

      <h2 id="faq">常見問題</h2>
      {FAQ.map((f) => (
        <div key={f.q}>
          <h3 style={{ fontSize: '1rem', margin: '18px 0 6px', color: 'var(--fg)' }}>
            {f.q}
          </h3>
          <p>{f.a}</p>
        </div>
      ))}

      <p style={{ marginTop: 32 }}>
        準備好了嗎？{' '}
        <Link className="back" href="/exam">
          回到首頁開始檢測 →
        </Link>
      </p>

      <div className="legal-footer">
        <Link href="/">{siteConfig.name} 首頁</Link> · <Link href="/privacy">隱私政策</Link> ·{' '}
        <Link href="/ip">智慧財產權宣告</Link>
      </div>
    </main>
  );
}
