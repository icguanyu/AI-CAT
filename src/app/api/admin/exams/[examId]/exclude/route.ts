/**
 * 檔案：src/app/api/admin/exams/[examId]/exclude/route.ts
 * 角色：API 層 — 標記 / 取消「排除訓練集」（P2：輕量操作）
 * 功能：body { excluded: boolean }。只影響日後訓練資料匯出，不影響評分或使用者報告。
 */
import { requireAdmin } from '@/lib/admin';
import { setExamExcluded } from '@/lib/admin-data';
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
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const { examId } = await params;
  const body = (await req.json().catch(() => ({}))) as { excluded?: unknown };
  if (typeof body.excluded !== 'boolean') {
    return Response.json({ error: '缺少 excluded（boolean）' }, { status: 400 });
  }
  await setExamExcluded(examId, body.excluded);
  return Response.json({ ok: true });
}
