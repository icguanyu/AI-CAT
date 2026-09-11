/**
 * 檔案：src/lib/admin-data.ts
 * 角色：領域層 — 後台用的唯讀彙總 / 查詢（P1：可見性）
 * 功能：getAdminOverview()（總覽數字）、listAdminExams()（測驗查詢列表）、
 *       getAdminExamDetail()（單場完整資料）、getScenarioHealth()（題庫健檢）、
 *       getAppSettings() / setAppSetting()（後台可調參數，如裁判 self-consistency 次數）。
 *       全走 service_role，呼叫端（API 路由）負責用 requireAdmin() 把關。
 */
import { getSupabaseAdmin } from '@/lib/supabase';
import { getTrialStats, type TrialStats } from '@/lib/public-pool';
import { getScenarioVariant } from '@/lib/scenarios';
import { setSetting } from '@/lib/app-settings';
import { JUDGE_CONSISTENCY_RUNS } from '@/config/constants';
import {
  CATEGORY_IDS,
  CATEGORY_LABEL,
  type Category,
  type ChatMessage,
  type Engagement,
  type ExamTokenUsage,
  type Familiarity,
  type Judged,
  type JudgeConsistency,
  type LevelCode,
  type Report,
  type TrapReveal,
  type TrapType,
  type VerifyDifficulty,
} from '@/types/exam';
import { SCORE_KEYS, isScoreBucket, type ScoreBucket, type ScoreKey } from '@/types/label';

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
  excludedFromTraining: boolean;
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
  excluded_from_training: boolean | null;
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
        'excluded_from_training',
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
      excludedFromTraining: Boolean(r.excluded_from_training),
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
  /** 受測者當時看到的題目內容與限制（依 scenario_id + variant_index 還原）；題庫異動後可能對不上，此時為 null。 */
  brief: string | null;
  titleZh: string | null;
  category: Category | null;
  familiarity: Familiarity | null;
  trap: TrapReveal | null;
  noTrap: boolean;
  trapType: TrapType | null;
  verifyDifficulty: VerifyDifficulty | null;
  injectAtTurn: number | null;
  engagement: Engagement | null;
  /** self-consistency 每一次「未加工」的原始輸出（未跑 self-consistency 前的舊資料為 null）。 */
  judgeVotes: Judged[] | null;
  /** N 次之間的一致性摘要（每維度標準差、標準差偏高的維度）。 */
  judgeConsistency: JudgeConsistency | null;
  /** 這場的 token 用量拆解（對話 + 裁判 + 示範）；上線前的舊資料為 null。 */
  tokenUsage: ExamTokenUsage | null;
  judgeVersion: string | null;
  exemplar: string;
  transcript: ChatMessage[] | null;
  shared: boolean;
  weightedAverage: number;
  excludedFromTraining: boolean;
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
  judge_votes?: Judged[] | null;
  judge_consistency?: JudgeConsistency | null;
  token_usage?: ExamTokenUsage | null;
  judge_version?: string;
  exemplar?: string;
  user_name?: string | null;
  variant_index?: number;
}

export async function getAdminExamDetail(
  examId: string,
): Promise<AdminExamDetail | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('exam_reports')
    .select(
      'exam_id, created_at, user_id, scenario_id, shared, excluded_from_training, transcript, report',
    )
    .eq('exam_id', examId)
    .maybeSingle();
  if (error || !data) return null;

  const r = data.report as StoredReportLoose;
  const { data: prof } = await admin
    .from('profiles')
    .select('email, age_band, education, gender')
    .eq('id', data.user_id)
    .maybeSingle();

  let brief: string | null = null;
  try {
    const variant = await getScenarioVariant(
      data.scenario_id as string,
      r.variant_index ?? 0,
    );
    brief = variant.brief;
  } catch {
    // 題庫可能已刪除/改版對不上這個 scenario_id+variant_index，看不到原題目就顯示為 null。
    brief = null;
  }

  return {
    examId: data.exam_id as string,
    createdAt: data.created_at as string,
    userId: data.user_id as string,
    email: (prof?.email as string | undefined) ?? null,
    ageBand: (prof?.age_band as string | undefined) ?? null,
    education: (prof?.education as string | undefined) ?? null,
    gender: (prof?.gender as string | undefined) ?? null,
    brief,
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
    judgeVotes: r.judge_votes ?? null,
    judgeConsistency: r.judge_consistency ?? null,
    tokenUsage: r.token_usage ?? null,
    judgeVersion: r.judge_version ?? null,
    exemplar: r.exemplar ?? '',
    transcript: (data.transcript as ChatMessage[] | null) ?? null,
    shared: Boolean(data.shared),
    weightedAverage: r.weighted_average ?? 0,
    excludedFromTraining: Boolean(data.excluded_from_training),
  };
}

