/**
 * 檔案：src/components/ThinkingCat.tsx
 * 角色：前端層 — 「AI-CAT 思考中」指示器
 * 功能：對話視窗等待助手回覆時顯示。純 CSS 動畫的貓（呼吸／眨眼／耳朵抽動／
 *       鬍鬚），搭配「正在思考」＋三點跳動＋等寬狀態標。樣式取自
 *       「AI-CAT Thinking 動畫」設計稿 §01；顏色改用主題變數，隨深淺色翻色。
 *       尊重 prefers-reduced-motion（動畫在 globals.css 內關閉）。
 */
export function ThinkingCat({ label = 'CHECKING SOURCES' }: { label?: string }) {
  return (
    <div className="thinking-cat" role="status" aria-label="AI-CAT 正在思考">
      <div className="thinking-cat__avatar">
        <svg
          viewBox="-8 -4 116 104"
          className="thinking-cat__svg"
          aria-hidden="true"
          focusable="false"
        >
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth={6.5}
            strokeLinejoin="round"
          >
            <polygon
              points="12,39.6 5,9 33,21"
              style={{ transformOrigin: '16px 38px' }}
              className="tc-earL"
            />
            <polygon
              points="88,39.6 95,9 67,21"
              style={{ transformOrigin: '84px 38px' }}
              className="tc-earR"
            />
            <polygon points="50,12 88,39.6 73.5,84.4 26.5,84.4 12,39.6" />
          </g>
          <g className="tc-blink" style={{ transformOrigin: '50px 48px' }}>
            <circle cx="37" cy="48" r="4.5" fill="currentColor" />
            <circle cx="63" cy="48" r="4.5" fill="currentColor" />
          </g>
          <g stroke="currentColor" strokeWidth={4.5} strokeLinecap="round">
            <g className="tc-whiskL">
              <line x1="-3" y1="58" x2="15" y2="58" />
              <line x1="-1" y1="69" x2="18" y2="69" />
            </g>
            <g className="tc-whiskR">
              <line x1="103" y1="58" x2="85" y2="58" />
              <line x1="101" y1="69" x2="82" y2="69" />
            </g>
          </g>
        </svg>
      </div>
      <div className="thinking-cat__body">
        <div className="thinking-cat__line">
          <span className="thinking-cat__text">正在思考</span>
          <span className="thinking-cat__dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
        <span className="thinking-cat__sub">{label}</span>
      </div>
    </div>
  );
}
