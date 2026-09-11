/**
 * 檔案：src/lib/admin-data.ts
 * 角色：領域層 — 後台用的唯讀彙總 / 查詢（P1：可見性）
 * 功能：getAdminOverview()（總覽數字）、listAdminExams()（測驗查詢列表）、
 *       getAdminExamDetail()（單場完整資料）、getScenarioHealth()（題庫健檢）。
 *       全走 service_role，呼叫端（API 路由）負責用 requireAdmin() 把關。
 */
import { getSupabaseAdmin } from '@/lib/supabase';
import { getTrialStats, type TrialStats } from '@/lib/public-pool';
import {
  CATEGORY_IDS,
  CATEGORY_LABEL,
  type Category,
  type ChatMessage,
  type Engagement,
  type Familiarity,
  type Judged,
  type LevelCode,
  type Report,
  type TrapReveal,
  type TrapType,
  type VerifyDifficulty,
} from '@/types/exam';

const DAY_MS = 86_400_000;

/* ── 總覽 ─────────────────────────────────────────────── */

export interface QuotaBucket {
  label: string;
  count: number;
}

export interface AdminOverview {
  exams: { last24h: number; last7d: number; last30d: number; total: number };
  users: number;
  trial: TrialStats;
  quotaBuckets: QuotaBucket[];
  /** 已達生涯上限（free_limit）的帳號數——未來付費方案的高意願名單大小。 */
  capHit: number;
  categoryCoverage: { category: Category; label: string; count: number }[];
}

async function countSince(sinceMs: number | null): Promise<number> {
  const admin = getSupabaseAdmin();
  let q = admin
    .from('exam_reports')
    .select('exam_id', { count: 'exact', head: true });
  if (sinceMs != null) q = q.gte('created_at', new Date(sinceMs).toISOString());
  const { count } = await q;
  return count ?? 0;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const admin = getSupabaseAdmin();
  const now = Date.now();

  const [total, last24h, last7d, last30d, usersCount, trial, quotaRows, catRows] =
    await Promise.all([
      countSince(null),
      countSince(now - DAY_MS),
      countSince(now - 7 * DAY_MS),
      countSince(now - 30 * DAY_MS),
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      getTrialStats(),
      admin.from('user_quota').select('used, free_limit').limit(50000),
      admin
        .from('exam_reports')
        .select('category:report->category')
        .order('created_at', { ascending: false })
        .limit(20000),
    ]);

  const quota = (quotaRows.data ?? []) as { used: number; free_limit: number }[];
  const bucketOf = (used: number) => {
    if (used <= 0) return '0 場';
    if (used <= 5) return '1–5 場';
    if (used <= 10) return '6–10 場';
    if (used <= 20) return '11–20 場';
    return '21 場以上';
  };
  const bucketCounts = new Map<string, number>();
  let capHit = 0;
  for (const row of quota) {
    const b = bucketOf(row.used);
    bucketCounts.set(b, (bucketCounts.get(b) ?? 0) + 1);
    if (row.used >= row.free_limit) capHit += 1;
  }
  const order = ['0 場', '1–5 場', '6–10 場', '11–20 場', '21 場以上'];
  const quotaBuckets = order.map((label) => ({
    label,
    count: bucketCounts.get(label) ?? 0,
  }));

  const catCounts = new Map<Category, number>();
  for (const row of (catRows.data ?? []) as { category: Category | null }[]) {
    if (!row.category) continue;
    catCounts.set(row.category, (catCounts.get(row.category) ?? 0) + 1);
  }
  const categoryCoverage = CATEGORY_IDS.map((category) => ({
    category,
    label: CATEGORY_LABEL[category],
    count: catCounts.get(category) ?? 0,
  })).sort((a, b) => b.count - a.count);

  return {
    exams: { last24h, last7d, last30d, total },
    users: usersCount.count ?? 0,
    trial,
    quotaBuckets,
    capHit,
    categoryCoverage,
  };
}

