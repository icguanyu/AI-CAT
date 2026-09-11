/**
 * 檔案：src/app/api/admin/exams/route.ts  →  GET /api/admin/exams
 * 角色：API 層 — 測驗查詢列表（P1：可見性）
 * 功能：依 email / examId 片段、分類、分級篩選；分頁。
 * Query：q, category, level, limit, offset
 */
import { requireAdmin } from '@/lib/admin';
import { listAdminExams } from '@/lib/admin-data';
import { isCategory, type LevelCode } from '@/types/exam';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

const LEVELS: LevelCode[] = ['L1', 'L2', 'L3', 'L4', 'L5'];
function isLevel(v: string | null): v is LevelCode {
  return !!v && (LEVELS as string[]).includes(v);
}

export async function GET(req: Request) {
  return handle(req).catch(errJson);
}

async function handle(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? undefined;
  const categoryRaw = url.searchParams.get('category');
  const levelRaw = url.searchParams.get('level');
  const limit = Number(url.searchParams.get('limit')) || 50;
  const offset = Number(url.searchParams.get('offset')) || 0;

  const result = await listAdminExams({
    q,
    category: isCategory(categoryRaw) ? categoryRaw : undefined,
    level: isLevel(levelRaw) ? levelRaw : undefined,
    limit,
    offset,
  });
  return Response.json(result);
}
