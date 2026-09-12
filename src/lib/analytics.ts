/**
 * 檔案：src/lib/analytics.ts
 * 角色：前端層 — GA4 自訂事件的集中定義與安全發送
 * 功能：把「開始測驗／完成測驗／分享／認領試用」這幾個關鍵漏斗動作送一個 GA 事件，
 *       跟後台既有的 bumpTrialMetric() 是同一批動作、但這裡多了「訪客從哪裡來」的維度
 *       （GA 自己記的 referrer/UTM，程式不用管）。
 *
 * 安全規則（不可違反）：事件參數只能是中性的分類/等級資訊，絕對不能夾帶對話內容、
 * brief、陷阱敘述等機密——GA 是外部服務，塞進事件參數等於直接外流給 Google。
 *
 * NEXT_PUBLIC_GA_ID 沒設時（本機開發、或還沒在 Vercel 設定該環境變數的預覽站），
 * sendGAEvent() 本身就是安全的 no-op（頂多印一句 console.warn），不用另外判斷。
 */
'use client';

import { sendGAEvent } from '@next/third-parties/google';
import type { Category, LevelCode } from '@/types/exam';

export function trackExamStart(category: Category): void {
  sendGAEvent('event', 'exam_start', { category });
}

export function trackExamComplete(input: {
  category: Category | null;
  level: LevelCode;
  /** true = 免登入試用（結果未保存）；false = 登入版已寫入帳號。 */
  trial: boolean;
}): void {
  sendGAEvent('event', 'exam_complete', input);
}

export function trackShareResult(): void {
  sendGAEvent('event', 'share_result', {});
}

export function trackTrialClaim(): void {
  sendGAEvent('event', 'trial_claim', {});
}
