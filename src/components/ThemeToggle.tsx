/**
 * 檔案：src/components/ThemeToggle.tsx
 * 角色：前端層 — 亮 / 暗色切換（日 / 月 icon 藥丸）
 * 功能：切換 <html data-theme> 並寫入 localStorage('ai-cat-theme')。
 *       初始主題由 layout.tsx 的 inline script 在繪製前決定（免閃爍）。
 */
'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'ai-cat-theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const cur = document.documentElement.getAttribute('data-theme');
    setTheme(cur === 'dark' ? 'dark' : 'light');
  }, []);

  const set = (next: Theme) => {
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* localStorage 不可用時仍即時切換 */
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      className="pill-toggle pill-toggle--icon"
      aria-label={theme === 'dark' ? '切換為亮色' : '切換為暗色'}
      title={theme === 'dark' ? '切換為亮色' : '切換為暗色'}
      onClick={() => set(theme === 'dark' ? 'light' : 'dark')}
    >
      <span data-on={String(theme === 'light')} aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2M12 19.5v2M4.3 4.3l1.4 1.4M18.3 18.3l1.4 1.4M2.5 12h2M19.5 12h2M4.3 19.7l1.4-1.4M18.3 5.7l1.4-1.4" />
        </svg>
      </span>
      <span data-on={String(theme === 'dark')} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M21 12.9A9 9 0 1 1 11.1 3a7 7 0 1 0 9.9 9.9Z" />
        </svg>
      </span>
    </button>
  );
}
