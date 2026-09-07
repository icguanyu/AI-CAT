/**
 * 檔案：src/components/ThemeToggle.tsx
 * 角色：前端層 — 亮 / 暗色切換（LIGHT | DARK 藥丸）
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
      className="pill-toggle"
      aria-label={theme === 'dark' ? '切換為亮色' : '切換為暗色'}
      onClick={() => set(theme === 'dark' ? 'light' : 'dark')}
    >
      <span data-on={String(theme === 'light')}>LIGHT</span>
      <span data-on={String(theme === 'dark')}>DARK</span>
    </button>
  );
}
