/**
 * 檔案：src/app/api/exam/[examId]/claim/route.ts  →  POST /api/exam/:examId/claim
 * 角色：API 層 — 登入後把「剛剛的免登入試用結果」收進自己的帳號
 * 功能：驗 Bearer（必須已登入）+ 簽章 anon cookie（證明這份試用是這個瀏覽器做的）→
 *       從 Redis 讀出試用結果快照 → 寫成正式 exam_reports 列（origin=public_trial）→
 *       清掉 Redis 快照。不扣使用者的每日/生涯次數（這是見面禮），但會進歷史紀錄。
 *       冪等：重複呼叫（已認領過）回 duplicate:true。
 */
import { requireAuth, getSupabaseAdmin } from '@/lib/supabase';
import { readAnonId } from '@/lib/anon';
import {
  getAnonReport,
  deleteAnonReport,
  bumpTrialMetric,
} from '@/lib/public-pool';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ examId: string }> },
) {
  return handle(req, ctx).catch(errJson);
}

async function handle(
  req: Request,
  { params }: { params: Promise<{ examId: string }> },
): Promise<Response> {
  const auth = await requireAuth(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const { examId } = await params;

  const blob = await getAnonReport(examId);
  if (!blob) {
    return Response.json(
      { error: '找不到可認領的試用結果（可能已逾時或已認領）。' },
      { status: 404 },
    );
  }

  const anonId = readAnonId(req);
  if (!anonId || anonId !== blob.anonId) {
    return Response.json(
      { error: '無法確認這份試用結果屬於你（換了瀏覽器或清了 Cookie）。' },
      { status: 403 },
    );
  }

  const { error } = await getSupabaseAdmin().from('exam_reports').insert({
    exam_id: examId,
    user_id: auth.userId,
    scenario_id: blob.scenarioId,
    // 認領時把試用場的對話逐字稿一起帶進正式紀錄。
    transcript: blob.history ?? null,
    report: {
      ...blob.report,
      weighted_average: blob.weightedAverage,
      variant_index: blob.variantIndex,
      exemplar: '',
      user_name: auth.name,
      category: blob.category,
      titleZh: blob.titleZh,
      familiarity: blob.familiarity,
      trap: blob.trap,
      noTrap: blob.noTrap ?? false,
      // 來源標記：免登入試用認領而來（不佔配額）。
      origin: 'public_trial',
    },
    rule_challenged: blob.ruleChallenged,
    injected: blob.injected,
  });

  if (error) {
    // exam_id unique：已認領過 → 當成功處理
    console.error('認領試用結果寫入失敗（可能為重複認領）', error);
    await deleteAnonReport(examId);
    return Response.json({ examId, duplicate: true });
  }

  await deleteAnonReport(examId);
  void bumpTrialMetric('claimed');
  return Response.json({ examId });
}
