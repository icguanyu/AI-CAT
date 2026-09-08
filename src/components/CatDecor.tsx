/**
 * 檔案：src/components/CatDecor.tsx
 * 角色：前端層 — 純裝飾用的貓咪標記（向量版，對齊 assets/png 的線稿：耳＋臉＋眼＋鬍鬚）
 * 功能：aria-hidden 的 inline SVG，用 currentColor 單色、隨主題翻色、等比不失真。
 *       animated=true 時加上非常緩慢的呼吸／眨眼／耳朵抽動（沿用 thinking 指示器的
 *       keyframes，放慢週期），並尊重 prefers-reduced-motion（於 globals.css 關閉）。
 */
export function CatDecor({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg
      viewBox="-8 -4 116 104"
      aria-hidden="true"
      focusable="false"
      className={
        'cat-decor' +
        (animated ? ' cat-decor--alive' : '') +
        (className ? ' ' + className : '')
      }
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={6}
        strokeLinejoin="round"
      >
        <polygon className="cat-decor__ear-l" points="12,39.6 5,9 33,21" />
        <polygon className="cat-decor__ear-r" points="88,39.6 95,9 67,21" />
        <polygon points="50,12 88,39.6 73.5,84.4 26.5,84.4 12,39.6" />
      </g>
      <g className="cat-decor__eyes">
        <circle cx="37" cy="50" r="5" fill="currentColor" />
        <circle cx="63" cy="50" r="5" fill="currentColor" />
      </g>
      <g stroke="currentColor" strokeWidth={4} strokeLinecap="round">
        <line x1="-3" y1="58" x2="15" y2="58" />
        <line x1="-1" y1="69" x2="18" y2="69" />
        <line x1="103" y1="58" x2="85" y2="58" />
        <line x1="101" y1="69" x2="82" y2="69" />
      </g>
    </svg>
  );
}