/* ── 測驗查詢列表 ─────────────────────────────────────── */

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
}

interface ListExamsOpts {
  /** email 片段（含 @）或 examId 片段。 */
  q?: string;
  category?: Category;
  level?: LevelCode;
  limit?: number;
  offset?: number;
}

interface RawExamRow {
  exam_id: string;
  created_at: string;
  user_id: string;
  shared: boolean;
  titleZh: string | null;
  category: Category | null;
  level: LevelCode;
  score: number | null;
  challenged: boolean | null;
  judgeVersion: string | null;
  engagement: Engagement | null;
}

export async function listAdminExams(
  opts: ListExamsOpts,
): Promise<{ rows: AdminExamRow[]; total: number }> {
  const admin = getSupabaseAdmin();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  let query = admin
    .from('exam_reports')
    .select(
      [
        'exam_id',
        'created_at',
        'user_id',
        'shared',
        'titleZh:report->titleZh',
        'category:report->category',
        'level:report->suggested_level',
        'score:report->weighted_average',
        'challenged:report->user_challenged',
        'judgeVersion:report->judge_version',
        'engagement:report->engagement',
      ].join(', '),
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const q = opts.q?.trim();
  if (q) {
    if (q.includes('@')) {
      const { data: profs } = await admin
        .from('profiles')
        .select('id')
        .ilike('email', `%${q}%`)
        .limit(200);
      const ids = (profs ?? []).map((p) => p.id as string);
      if (ids.length === 0) return { rows: [], total: 0 };
      query = query.in('user_id', ids);
    } else {
      query = query.ilike('exam_id', `%${q}%`);
    }
  }
  if (opts.category) query = query.eq('report->>category', opts.category);
  if (opts.level) query = query.eq('report->>suggested_level', opts.level);

  const { data, error, count } = await query;
  if (error) throw new Error(`查詢測驗列表失敗：${error.message}`);
  const rows = (data ?? []) as unknown as RawExamRow[];

  const ids = [...new Set(rows.map((r) => r.user_id))];
  const emailMap = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profs } = await admin
      .from('profiles')
      .select('id, email')
      .in('id', ids);
    for (const p of profs ?? []) {
      if (p.email) emailMap.set(p.id as string, p.email as string);
    }
  }

  return {
    total: count ?? rows.length,
    rows: rows.map((r) => ({
      examId: r.exam_id,
      createdAt: r.created_at,
      userId: r.user_id,
      email: emailMap.get(r.user_id) ?? null,
      titleZh: r.titleZh ?? null,
      category: r.category ?? null,
      level: r.level,
      weightedAverage: r.score ?? 0,
      challenged: Boolean(r.challenged),
      shared: Boolean(r.shared),
      judgeVersion: r.judgeVersion ?? null,
      turns: r.engagement?.userTurns ?? null,
    })),
  };
}

/* ── 單場完整資料 ─────────────────────────────────────── */

export interface AdminExamDetail {
  examId: string;
  createdAt: string;
  userId: string;
  email: string | null;
  ageBand: string | null;
  education: string | null;
  gender: string | null;
  report: Report;
  titleZh: string | null;
  category: Category | null;
  familiarity: Familiarity | null;
  trap: TrapReveal | null;
  noTrap: boolean;
  trapType: TrapType | null;
  verifyDifficulty: VerifyDifficulty | null;
  injectAtTurn: number | null;
  engagement: Engagement | null;
  judgeRaw: Judged | null;
  judgeVersion: string | null;
  exemplar: string;
  transcript: ChatMessage[] | null;
  shared: boolean;
  weightedAverage: number;
}

/** report jsonb 的寬鬆形狀，只取後台要用的欄位。 */
interface StoredReportLoose extends Report {
  weighted_average?: number;
  titleZh?: string;
  category?: Category;
  familiarity?: Familiarity;
  trap?: TrapReveal | null;
  noTrap?: boolean;
  trapType?: TrapType | null;
  verifyDifficulty?: VerifyDifficulty | null;
  injectAtTurn?: number | null;
  engagement?: Engagement | null;
  judge_raw?: Judged | null;
  judge_version?: string;
  exemplar?: string;
  user_name?: string | null;
}