/** 標記 / 取消標記「排除訓練集」；不影響評分或使用者看到的報告。 */
export async function setExamExcluded(
  examId: string,
  excluded: boolean,
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('exam_reports')
    .update({ excluded_from_training: excluded })
    .eq('exam_id', examId);
  if (error) throw new Error(`更新排除標記失敗：${error.message}`);
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

/** 開關某題是否會被抽中（scenarios.active）；不刪資料，隨時可切回來。 */
export async function setScenarioActive(
  id: string,
  active: boolean,
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('scenarios')
    .update({ active })
    .eq('id', id);
  if (error) throw new Error(`切換題目狀態失敗：${error.message}`);
}

/* ── 使用者查詢 / 配額調整 ────────────────────────────── */

export interface AdminUserRow {
  userId: string;
  email: string | null;
  fullName: string | null;
  /** 生涯已用 / 生涯上限 */
  used: number;
  freeLimit: number;
  /** 今日已用；dayDate 非今天時視覺上會過期，數字本身仍是最後一次寫入的值。 */
  dayUsed: number;
  dayDate: string | null;
  ageBand: string | null;
  education: string | null;
  gender: string | null;
  /** 這個帳號在 judge_labels 裡標註（複查）過幾筆——標註員或身兼標註的管理員都算。 */
  reviewCount: number;
}

interface RawProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  age_band: string | null;
  education: string | null;
  gender: string | null;
}
interface RawQuotaRow {
  user_id: string;
  used: number;
  free_limit: number;
  day_used: number;
  day_date: string | null;
}

function mergeUserRow(
  p: RawProfileRow,
  q: RawQuotaRow | undefined,
  reviewCount: number,
): AdminUserRow {
  return {
    userId: p.id,
    email: p.email,
    fullName: p.full_name,
    used: q?.used ?? 0,
    freeLimit: q?.free_limit ?? 0,
    dayUsed: q?.day_used ?? 0,
    dayDate: q?.day_date ?? null,
    ageBand: p.age_band,
    education: p.education,
    gender: p.gender,
    reviewCount,
  };
}

