/**
 * 檔案：src/app/page.tsx  →  路由 /
 * 角色：前端層 — 產品著陸頁（對齊 AI-CAT Hero.dc）
 * 功能：Hero 一屏（header / 左文案 + 右能力模型 sample panel / 底部五大維度），
 *       其後接運作方式、最終 CTA、頁尾。純靜態 Server Component，CTA 連 /exam。
 */
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

const METRICS = [
  { i: '01', t: '提示詞結構', d: '角色、脈絡與輸出格式限制' },
  { i: '02', t: '問題拆解力', d: '分階段引導而非一次全丟' },
  { i: '03', t: '對話效率', d: '產出品質 ÷ 有效輪次' },
  { i: '04', t: '批判思考', d: '刻意注入錯誤，測你是否識破' },
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

/** Hero 右側的能力模型示意雷達圖（sample：L4 / 82）。 */
type Anchor = 'start' | 'middle' | 'end';
const AXES: [string, number, number, Anchor][] = [
  ['提示詞結構', 200, 32, 'middle'],
  ['問題拆解', 356, 150, 'start'],
  ['對話效率', 300, 347, 'middle'],
  ['任務達成', 100, 347, 'middle'],
  ['批判思考', 44, 150, 'end'],
];
const RING_POINTS = [
  '200,50 342.7,153.6 288.2,321.4 111.8,321.4 57.3,153.6',
  '200,100 295.1,169.1 258.8,281 141.2,281 104.9,169.1',
  '200,150 247.6,184.5 229.4,240.5 170.6,240.5 152.4,184.5',
];
const OUTER = ['200,50', '342.7,153.6', '288.2,321.4', '111.8,321.4', '57.3,153.6'];
const SAMPLE = ['200,71', '311.3,163.8', '280.3,310.5', '134.7,289.8', '81.6,161.5'];

function SampleRadar() {
  const grid = { stroke: 'var(--grid)' };
  return (
    <svg viewBox="0 0 400 400">
      {RING_POINTS.map((pts, i) => (
        <polygon
          key={pts}
          points={pts}
          style={{
            fill: i === 0 ? 'var(--radar-base)' : 'none',
            stroke: 'var(--grid)',
          }}
        />
      ))}
      {OUTER.map((p) => (
        <line
          key={p}
          x1="200"
          y1="200"
          x2={p.split(',')[0]}
          y2={p.split(',')[1]}
          style={grid}
        />
      ))}
      <polygon
        points={SAMPLE.join(' ')}
        style={{
          fill: 'var(--radar-fill)',
          stroke: 'var(--radar-stroke)',
          strokeWidth: 2,
        }}
      />
      {SAMPLE.map((p) => (
        <circle
          key={p}
          cx={p.split(',')[0]}
          cy={p.split(',')[1]}
          r="4.5"
          style={{ fill: 'var(--radar-stroke)' }}
        />
      ))}
      {AXES.map(([label, x, y, anchor]) => (
        <text
          key={label}
          x={x}
          y={y}
          textAnchor={anchor}
          fontSize="13"
          style={{
            fill: 'var(--fg-muted)',
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

export default function HomePage() {
  return (
    <>
      <div className="lp">
        <header className="lp-header">
          <div className="lp-brand">
            <span className="wordmark">AI-CAT</span>
            <span className="mono-label">AI 能力檢測工具</span>
          </div>
          <div className="right">
            <span className="mono-label">AI COMPETENCY ASSESSMENT · MVP</span>
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
              三個真實職場情境、動態沙盒實作、AI 自動盲審。
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
                  3 <span>SCENARIOS</span>
                </div>
                <div className="k">職場情境</div>
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
            <SampleRadar />
            <div className="lp-level">
              <div>
                <div className="lvl">
                  <b>L4</b>
                  <span>AI COLLABORATOR</span>
                </div>
                <p>能駕馭 AI 完成複雜任務，並主動檢查與修正 AI 的輸出。</p>
              </div>
              <div className="score">
                <div className="s">82</div>
                <div className="k">AI SCORE</div>
              </div>
            </div>
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
              <li>3 種職場情境題：行銷文案、行政數據、工程除錯</li>
              <li>真實沙盒對話，非題庫選擇題</li>
              <li>檢測結果即時產生，附 L5 示範</li>
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
