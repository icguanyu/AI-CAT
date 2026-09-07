/**
 * 檔案：src/lib/client-api.ts
 * 角色：前端層 — 呼叫本站 /api/* 的封裝
 * 功能：自動帶入 Supabase session 的 Bearer token，統一錯誤處理。
 *       startExam / sendChat（回傳串流 Response）/ evaluateExam。
 */
'use client';

import type { Report } from '@/types/exam';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

async function bearer(): Promise<string> {
  const { data } = await createSupabaseBrowser().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('尚未登入，請重新登入');
  return token;
}

export interface StartResult {
  examId: string;
  brief: string;
  limits: { maxUserTurns: number; maxInputChars: number };
  quota: { used: number; limit: number };
}

export async function startExam(): Promise<StartResult> {
  const res = await fetch('/api/exam/start', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await bearer()}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? '開始測驗失敗');
  return json as StartResult;
}

/** 回傳串流 Response，交給 readTextStream 逐段讀取。 */
export async function sendChat(examId: string, message: string): Promise<Response> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await bearer()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ examId, message }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? '對話失敗');
  }
  return res;
}

export async function evaluateExam(examId: string): Promise<Report> {
  const res = await fetch('/api/evaluate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await bearer()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ examId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? '評分失敗');
  return json.report as Report;
}
