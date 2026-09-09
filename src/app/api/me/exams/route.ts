/**
 * 檔案：src/app/api/me/exams/route.ts  →  GET /api/me/exams
 * 角色：API 層 — 本人的檢測歷史列表（精簡欄位）
 * 功能：驗證 Bearer → 回該使用者所有已提交測驗，新到舊。點進單筆才拿完整報告。
 */
import { requireAuth } from '@/lib/supabase';
import { listOwnerExams } from '@/lib/exam-reports';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  return handle(req).catch(errJson);
}

async function handle(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const exams = await listOwnerExams(auth.userId);
  return Response.json({ exams });
}
