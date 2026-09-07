/**
 * 檔案：src/app/page.tsx  →  路由 /
 * 角色：前端層 — 產品歡迎頁 / 著陸頁
 * 功能：介紹 AI-CAT：Hero、五大評估維度、運作方式四步驟、CTA、著作權頁尾。
 *       純靜態 Server Component；CTA 連到 /exam（登入與測驗流程都在那）。
 */
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

const METRICS = [
  {
    num: '01',
    title: '提示詞結構',
    desc: '是否具備角色設定、背景脈絡與清楚的輸出格式限制。',
  },
  {
    num: '02',
    title: '問題拆解力',
    desc: '面對複雜任務，能否分階段引導、逐步確認，而非一次全丟。',
  },
  {
    num: '03',
    title: '對話效率',
    desc: '以「產出品質 ÷ 有效輪次」衡量；空轉與重複發問會扣分。',
  },
  {
    num: '04',
    title: '批判思考 / 幻覺辨識',
    desc: '系統會故意注入錯誤資訊，測你能否識破並主動糾正。',
  },
  {
    num: '05',
    title: '任務達成率',
    desc: '最終產出是否滿足所有限制條件：字數、格式、必含內容。',
  },
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
    desc: '五角雷達圖 + 綜合分級（L1–L5）+ 一句話總評與改進建議。',
  },
];

export default function HomePage() {
  return (
    <>
      <div className="site-top">
        <div className="brand">
          <span className="wordmark">AI-CAT</span>
          <span className="mono-label">AI 能力檢測工具</span>
        </div>
        <div className="right">
          <span className="mono-label">AI COMPETENCY ASSESSMENT · MVP</span>
          <ThemeToggle />
        </div>
      </div>

      <header className="hero">
        <div className="wrap">
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
            三個真實職場情境、動態沙盒實作、AI 自動盲審。
          </p>
          <div className="hero-cta">
            <Link className="cta" href="/exam">
              開始檢測 →
            </Link>
            <a className="cta-link" href="#how">
              先看運作方式
            </a>
          </div>
          <div className="hero-stats">
            <div>
              <div className="n">
                5–10 <span>MIN</span>
              </div>
              <div className="k">單次檢測</div>
            </div>
            <div>
              <div className="n">3</div>
              <div className="k">職場情境</div>
            </div>
            <div>
              <div className="n">L1–L5</div>
              <div className="k">能力分級</div>
            </div>
          </div>
        </div>
      </header>

      <section id="metrics">
        <div className="wrap">
          <h2>五大評估維度</h2>
          <p className="section-sub">
            系統從你的輸入、互動與產出，換算出 0–100 分的能力雷達圖。
          </p>
          <div className="grid">
            {METRICS.map((m) => (
              <div className="card" key={m.num}>
                <span className="num">{m.num}</span>
                <h3>{m.title}</h3>
                <p>{m.desc}</p>
              </div>
            ))}
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

      <section id="start">
        <div className="wrap">
          <h2>準備好了嗎？</h2>
          <p className="section-sub">
            使用 Google 登入即可開始，每個帳號提供 2 次免費檢測。
          </p>
          <div className="highlight">
            <ul>
              <li>3 種職場情境題：行銷文案、行政數據、工程除錯</li>
              <li>真實沙盒對話，非題庫選擇題</li>
              <li>檢測結果即時產生，可下載分享</li>
              <li>對話資料僅供評分使用，可隨時刪除</li>
            </ul>
            <p style={{ marginTop: 24 }}>
              <Link className="cta" href="/exam">
                使用 Google 登入並開始
              </Link>
            </p>
          </div>
        </div>
      </section>

      <footer>
        <p>AI-CAT · AI 能力檢測工具（MVP）&nbsp;·&nbsp; 本頁為產品介紹用途</p>
        <p style={{ marginTop: 8 }}>© 2026 icguanyu. 版權所有，保留一切權利。</p>
      </footer>
    </>
  );
}
