/**
 * 檔案：src/app/api/exam/[examId]/share/route.ts
 * 角色：API 層 — 切換測驗結果的「可分享」旗標（本人限定）
 * 功能：POST → shared=true（產生 /s/:examId 可公開的卡片）；DELETE → shared=false（收回）。
 *       公開卡片只含非機密欄位，見 src/lib/exam-reports.ts getSharedCard()。
 */
import { requireAuth } from '@/lib/supabase';
import { setShared } from '@/lib/exam-reports';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ examId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  return toggle(req, ctx, true).catch(errJson);
}
export async function DELETE(req: Request, ctx: Ctx) {
  return toggle(req, ctx, false).catch(errJson);
}

async function toggle(
  req: Request,
  { params }: Ctx,
  shared: boolean,
): Promise<Response> {
  const auth = await requireAuth(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const { examId } = await params;
  const res = await setShared(examId, auth.userId, shared);
  if (!res.ok) {
    return Response.json(
      { error: res.status === 403 ? '無權變更此報告' : '找不到報告' },
      { status: res.status },
    );
  }
  return Response.json({ shared, url: `/s/${examId}` });
}
