/**
 * 檔案：src/app/api/admin/settings/route.ts
 * 角色：API 層 — 後台可調參數（GET 列出 / POST 更新一筆）
 * 功能：GET 回所有已知設定（含目前生效值、是否被覆寫過）；
 *       POST body { key, value }，寫入 app_settings、clamp 進該設定的 min/max。
 *       目前只有 judge_consistency_runs 一筆，新增設定改 admin-data.ts 的 KNOWN_SETTINGS 即可，
 *       這支路由不用改。
 */
import { requireAdmin } from '@/lib/admin';
import { getAppSettings, setAppSetting } from '@/lib/admin-data';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  return handleGet(req).catch(errJson);
}

export async function POST(req: Request) {
  return handlePost(req).catch(errJson);
}

async function handleGet(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  return Response.json(await getAppSettings());
}

async function handlePost(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const body = (await req.json().catch(() => ({}))) as {
    key?: unknown;
    value?: unknown;
  };
  if (typeof body.key !== 'string' || typeof body.value !== 'number') {
    return Response.json(
      { error: '缺少 key（string）或 value（number）' },
      { status: 400 },
    );
  }
  try {
    const saved = await setAppSetting(body.key, body.value, auth.email);
    return Response.json(saved);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
