/**
 * 檔案：src/lib/client-api.ts
 * 角色：前端層 — 呼叫本站 /api/* 的封裝
 * 功能：自動帶入 Supabase session 的 Bearer token，統一錯誤處理。
 *       失敗一律丟 ApiError（帶 HTTP status，401 代表登入失效）。
 *       getQuota / startExam / sendChat（回傳串流 Response）/ evaluateExam。
 */
'use client';

import type { Report, TrapReveal } from '@/types/exam';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
  /** 登入憑證問題，UI 應引導重新登入。 */
  get isAuth(): boolean {
    return this.status === 401;
  }
}

async function bearer(): Promise<string> {
  const { data } = await createSupabaseBrowser().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError('登入狀態已失效，請重新登入', 401);
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

function fail(json: Record<string, unknown>, res: Response, fallback: string): never {
  throw new ApiError((json.error as string) ?? fallback, res.status);
}

export interface Quota {
  used: number;
  limit: number;
}

export interface StartResult {
  examId: string;
  brief: string;
  limits: { maxUserTurns: number; maxInputChars: number };
  quota: Quota;
}

export async function getQuota(): Promise<Quota> {
  const res = await fetch('/api/quota', {
    headers: { Authorization: `Bearer ${await bearer()}` },
  });
  const json = await parseBody(res);
  if (!res.ok) fail(json, res, '讀取次數失敗');
  return json as unknown as Quota;
}

export async function startExam(): Promise<StartResult> {
  const res = await fetch('/api/exam/start', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await bearer()}` },
  });
  const json = await parseBody(res);
  if (!res.ok) fail(json, res, '開始測驗失敗');
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
  if (!res.ok) fail(await parseBody(res), res, '對話失敗');
  return res;
}

export interface EvalResult {
  report: Report;
  trap: TrapReveal | null;
}

export async function evaluateExam(examId: string): Promise<EvalResult> {
  const res = await fetch('/api/evaluate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await bearer()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ examId }),
  });
  const json = await parseBody(res);
  if (!res.ok) fail(json, res, '評分失敗');
  return {
    report: json.report as Report,
    trap: (json.trap as TrapReveal | null) ?? null,
  };
}
