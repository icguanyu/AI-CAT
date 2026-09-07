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

/** 容錯解析：空 body / 非 JSON（例如 Next 的 500 HTML）不會炸，改回可讀訊息。 */
async function parseBody(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: `伺服器錯誤（${res.status}）` };
  }
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
  const json = await parseBody(res);
  if (!res.ok) throw new Error((json.error as string) ?? '開始測驗失敗');
  return json as unknown as StartResult;
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
    const json = await parseBody(res);
    throw new Error((json.error as string) ?? '對話失敗');
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
  const json = await parseBody(res);
  if (!res.ok) throw new Error((json.error as string) ?? '評分失敗');
  return json.report as Report;
}
