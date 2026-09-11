/**
 * 檔案：src/lib/text-similarity.ts
 * 角色：領域層 — 簡單的文字相似度（給後台「疑似套用外部腳本」偵測用）
 * 功能：charTrigramJaccard() 用字元三連詞（trigram）算 Jaccard 相似度。
 *       中文沒有天然的詞界，用字元 n-gram 比字詞比對穩，不需要斷詞、不用叫外部服務。
 *       只是提示訊號，不是證據——後台只拿來標記給人看，不自動扣分或擋提交。
 */

function normalize(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

function trigrams(text: string): Set<string> {
  const t = normalize(text);
  const set = new Set<string>();
  if (t.length === 0) return set;
  if (t.length < 3) {
    set.add(t);
    return set;
  }
  for (let i = 0; i <= t.length - 3; i++) set.add(t.slice(i, i + 3));
  return set;
}

/** 兩段文字的字元三連詞 Jaccard 相似度，0（完全不同）～1（幾乎一樣）。 */
export function charTrigramJaccard(a: string, b: string): number {
  const setA = trigrams(a);
  const setB = trigrams(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersect = 0;
  for (const g of setA) {
    if (setB.has(g)) intersect++;
  }
  const union = setA.size + setB.size - intersect;
  return union === 0 ? 0 : intersect / union;
}
