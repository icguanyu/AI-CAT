/**
 * 檔案：src/lib/data-stream.ts
 * 角色：前端層 — Vercel AI SDK data stream 解析
 * 功能：把 /api/chat 回傳的 data stream（每行 `<type>:<json>`）逐段吐出文字。
 *       只處理 type `0`（文字增量）與 `3`（錯誤）；其餘控制行忽略。
 */
export async function* readTextStream(res: Response): AsyncGenerator<string> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buf = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);

      const colon = line.indexOf(':');
      if (colon === -1) continue;
      const type = line.slice(0, colon);
      const rest = line.slice(colon + 1);

      if (type === '0') {
        try {
          yield JSON.parse(rest) as string;
        } catch {
          /* 忽略解析不了的片段 */
        }
      } else if (type === '3') {
        let msg = '對話發生錯誤';
        try {
          msg = JSON.parse(rest) as string;
        } catch {
          /* 用預設訊息 */
        }
        throw new Error(msg);
      }
    }
  }
}
