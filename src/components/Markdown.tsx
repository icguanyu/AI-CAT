/**
 * 檔案：src/components/Markdown.tsx
 * 角色：前端層 — 對話訊息的 Markdown 渲染
 * 功能：以 react-markdown + remark-gfm 渲染助手回覆（標題 / 清單 / 表格 /
 *       code block / 粗體…）。預設不解析 raw HTML，無 XSS 風險。
 *       樣式在 globals.css 的 .md 區塊。
 */
'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
