/**
 * 檔案：vitest.config.mts
 * 角色：測試執行設定
 * 功能：讓測試檔案也看得懂 `@/` 這個路徑別名（跟 tsconfig.json 的 paths 對應），
 *       並且只在 Node 環境跑（這批測試都是純函式，不需要瀏覽器 DOM）。
 */
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
