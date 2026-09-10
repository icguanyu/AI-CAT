/**
 * 檔案：src/lib/exam-reports.ts
 * 角色：領域層 — 已提交測驗報告的讀取 / 分享旗標
 * 功能：
 *   getOwnerReport()  本人（登入）取回完整報告：分數 + 總評 + 回饋 + 陷阱對照 + L5 示範。
 *   getSharedCard()   公開卡片：只有 shared=true 才回，且「僅非機密欄位」
 *                     （分級 / 五維分數 / 一句總評）。陷阱內容、示範、逐點回饋一律不外流。
 *   setShared()       本人切換「可分享」旗標。
 * 全部走 service_role client（繞過 RLS），呼叫端負責驗證身分。
 */
import { getSupabaseAdmin } from '@/lib/supabase';
import { weightedAverage } from '@/lib/scoring';
import type {
  Report,
  TrapReveal,
  Familiarity,
  Category,
  ChatMessage,
  ExamListItem,
  TrapType,
  VerifyDifficulty,
} from '@/types/exam';

export type { ExamListItem };

/** exam_reports.report jsonb 實際存的形狀（ReportSchema + 後端附加欄位）。 */
interface StoredReport extends Report {
  weighted_average?: number;
  variant_index?: number;
  exemplar?: string;
  trap?: TrapReveal | null;
  /** 受測者顯示名稱快照（提交當下的 Google full_name）。 */
  user_name?: string | null;
  /** 開場自評的領域熟悉度；舊報告可能沒有。 */
  familiarity?: Familiarity;
  /** 情境的領域分類快照；舊報告可能沒有。 */
  category?: Category;
  /** 情境的中文標題快照；舊報告可能沒有。 */
  titleZh?: string;
  /** 這題本身就沒有陷阱（no-trap 題）；用來和「有陷阱但沒觸發」區分。舊報告可能沒有。 */
  noTrap?: boolean;
  /** 抽中變體的陷阱型別 / 察覺難度 / 擲中的注入輪次；給後續裁判校準 / 分層分析。舊報告可能沒有。 */
  trapType?: TrapType | null;
  verifyDifficulty?: VerifyDifficulty | null;
  injectAtTurn?: number | null;
  /** 僅本地開發寫入；型別留寬鬆，前端 client-api 有精確型別。 */
  debug?: unknown;
}

export interface OwnerReport {
  report: Report;
  name: string | null;
  familiarity: Familiarity | null;
  trap: TrapReveal | null;
  exemplar: string;
  debug: unknown | null;
  shared: boolean;
  /** 完整對話逐字稿；舊報告（此欄上線前）為 null。 */
  transcript: ChatMessage[] | null;
}

type Fail = { ok: false; status: 403 | 404 };

function pickReport(r: StoredReport): Report {
  return {
    scores: r.scores,
    overall_summary: r.overall_summary,
    user_challenged: r.user_challenged,
    did_well: r.did_well ?? [],
    to_improve: r.to_improve ?? [],
    suggested_level: r.suggested_level,
  };
}

export async function getOwnerReport(
  examId: string,
  userId: string,
): Promise<{ ok: true; data: OwnerReport } | Fail> {
  const { data, error } = await getSupabaseAdmin()
    .from('exam_reports')
    .select('user_id, report, shared, transcript')
    .eq('exam_id', examId)
    .maybeSingle();
  if (error || !data) return { ok: false, status: 404 };
  if (data.user_id !== userId) return { ok: false, status: 403 };
  const r = data.report as StoredReport;
  return {
    ok: true,
    data: {
      report: pickReport(r),
      name: r.user_name ?? null,
      familiarity: r.familiarity ?? null,
      trap: r.trap ?? null,
      exemplar: r.exemplar ?? '',
      debug: r.debug ?? null,
      shared: Boolean(data.shared),
      transcript: (data.transcript as ChatMessage[] | null) ?? null,
    },
  };
}

export interface SharedCard {
  suggested_level: Report['suggested_level'];
  scores: Report['scores'];
  overall_summary: string;
  name: string | null;
}

export async function getSharedCard(examId: string): Promise<SharedCard | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('exam_reports')
    .select('report, shared')
    .eq('exam_id', examId)
    .maybeSingle();
  if (error || !data || !data.shared) return null;
  const r = data.report as StoredReport;
  return {
    suggested_level: r.suggested_level,
    scores: r.scores,
    overall_summary: r.overall_summary,
    name: r.user_name ?? null,
  };
}

/** 本人所有已提交測驗，新到舊。 */
export async function listOwnerExams(
  userId: string,
): Promise<ExamListItem[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('exam_reports')
    .select('exam_id, created_at, shared, report')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return data.map((row) => {
    const r = row.report as StoredReport;
    return {
      examId: row.exam_id as string,
      createdAt: row.created_at as string,
      titleZh: r.titleZh ?? null,
      category: r.category ?? null,
      suggestedLevel: r.suggested_level,
      weightedAverage: r.weighted_average ?? weightedAverage(r.scores),
      scores: r.scores,
      familiarity: r.familiarity ?? null,
      challenged: Boolean(r.user_challenged),
      shared: Boolean(row.shared),
    };
  });
}

export async function setShared(
  examId: string,
  userId: string,
  shared: boolean,
): Promise<{ ok: true } | Fail> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('exam_reports')
    .select('user_id')
    .eq('exam_id', examId)
    .maybeSingle();
  if (error || !data) return { ok: false, status: 404 };
  if (data.user_id !== userId) return { ok: false, status: 403 };
  const { error: upErr } = await admin
    .from('exam_reports')
    .update({ shared })
    .eq('exam_id', examId);
  if (upErr) return { ok: false, status: 404 };
  return { ok: true };
}