/** 一次查一批 email 各自標註過幾筆；資料量小，直接抓 reviewer_email 欄位在 JS 裡算。 */
async function countReviewsByEmails(emails: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (emails.length === 0) return counts;
  const { data } = await getSupabaseAdmin()
    .from('judge_labels')
    .select('reviewer_email')
    .in('reviewer_email', emails);
  for (const row of (data ?? []) as { reviewer_email: string }[]) {
    const key = row.reviewer_email.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** 依 email 片段搜尋帳號（空字串 = 依 email 排序回前 50 筆）。 */
export async function searchAdminUsers(q: string): Promise<AdminUserRow[]> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from('profiles')
    .select('id, email, full_name, age_band, education, gender')
    .order('email', { ascending: true })
    .limit(50);
  const trimmed = q.trim();
  if (trimmed) query = query.ilike('email', `%${trimmed}%`);

  const { data: profs, error } = await query;
  if (error) throw new Error(`搜尋使用者失敗：${error.message}`);
  const rows = (profs ?? []) as RawProfileRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const emails = rows.map((r) => r.email).filter((e): e is string => Boolean(e));
  const [{ data: quotas }, reviewCounts] = await Promise.all([
    admin
      .from('user_quota')
      .select('user_id, used, free_limit, day_used, day_date')
      .in('user_id', ids),
    countReviewsByEmails(emails),
  ]);
  const qMap = new Map(
    ((quotas ?? []) as RawQuotaRow[]).map((r) => [r.user_id, r]),
  );

  return rows.map((p) =>
    mergeUserRow(
      p,
      qMap.get(p.id),
      p.email ? (reviewCounts.get(p.email.toLowerCase()) ?? 0) : 0,
    ),
  );
}

export async function getAdminUser(userId: string): Promise<AdminUserRow | null> {
  const admin = getSupabaseAdmin();
  const [{ data: p }, { data: q }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, email, full_name, age_band, education, gender')
      .eq('id', userId)
      .maybeSingle(),
    admin
      .from('user_quota')
      .select('user_id, used, free_limit, day_used, day_date')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);
  if (!p) return null;
  const prof = p as RawProfileRow;
  const reviewCounts = prof.email ? await countReviewsByEmails([prof.email]) : new Map();
  return mergeUserRow(
    prof,
    (q as RawQuotaRow) ?? undefined,
    prof.email ? (reviewCounts.get(prof.email.toLowerCase()) ?? 0) : 0,
  );
}

/** 手動調整某帳號的配額；只送有給的欄位，其餘不動。用於 comp / 客訴處理。 */
export async function updateAdminUserQuota(
  userId: string,
  patch: { freeLimit?: number; used?: number; dayUsed?: number },
): Promise<AdminUserRow | null> {
  const set: Record<string, number> = {};
  if (Number.isFinite(patch.freeLimit)) {
    set.free_limit = Math.max(0, Math.floor(patch.freeLimit as number));
  }
  if (Number.isFinite(patch.used)) {
    set.used = Math.max(0, Math.floor(patch.used as number));
  }
  if (Number.isFinite(patch.dayUsed)) {
    set.day_used = Math.max(0, Math.floor(patch.dayUsed as number));
  }
  if (Object.keys(set).length > 0) {
    const { error } = await getSupabaseAdmin()
      .from('user_quota')
      .upsert({ user_id: userId, ...set }, { onConflict: 'user_id' });
    if (error) throw new Error(`更新配額失敗：${error.message}`);
  }
  return getAdminUser(userId);
}

/* ── 標註審核（P3）────────────────────────────────────── */

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
  /** 目前這個管理員自己標過這題（同一題其他人標過與否不算）。 */
  labeledByMe: boolean;
  /** 這題目前總共有幾個人標過（>1 才有機會算一致率）。 */
  reviewerCount: number;
}

/** examId 只可能是我們自己 insert 的 uuid；仍過濾掉非 [a-f0-9-] 字元防呆。 */
const safeIdList = (ids: string[]) =>
  ids.map((id) => id.replace(/[^a-f0-9-]/gi, '')).filter(Boolean);

