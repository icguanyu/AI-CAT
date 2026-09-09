/**
 * 檔案：src/app/api/exam/start/route.ts  →  POST /api/exam/start
 * 角色：API 層 — 開一場新測驗（登入版 or 免登入試用版）
 * 功能：辨識來者（登入 / 匿名）→ 檢查額度 → 隨機選題 → 在 Redis 建 ExamState →
 *       回 examId、brief、限制。system / injectionText / 注入輪次 不外流。
 *
 *   - 登入：checkQuota（每日 3 / 生涯 21）；次數在 /api/evaluate 成功後才 +1。
 *   - 免登入試用：每瀏覽器一輩子一次 + 每月共用池上限；沙盒用便宜模型、輪次較少；
 *     結果只放 Redis、不寫 DB，登入後由 /claim 認領。
 */
import { setExam } from '@/lib/redis';
import { checkRateLimit, rateLimitResponse, clientIp } from '@/lib/ratelimit';
import { requireAuth } from '@/lib/supabase';
import { readAnonId, mintAnon, anonSetCookie } from '@/lib/anon';
import { verifyTurnstile } from '@/lib/turnstile';
import {
  hasAnonUsed,
  markAnonUsed,
  tryConsumePublicSlot,
  releasePublicSlot,
  bumpTrialMetric,
} from '@/lib/public-pool';
import { checkQuota } from '@/lib/quota';
import { listScenarioIds, resolveScenario } from '@/lib/scenarios';
import {
  MAX_USER_TURNS,
  MAX_INPUT_CHARS,
  PUBLIC_TRIAL_MAX_TURNS,
  rollInjectAtTurn,
} from '@/config/constants';
import { errJson } from '@/lib/api-error';
import type { ExamState } from '@/types/exam';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  return handle(req).catch(errJson);
}

async function pickScenario() {
  const ids = await listScenarioIds();
  if (ids.length === 0) return null;
  const scenarioId = ids[Math.floor(Math.random() * ids.length)];
  return { scenarioId, scenario: await resolveScenario(scenarioId) };
}

function baseState(scenarioId: string, scenario: {
  category: ExamState['category'];
  variantIndex: number;
}): Omit<ExamState, 'userId'> {
  return {
    scenarioId,
    category: scenario.category,
    variantIndex: scenario.variantIndex,
    history: [],
    injectAtTurn: rollInjectAtTurn(),
    injected: false,
    injectionLanded: false,
    injectionText: '',
    createdAt: Date.now(),
  };
}

async function handle(req: Request): Promise<Response> {
  const hasBearer = /^Bearer\s+/i.test(req.headers.get('authorization') ?? '');

  // ── 登入版 ──────────────────────────────────────────────
  if (hasBearer) {
    const auth = await requireAuth(req);
    if ('error' in auth) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const rl = await checkRateLimit(req, auth.userId);
    if (!rl.ok) return rateLimitResponse(rl);

    const quota = await checkQuota(auth.userId);
    if (!quota.ok) {
      const error =
        quota.reason === 'daily'
          ? `今天的檢測次數已用完（每日上限 ${quota.dayLimit} 次），隔天會重新計算。`
          : `檢測次數已達總上限（${quota.used}/${quota.limit} 次）。`;
      return Response.json({ error, quota }, { status: 403 });
    }

    const picked = await pickScenario();
    if (!picked) {
      return Response.json(
        { error: '題庫目前沒有可用的題目，請稍後再試或聯絡管理員。' },
        { status: 503 },
      );
    }
    const examId = crypto.randomUUID();
    const state: ExamState = {
      userId: auth.userId,
      ...baseState(picked.scenarioId, picked.scenario),
    };
    await setExam(examId, state);

    return Response.json({
      examId,
      brief: picked.scenario.brief,
      limits: { maxUserTurns: MAX_USER_TURNS, maxInputChars: MAX_INPUT_CHARS },
      trial: false,
      quota: {
        used: quota.used,
        limit: quota.limit,
        dayUsed: quota.dayUsed,
        dayLimit: quota.dayLimit,
      },
    });
  }

  // ── 免登入試用版 ────────────────────────────────────────
  const rlAnon = await checkRateLimit(req); // 以 IP 為 key，粗略防連點
  if (!rlAnon.ok) return rateLimitResponse(rlAnon);

  // Turnstile：兩把 key 都設好才啟用；沒設一律放行
  const body = (await req.json().catch(() => ({}))) as {
    turnstileToken?: string;
  };
  if (!(await verifyTurnstile(body.turnstileToken, clientIp(req)))) {
    return Response.json(
      {
        code: 'TURNSTILE_FAILED',
        error: '沒通過人機驗證，請重新整理再試一次。',
      },
      { status: 403 },
    );
  }

  let anonId = readAnonId(req);
  let setCookie: string | null = null;
  if (!anonId) {
    const minted = mintAnon();
    anonId = minted.id;
    setCookie = anonSetCookie(minted.cookieValue);
  }

  if (await hasAnonUsed(anonId)) {
    return Response.json(
      {
        code: 'TRIAL_USED',
        error: '你已用過一次免費試用了。登入即可繼續使用（每日 3 場免費）。',
      },
      { status: 403, ...(setCookie ? { headers: { 'set-cookie': setCookie } } : {}) },
    );
  }

  const slot = await tryConsumePublicSlot();
  if (!slot.ok) {
    return Response.json(
      {
        code: 'PUBLIC_POOL_EXHAUSTED',
        error:
          slot.reason === 'daily'
            ? '今天的免費公開試用額度剛好被用完了，明天請早——或登入即可立刻繼續使用你自己的免費額度（每日 3 場）。'
            : '這個月的免費公開試用額度太熱門、已經被用完了。登入即可立刻繼續使用你自己的免費額度（每日 3 場）。',
      },
      { status: 403, ...(setCookie ? { headers: { 'set-cookie': setCookie } } : {}) },
    );
  }

  const picked = await pickScenario();
  if (!picked) {
    await releasePublicSlot();
    return Response.json(
      { error: '題庫目前沒有可用的題目，請稍後再試。' },
      { status: 503, ...(setCookie ? { headers: { 'set-cookie': setCookie } } : {}) },
    );
  }

  await markAnonUsed(anonId);
  void bumpTrialMetric('started');

  const examId = crypto.randomUUID();
  const state: ExamState = {
    userId: '',
    anonId,
    maxTurns: PUBLIC_TRIAL_MAX_TURNS,
    ...baseState(picked.scenarioId, picked.scenario),
  };
  await setExam(examId, state);

  const headers = new Headers({ 'content-type': 'application/json' });
  if (setCookie) headers.append('set-cookie', setCookie);
  return new Response(
    JSON.stringify({
      examId,
      brief: picked.scenario.brief,
      limits: {
        maxUserTurns: PUBLIC_TRIAL_MAX_TURNS,
        maxInputChars: MAX_INPUT_CHARS,
      },
      trial: true,
      quota: null,
    }),
    { status: 200, headers },
  );
}
