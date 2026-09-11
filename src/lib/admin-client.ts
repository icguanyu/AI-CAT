/**
 * 檔案：src/lib/admin-client.ts
 * 角色：前端層 — /admin 頁面呼叫 /api/admin/* 的封裝
 * 功能：獨立於 client-api.ts（避免跟主流程搶同一個檔），一樣是帶 Bearer + 統一錯誤。
 *       403 一律視為「不是後台管理員」，頁面據此顯示無權限畫面。
 */
'use client';

import { createSupabaseBrowser } from '@/lib/supabase-browser';
import type {
  Category,
  ChatMessage,
  ExamTokenUsage,
  Familiarity,
  Judged,
  JudgeConsistency,
  LevelCode,
  Report,
  TrapReveal,
  TrapType,
  VerifyDifficulty,
} from '@/types/exam';
import type { ScoreBucket, ScoreKey } from '@/types/label';

export class AdminApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
  get forbidden(): boolean {
    return this.status === 403;
  }
  get unauthorized(): boolean {
    return this.status === 401;
  }
}

async function bearer(): Promise<string> {
  const { data } = await createSupabaseBrowser().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AdminApiError('尚未登入', 401);
  return token;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${await bearer()}` },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new AdminApiError(json.error ?? `伺服器錯誤（${res.status}）`, res.status);
  }
  return json as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await bearer()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new AdminApiError(json.error ?? `伺服器錯誤（${res.status}）`, res.status);
  }
  return json as T;
}

/* ── 身分（完整管理員 / 標註員） ──────────────────────── */

export interface WhoAmI {
  email: string;
  role: 'admin' | 'reviewer';
}

export function getWhoAmI(): Promise<WhoAmI> {
  return get('/api/admin/whoami');
}

export interface QuotaBucket {
  label: string;
  count: number;
}
export interface TrialStatsView {
  monthUsed: number;
  monthLimit: number;
  dayUsed: number;
  dayLimit: number;
  exhausted: boolean;
  month: string;
  started: number;
  completed: number;
  claimed: number;
}
export interface AdminOverview {
  exams: { last24h: number; last7d: number; last30d: number; total: number };
  users: number;
  trial: TrialStatsView;
  quotaBuckets: QuotaBucket[];
  capHit: number;
  categoryCoverage: { category: Category; label: string; count: number }[];
}

export function getAdminOverview(): Promise<AdminOverview> {
  return get('/api/admin/overview');
}

export interface AdminExamRow {
  examId: string;
  createdAt: string;
  userId: string;
  email: string | null;
  titleZh: string | null;
  category: Category | null;
  level: LevelCode;
  weightedAverage: number;
  challenged: boolean;
  shared: boolean;
  judgeVersion: string | null;
  turns: number | null;
  excludedFromTraining: boolean;
}

export function listAdminExams(params: {
  q?: string;
  category?: Category;
  level?: LevelCode;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AdminExamRow[]; total: number }> {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.category) sp.set('category', params.category);
  if (params.level) sp.set('level', params.level);
  sp.set('limit', String(params.limit ?? 50));
  sp.set('offset', String(params.offset ?? 0));
  return get(`/api/admin/exams?${sp.toString()}`);
}

export interface AdminExamDetail {
  examId: string;
  createdAt: string;
  userId: string;
  email: string | null;
  ageBand: string | null;
  education: string | null;
  gender: string | null;
  report: Report;
  brief: string | null;
  titleZh: string | null;
  category: Category | null;
  familiarity: Familiarity | null;
  trap: TrapReveal | null;
  noTrap: boolean;
  trapType: TrapType | null;
  verifyDifficulty: VerifyDifficulty | null;
  injectAtTurn: number | null;
  engagement: {
    elapsedSec: number;
    userTurns: number;
    userCharsTotal: number;
    reachedInjection: boolean | null;
  } | null;
  judgeVotes: Judged[] | null;
  judgeConsistency: JudgeConsistency | null;
  tokenUsage: ExamTokenUsage | null;
  judgeVersion: string | null;
  exemplar: string;
  transcript: ChatMessage[] | null;
  shared: boolean;
  weightedAverage: number;
  excludedFromTraining: boolean;
}

export function getAdminExamDetail(examId: string): Promise<AdminExamDetail> {
  return get(`/api/admin/exams/${examId}`);
}

export function setExamExcluded(
  examId: string,
  excluded: boolean,
): Promise<{ ok: true }> {
  return post(`/api/admin/exams/${examId}/exclude`, { excluded });
}

export interface ScenarioHealthRow {
  id: string;
  titleZh: string;
  category: Category | null;
  active: boolean;
  served: number;
  avgScore: number | null;
  trapShown: number;
  trapCaught: number;
}

export function getScenarioHealth(): Promise<ScenarioHealthRow[]> {
  return get('/api/admin/scenarios');
}

export function setScenarioActive(
  id: string,
  active: boolean,
): Promise<{ ok: true }> {
  return post(`/api/admin/scenarios/${id}/toggle`, { active });
}

/* ── 使用者查詢 / 配額調整 ────────────────────────────── */

export interface AdminUserRow {
  userId: string;
  email: string | null;
  fullName: string | null;
  used: number;
  freeLimit: number;
  dayUsed: number;
  dayDate: string | null;
  ageBand: string | null;
  education: string | null;
  gender: string | null;
  reviewCount: number;
}

export function searchAdminUsers(q: string): Promise<AdminUserRow[]> {
  const sp = new URLSearchParams();
  if (q) sp.set('q', q);
  return get(`/api/admin/users?${sp.toString()}`);
}

export function getAdminUser(userId: string): Promise<AdminUserRow> {
  return get(`/api/admin/users/${userId}`);
}

export function updateAdminUserQuota(
  userId: string,
  patch: { freeLimit?: number; used?: number; dayUsed?: number },
): Promise<AdminUserRow> {
  return post(`/api/admin/users/${userId}/quota`, patch);
}

/* ── 標註審核（P3） ───────────────────────────────────── */

export interface ReviewQueueRow {
  examId: string;
  createdAt: string;
  titleZh: string | null;
  category: Category | null;
  level: LevelCode;
  weightedAverage: number;
  challenged: boolean;
  noTrap: boolean;
  hasTrap: boolean;
  excludedFromTraining: boolean;
  /** 目前這個管理員自己標過這題（跟別人有沒有標過無關）。 */
  labeledByMe: boolean;
  /** 這題目前總共有幾個人標過。 */
  reviewerCount: number;
}

export function getReviewQueue(params: {
  onlyUnlabeled?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ rows: ReviewQueueRow[]; total: number }> {
  const sp = new URLSearchParams();
  if (params.onlyUnlabeled) sp.set('onlyUnlabeled', '1');
  sp.set('limit', String(params.limit ?? 20));
  sp.set('offset', String(params.offset ?? 0));
  return get(`/api/admin/review?${sp.toString()}`);
}

export interface JudgeLabel {
  examId: string;
  reviewerEmail: string;
  scores: Record<ScoreKey, ScoreBucket>;
  challengedCorrect: boolean | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getReviewItem(
  examId: string,
): Promise<{
  exam: AdminExamDetail;
  myLabel: JudgeLabel | null;
  otherLabels: JudgeLabel[];
}> {
  return get(`/api/admin/review/${examId}`);
}

export function saveReviewLabel(
  examId: string,
  input: {
    scores: Record<ScoreKey, ScoreBucket>;
    challengedCorrect: boolean | null;
    note: string | null;
  },
): Promise<JudgeLabel> {
  return post(`/api/admin/review/${examId}`, input);
}

/* ── 後台可調參數 ─────────────────────────────────────── */

export interface AppSettingRow {
  key: string;
  label: string;
  description: string;
  default: number;
  min: number;
  max: number;
  value: number;
  overridden: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export function getAppSettings(): Promise<AppSettingRow[]> {
  return get('/api/admin/settings');
}

export function setAppSetting(key: string, value: number): Promise<AppSettingRow> {
  return post('/api/admin/settings', { key, value });
}

export function resetAppSetting(key: string): Promise<AppSettingRow> {
  return post(`/api/admin/settings/${key}/reset`, {});
}