export async function getReviewQueue(opts: {
  /** 「只看未標註」是指這個人自己還沒標過，不是全站都沒人標過。 */
  reviewerEmail: string;
  onlyUnlabeled?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ rows: ReviewQueueRow[]; total: number }> {
  const admin = getSupabaseAdmin();
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);

  const { data: labelRows } = await admin
    .from('judge_labels')
    .select('exam_id, reviewer_email')
    .limit(20000);
  const reviewersByExam = new Map<string, Set<string>>();
  for (const r of (labelRows ?? []) as { exam_id: string; reviewer_email: string }[]) {
    const s = reviewersByExam.get(r.exam_id) ?? new Set<string>();
    s.add(r.reviewer_email);
    reviewersByExam.set(r.exam_id, s);
  }
  const myLabeledIds = new Set(
    [...reviewersByExam.entries()]
      .filter(([, reviewers]) => reviewers.has(opts.reviewerEmail))
      .map(([examId]) => examId),
  );

  let query = admin
    .from('exam_reports')
    .select(
      [
        'exam_id',
        'created_at',
        'excluded_from_training',
        'titleZh:report->titleZh',
        'category:report->category',
        'level:report->suggested_level',
        'score:report->weighted_average',
        'challenged:report->user_challenged',
        'noTrap:report->noTrap',
        'trap:report->trap',
      ].join(', '),
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.onlyUnlabeled && myLabeledIds.size > 0) {
    const idList = safeIdList([...myLabeledIds]);
    if (idList.length > 0) query = query.not('exam_id', 'in', `(${idList.join(',')})`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`讀取審核佇列失敗：${error.message}`);

  const rows = (data ?? []) as unknown as {
    exam_id: string;
    created_at: string;
    excluded_from_training: boolean | null;
    titleZh: string | null;
    category: Category | null;
    level: LevelCode;
    score: number | null;
    challenged: boolean | null;
    noTrap: boolean | null;
    trap: TrapReveal | null;
  }[];

  return {
    total: count ?? rows.length,
    rows: rows.map((r) => ({
      examId: r.exam_id,
      createdAt: r.created_at,
      titleZh: r.titleZh,
      category: r.category,
      level: r.level,
      weightedAverage: r.score ?? 0,
      challenged: Boolean(r.challenged),
      noTrap: Boolean(r.noTrap),
      hasTrap: r.trap != null,
      excludedFromTraining: Boolean(r.excluded_from_training),
      labeledByMe: myLabeledIds.has(r.exam_id),
      reviewerCount: reviewersByExam.get(r.exam_id)?.size ?? 0,
    })),
  };
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

interface RawLabelRow {
  exam_id: string;
  reviewer_email: string;
  prompt_structure: string;
  decomposition: string;
  efficiency: string;
  critical_thinking: string;
  task_completion: string;
  challenged_correct: boolean | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

function mapLabelRow(r: RawLabelRow): JudgeLabel {
  const scores = {} as Record<ScoreKey, ScoreBucket>;
  for (const k of SCORE_KEYS) {
    const v = r[k];
    scores[k] = isScoreBucket(v) ? v : 'basic';
  }
  return {
    examId: r.exam_id,
    reviewerEmail: r.reviewer_email,
    scores,
    challengedCorrect: r.challenged_correct,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** 「我」對這題標過的那一份（沒有就 null）。 */
export async function getJudgeLabel(
  examId: string,
  reviewerEmail: string,
): Promise<JudgeLabel | null> {
  const { data } = await getSupabaseAdmin()
    .from('judge_labels')
    .select('*')
    .eq('exam_id', examId)
    .eq('reviewer_email', reviewerEmail)
    .maybeSingle();
  if (!data) return null;
  return mapLabelRow(data as RawLabelRow);
}

/** 這題目前所有人標過的全部（含我自己），新到舊。用來比對多人一致率。 */
export async function getJudgeLabelsForExam(examId: string): Promise<JudgeLabel[]> {
  const { data } = await getSupabaseAdmin()
    .from('judge_labels')
    .select('*')
    .eq('exam_id', examId)
    .order('updated_at', { ascending: false });
  return ((data ?? []) as RawLabelRow[]).map(mapLabelRow);
}

/**
 * 存「我」對這題的標註。同一個人重存 = 覆寫自己那份（改判斷）；
 * 不同人存的是各自獨立的一列，不會互相覆蓋（見 (exam_id, reviewer_email) 唯一鍵）。
 */
export async function saveJudgeLabel(
  examId: string,
  reviewerEmail: string,
  input: {
    scores: Record<ScoreKey, ScoreBucket>;
    challengedCorrect: boolean | null;
    note: string | null;
  },
): Promise<JudgeLabel> {
  for (const k of SCORE_KEYS) {
    if (!isScoreBucket(input.scores[k])) {
      throw new Error(`維度 ${k} 缺少合法的標註值`);
    }
  }
  const row = {
    exam_id: examId,
    reviewer_email: reviewerEmail,
    prompt_structure: input.scores.prompt_structure,
    decomposition: input.scores.decomposition,
    efficiency: input.scores.efficiency,
    critical_thinking: input.scores.critical_thinking,
    task_completion: input.scores.task_completion,
    challenged_correct: input.challengedCorrect,
    note: input.note,
    updated_at: new Date().toISOString(),
  };
  const { error } = await getSupabaseAdmin()
    .from('judge_labels')
    .upsert(row, { onConflict: 'exam_id,reviewer_email' });
  if (error) throw new Error(`儲存標註失敗：${error.message}`);
  const saved = await getJudgeLabel(examId, reviewerEmail);
  if (!saved) throw new Error('儲存後讀不回標註');
  return saved;
}

/* ── 後台可調參數（app_settings） ───────────────────────── */

/** 一筆設定的定義：預設值 + 給後台顯示用的說明。新增可調參數只要在這裡加一筆。 */
export interface SettingDef {
  key: string;
  label: string;
  description: string;
  default: number;
  min: number;
  max: number;
}

export const KNOWN_SETTINGS: SettingDef[] = [
  {
    key: 'judge_consistency_runs',
    label: '裁判 self-consistency 次數',
    description:
      '同一份對話並行問裁判幾次、每個維度取中位數，降低單次跑分飄動。1 = 關閉。' +
      '建議維持奇數，避免 user_challenged 多數決平手。每加 1，該場評分的裁判 API 成本乘 1 倍。',
    default: JUDGE_CONSISTENCY_RUNS,
    min: 1,
    max: 7,
  },
];

export interface AppSettingRow extends SettingDef {
  /** 目前生效的值：有存過就用存的，沒存過就是 default。 */
  value: number;
  /** 有沒有被後台改過（false = 目前吃 default）。 */
  overridden: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** 後台「設定」頁列表：已知設定 + 目前實際生效的值（DB 有存就用存的，沒有就用預設）。 */
export async function getAppSettings(): Promise<AppSettingRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('app_settings')
    .select('key, value, updated_at, updated_by');
  if (error) throw new Error(`app_settings 讀取失敗：${error.message}`);
  const stored = new Map(
    (data ?? []).map((r) => [
      r.key as string,
      r as { value: unknown; updated_at: string; updated_by: string | null },
    ]),
  );
  return KNOWN_SETTINGS.map((def) => {
    const row = stored.get(def.key);
    return {
      ...def,
      value: row ? Number(row.value) : def.default,
      overridden: Boolean(row),
      updatedAt: row?.updated_at ?? null,
      updatedBy: row?.updated_by ?? null,
    };
  });
}

/** 後台寫入一筆設定；呼叫端負責用 requireAdmin() 把關。value 會 clamp 進該設定的 min/max。 */
export async function setAppSetting(
  key: string,
  value: number,
  updatedBy: string,
): Promise<AppSettingRow> {
  const def = KNOWN_SETTINGS.find((s) => s.key === key);
  if (!def) throw new Error(`未知的設定 key：${key}`);
  if (!Number.isFinite(value)) throw new Error('值必須是數字');
  const clamped = Math.min(def.max, Math.max(def.min, Math.round(value)));
  await setSetting(key, clamped, updatedBy);
  const rows = await getAppSettings();
  const saved = rows.find((r) => r.key === key);
  if (!saved) throw new Error('儲存後讀不回設定');
  return saved;
}

/** 後台「還原成預設值」：直接刪掉那一列，下次讀取就會落回 KNOWN_SETTINGS 的 default。 */
export async function resetAppSetting(key: string): Promise<AppSettingRow> {
  const def = KNOWN_SETTINGS.find((s) => s.key === key);
  if (!def) throw new Error(`未知的設定 key：${key}`);
  const { error } = await getSupabaseAdmin()
    .from('app_settings')
    .delete()
    .eq('key', key);
  if (error) throw new Error(`app_settings 刪除失敗：${error.message}`);
  const rows = await getAppSettings();
  const saved = rows.find((r) => r.key === key);
  if (!saved) throw new Error('還原後讀不回設定');
  return saved;
}
