/**
 * 檔案：src/app/api/admin/review/route.ts  →  GET /api/admin/review
 * 角色：API 層 — 標註審核佇列（P3）
 * Query：onlyUnlabeled=1（預設顯示全部）、limit、offset
 */
import { requireAdmin } from '@/lib/admin';
import { getReviewQueue } from '@/lib/admin-data';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  return handle(req).catch(errJson);
}

async function handle(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const url = new URL(req.url);
  const result = await getReviewQueue({
    reviewerEmail: auth.email,
    onlyUnlabeled: url.searchParams.get('onlyUnlabeled') === '1',
    limit: Number(url.searchParams.get('limit')) || 20,
    offset: Number(url.searchParams.get('offset')) || 0,
  });
  return Response.json(result);
}
