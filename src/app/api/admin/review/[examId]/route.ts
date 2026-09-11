/**
 * 檔案：src/app/api/admin/review/[examId]/route.ts
 * 角色：API 層 — 單場的審核資料（P3，支援多人各自複查）
 * 功能：GET 回 { exam, myLabel, otherLabels }——myLabel 是目前這個管理員自己標過的
 *       那份（沒有就 null），otherLabels 是其他人標過的（用來比對一致率）；
 *       POST 存「我」這份標註（body: scores 五維桶值 + challengedCorrect + note），
 *       不會動到別人已經存的。
 */
import { requireAdmin } from '@/lib/admin';
import {
  getAdminExamDetail,
  getJudgeLabel,
  getJudgeLabelsForExam,
  saveJudgeLabel,
} from '@/lib/admin-data';
import { SCORE_KEYS, isScoreBucket, type ScoreBucket, type ScoreKey } from '@/types/label';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ examId: string }> },
) {
  return handleGet(req, ctx).catch(errJson);
}
export async function POST(
  req: Request,
  ctx: { params: Promise<{ examId: string }> },
) {
  return handlePost(req, ctx).catch(errJson);
}

async function handleGet(
  req: Request,
  { params }: { params: Promise<{ examId: string }> },
): Promise<Response> {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const { examId } = await params;
  const [exam, myLabel, allLabels] = await Promise.all([
    getAdminExamDetail(examId),
    getJudgeLabel(examId, auth.email),
    getJudgeLabelsForExam(examId),
  ]);
  if (!exam) return Response.json({ error: '找不到這場測驗' }, { status: 404 });
  const otherLabels = allLabels.filter((l) => l.reviewerEmail !== auth.email);
  return Response.json({ exam, myLabel, otherLabels });
}

async function handlePost(
  req: Request,
  { params }: { params: Promise<{ examId: string }> },
): Promise<Response> {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const { examId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    scores?: Partial<Record<ScoreKey, unknown>>;
    challengedCorrect?: unknown;
    note?: unknown;
  };

  const scores = {} as Record<ScoreKey, ScoreBucket>;
  for (const k of SCORE_KEYS) {
    const v = body.scores?.[k];
    if (!isScoreBucket(v)) {
      return Response.json(
        { error: `維度「${k}」缺少合法的標註值（weak/basic/solid/strong）` },
        { status: 400 },
      );
    }
    scores[k] = v;
  }

  const label = await saveJudgeLabel(examId, auth.email, {
    scores,
    challengedCorrect:
      typeof body.challengedCorrect === 'boolean' ? body.challengedCorrect : null,
    note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
  });
  return Response.json(label);
}
