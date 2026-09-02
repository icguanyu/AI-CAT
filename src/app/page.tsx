/**
 * 檔案：src/app/page.tsx  →  路由 /
 * 角色：前端層 — 產品歡迎頁 / 著陸頁
 * 功能：介紹 AI-CAT：Hero、五大評估維度、運作方式四步驟、登入 CTA、著作權頁尾。
 *       純靜態 Server Component；「使用 Google 登入」按鈕待 Phase 4 接 Supabase OAuth。
 */

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
      <header className="hero">
        <div className="wrap">
          <span className="badge">AI COMPETENCY ASSESSMENT TOOL · MVP</span>
          <h1>
            AI-CAT
            <br />
            你會「用 AI」嗎？來實測一次。
          </h1>
          <p>
            捨棄選擇題。透過「動態沙盒實作」與「AI 自動盲審」，
            在真實任務情境中量化你與 AI 協作的效率與思辨能力。
          </p>
          <a className="cta" href="#start">
            開始檢測
          </a>
          <a className="cta secondary" href="#how">
            了解運作方式
          </a>
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
          <p className="section-sub">一場檢測約 5 分鐘，5 輪對話內完成。</p>
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
              {/* TODO(Phase 4): 接 Supabase Google OAuth，導向 /exam */}
              <a className="cta" href="#">
                使用 Google 登入並開始
              </a>
            </p>
          </div>
        </div>
      </section>

      <footer>
        <p>AI-CAT · AI 能力檢測平台（MVP）&nbsp;·&nbsp; 本頁為產品介紹用途</p>
        <p style={{ marginTop: 8 }}>© 2026 icguanyu. 版權所有，保留一切權利。</p>
      </footer>
    </>
  );
}
