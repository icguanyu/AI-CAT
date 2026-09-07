/**
 * 檔案：src/lib/api-error.ts
 * 角色：API 層 — 統一把未攔截的例外轉成 JSON 回應
 * 功能：errJson(e) 回 `{ error: <訊息> }` + 500，並在伺服器 log 完整錯誤。
 *       路由用 `return handle(req).catch(errJson)` 包住，避免空 body 的 500
 *       讓前端 `res.json()` 爆「Unexpected end of JSON input」。
 */
export function errJson(e: unknown): Response {
  console.error('[api error]', e);
  const message =
    e instanceof Error ? e.message : '伺服器發生未預期錯誤，請稍後再試';
  return Response.json({ error: message }, { status: 500 });
}
