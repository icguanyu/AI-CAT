/**
 * 檔案：open-next.config.ts
 * 角色：部署設定 — OpenNext 的 Cloudflare 轉接器設定
 * 功能：把 `next build` 的產物轉成可在 Cloudflare Workers 執行的 worker。
 *       目前用預設值；日後要加 R2 增量快取、KV tag cache 等再於此設定。
 */
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig();
