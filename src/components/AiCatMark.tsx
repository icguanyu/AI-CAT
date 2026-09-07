/**
 * 檔案：src/components/AiCatMark.tsx
 * 角色：前端層 — AI-CAT 標誌（compact 版：雙耳 + 臉 + 眼）
 * 功能：inline SVG，用 currentColor 單色呈現、隨主題翻色；等比、不變形。
 *       與 wordmark 併用時 aria-hidden；留白由外層 padding/gap 控制。
 */
export function AiCatMark({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.96)}
      viewBox="0 0 100 96"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: 'block', flex: '0 0 auto' }}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={9}
        strokeLinejoin="round"
      >
        <polygon points="12,39.6 5,9 33,21" />
        <polygon points="88,39.6 95,9 67,21" />
        <polygon points="50,12 88,39.6 73.5,84.4 26.5,84.4 12,39.6" />
      </g>
      <circle cx="37" cy="50" r="6" fill="currentColor" />
      <circle cx="63" cy="50" r="6" fill="currentColor" />
    </svg>
  );
}