export async function getAdminExamDetail(
  examId: string,
): Promise<AdminExamDetail | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('exam_reports')
    .select('exam_id, created_at, user_id, shared, transcript, report')
    .eq('exam_id', examId)
    .maybeSingle();
  if (error || !data) return null;

  const r = data.report as StoredReportLoose;
  const { data: prof } = await admin
    .from('profiles')
    .select('email, age_band, education, gender')
    .eq('id', data.user_id)
    .maybeSingle();

  return {
    examId: data.exam_id as string,
    createdAt: data.created_at as string,
    userId: data.user_id as string,
    email: (prof?.email as string | undefined) ?? null,
    ageBand: (prof?.age_band as string | undefined) ?? null,
    education: (prof?.education as string | undefined) ?? null,
    gender: (prof?.gender as string | undefined) ?? null,
    report: {
      scores: r.scores,
      overall_summary: r.overall_summary,
      user_challenged: r.user_challenged,
      did_well: r.did_well ?? [],
      to_improve: r.to_improve ?? [],
      suggested_level: r.suggested_level,
    },
    titleZh: r.titleZh ?? null,
    category: r.category ?? null,
    familiarity: r.familiarity ?? null,
    trap: r.trap ?? null,
    noTrap: Boolean(r.noTrap),
    trapType: r.trapType ?? null,
    verifyDifficulty: r.verifyDifficulty ?? null,
    injectAtTurn: r.injectAtTurn ?? null,
    engagement: r.engagement ?? null,
    judgeRaw: r.judge_raw ?? null,
    judgeVersion: r.judge_version ?? null,
    exemplar: r.exemplar ?? '',
    transcript: (data.transcript as ChatMessage[] | null) ?? null,
    shared: Boolean(data.shared),
    weightedAverage: r.weighted_average ?? 0,
  };
}

/* ── 題庫健檢 ─────────────────────────────────────────── */

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

interface ScenarioTrapPeek {
  challenged?: boolean;
}

export async function getScenarioHealth(): Promise<ScenarioHealthRow[]> {
  const admin = getSupabaseAdmin();
  const [{ data: scenarios }, { data: rows }] = await Promise.all([
    admin
      .from('scenarios')
      .select('id, title_zh, category, active')
      .order('category', { ascending: true }),
    admin
      .from('exam_reports')
      .select(
        'scenarioId:scenario_id, score:report->weighted_average, trap:report->trap',
      )
      .order('created_at', { ascending: false })
      .limit(20000),
  ]);

  const stat = new Map<
    string,
    { served: number; scoreSum: number; trapShown: number; trapCaught: number }
  >();
  for (const row of (rows ?? []) as unknown as {
    scenarioId: string;
    score: number | null;
    trap: ScenarioTrapPeek | null;
  }[]) {
    const s = stat.get(row.scenarioId) ?? {
      served: 0,
      scoreSum: 0,
      trapShown: 0,
      trapCaught: 0,
    };
    s.served += 1;
    s.scoreSum += row.score ?? 0;
    if (row.trap) {
      s.trapShown += 1;
      if (row.trap.challenged) s.trapCaught += 1;
    }
    stat.set(row.scenarioId, s);
  }

  return ((scenarios ?? []) as {
    id: string;
    title_zh: string | null;
    category: Category | null;
    active: boolean;
  }[]).map((sc) => {
    const s = stat.get(sc.id);
    return {
      id: sc.id,
      titleZh: sc.title_zh ?? sc.id,
      category: sc.category,
      active: Boolean(sc.active),
      served: s?.served ?? 0,
      avgScore: s && s.served > 0 ? Math.round(s.scoreSum / s.served) : null,
      trapShown: s?.trapShown ?? 0,
      trapCaught: s?.trapCaught ?? 0,
    };
  });
}
