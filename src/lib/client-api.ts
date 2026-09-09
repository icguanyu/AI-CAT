/**
 * 檔案：src/lib/client-api.ts
 * 角色：前端層 — 呼叫本站 /api/* 的封裝
 * 功能：自動帶入 Supabase session 的 Bearer token，統一錯誤處理。
 *       失敗一律丟 ApiError（帶 HTTP status，401 代表登入失效）。
 *       getQuota / startExam / sendChat（回傳串流 Response）/ evaluateExam。
 */
'use client';

import type { Report, TrapReveal, ChatMessage } from '@/types/exam';
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

/**
 * 開發用：一場測驗攤平成 judge:reliability 腳本吃的 fixture 形狀。
 * 只有 NODE_ENV !== 'production' 時後端才會回傳（見 /api/evaluate）。
 */
export interface FixtureDebug {
  label: string;
  scenarioId: string;
  category: import('@/types/exam').Category;
  brief: string;
  injected: boolean;
  injectionLanded: boolean;
  injectionText: string;
  injectAtTurn: number;
  verifyHint: string;
  familiarity: import('@/types/exam').Familiarity;
  history: ChatMessage[];
}

export interface EvalResult {
  report: Report;
  trap: TrapReveal | null;
  /** 「L5 高手會怎麼做」的教學示範（Markdown）；產生失敗時為空字串。 */
  exemplar: string;
  /** 僅本地開發：可下載成 fixture 的完整場次資料；正式環境為 null。 */
  debug: FixtureDebug | null;
}

export async function evaluateExam(
  examId: string,
  familiarity: import('@/types/exam').Familiarity = 'mid',
): Promise<EvalResult> {
  const res = await fetch('/api/evaluate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await bearer()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ examId, familiarity }),
  });
  const json = await parseBody(res);
  if (!res.ok) fail(json, res, '評分失敗');
  return {
    report: json.report as Report,
    trap: (json.trap as TrapReveal | null) ?? null,
    exemplar: (json.exemplar as string) ?? '',
    debug: (json.debug as FixtureDebug | undefined) ?? null,
  };
}

export interface ReportBundle extends EvalResult {
  /** 受測者顯示名稱（提交當下的 Google full_name 快照）；沒有就 null。 */
  name: string | null;
  /** 開場自評的領域熟悉度（很熟 / 普通 / 不熟）；舊報告沒有就 null。 */
  familiarity: import('@/types/exam').Familiarity | null;
  /** 這份報告是否已開啟公開分享（/s/:examId）。 */
  shared: boolean;
}

/** 取回「已提交」測驗的完整報告（本人限定；用於 /exam/result/:examId 還原）。 */
export async function getExamReport(examId: string): Promise<ReportBundle> {
  const res = await fetch(`/api/exam/${examId}/report`, {
    headers: { Authorization: `Bearer ${await bearer()}` },
  });
  const json = await parseBody(res);
  if (!res.ok) fail(json, res, '讀取報告失敗');
  return {
    report: json.report as Report,
    name: (json.name as string | null) ?? null,
    familiarity:
      (json.familiarity as ReportBundle['familiarity'] | undefined) ?? null,
    trap: (json.trap as TrapReveal | null) ?? null,
    exemplar: (json.exemplar as string) ?? '',
    debug: (json.debug as FixtureDebug | undefined) ?? null,
    shared: Boolean(json.shared),
  };
}

/** 切換公開分享旗標。shared=true → POST；false → DELETE。 */
export async function setExamShared(
  examId: string,
  shared: boolean,
): Promise<{ shared: boolean; url: string }> {
  const res = await fetch(`/api/exam/${examId}/share`, {
    method: shared ? 'POST' : 'DELETE',
    headers: { Authorization: `Bearer ${await bearer()}` },
  });
  const json = await parseBody(res);
  if (!res.ok) fail(json, res, '變更分享狀態失敗');
  return {
    shared: Boolean(json.shared),
    url: (json.url as string) ?? `/s/${examId}`,
  };
}
