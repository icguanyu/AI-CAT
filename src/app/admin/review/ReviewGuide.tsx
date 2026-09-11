/**
 * 檔案：src/app/admin/review/ReviewGuide.tsx
 * 角色：前端層 — 標註審核的「?」說明按鈕（給第一次標註的人一個方向）
 * 功能：純顯示用的小抄，點了跳出彈窗；不影響任何標註資料。
 */
'use client';

import { useState } from 'react';
import styles from '../admin.module.css';

export default function ReviewGuide() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.helpBtn}
        aria-label="標註小抄"
        title="標註小抄"
        onClick={() => setOpen(true)}
      >
        ?
      </button>

      {open && (
        <div className={styles.helpOverlay} onClick={() => setOpen(false)}>
          <div className={styles.helpModal} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.helpClose}
              aria-label="關閉"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <h2>標註小抄</h2>

            <h3>核心原則</h3>
            <p>
              同意 AI 就直接按下一格（已經預設幫你選最接近的桶）。真正要花時間的，
              只有你「想改」的那幾格——說得出具體理由才需要跟 AI 打不同分。
            </p>

            <h3>建議的閱讀順序</h3>
            <ul>
              <li>先看「題目內容」，知道這題原本要求做到什麼、有什麼限制。</li>
              <li>再看「AI 裁判的總評 / 回饋」，把它當一個假設。</li>
              <li>
                帶著這個假設回頭看逐字稿，找證據支持或推翻它——不用從頭逐字讀，
                比從零讀一遍快很多。
              </li>
            </ul>

            <h3>陷阱題怎麼看</h3>
            <p>
              直接對照「植入的陷阱」列出的錯誤敘述，找它在逐字稿出現的位置，
              只看使用者接下來怎麼回應就好。
            </p>

            <h3>時間抓法</h3>
            <p>同意 AI 的題目：30–60 秒。不同意、要改分數的：2–3 分鐘。</p>
            <p>同一個分類的題目連續標，比跨分類跳著標快，因為不用一直重建語境。</p>
          </div>
        </div>
      )}
    </>
  );
}
