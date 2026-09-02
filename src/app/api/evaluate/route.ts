/**
 * 檔案：src/app/api/evaluate/route.ts  →  POST /api/evaluate
 * 角色：API 層 — 裁判評分引擎（核心）
 * 功能：讀取該場對話歷程，先用 detectChallenge() 規則判定使用者是否識破陷阱，
 *       再以 generateObject + Zod ReportSchema 讓裁判模型產出結構化五維度評分，
 *       最後把報告寫入 Supabase exam_reports。批判思考採「規則 + 裁判」雙軌。
 */
import { generateObject } from 'ai';
import { openai } from '@/lib/openai';
import { getExam } from '@/lib/redis';
import { requireAuth, getSupabaseAdmin } from '@/lib/supabase';
import { ReportSchema, type ChatMessage } from '@/types/exam';
import { INJECT_AT_TURN, JUDGE_MODEL } from '@/config/constants';

export const runtime = 'nodejs';

/**
 * 裁判評分 API（Phase 3）
 *
 * - generateObject + Zod ReportSchema 強制結構化輸出
 * - 批判思考採「規則判定 + 裁判」雙軌
 *
 * TODO(Phase 3):
 *   - RUBRIC_SYSTEM 換成從私有設定載入的完整 rubric 與高/低分錨點
 *   - L1–L5 分級對照表（目前交給裁判判斷，之後改為後端依加權分數決定）
 *   - 扣減 user_quota、self-consistency（重複評分取中位數）
 */

/** 陷阱注入後，使用者是否對錯誤資訊表達質疑 / 要求查證。 */
function detectChallenge(
  history: ChatMessage[],
  injectAtUserTurn: number,
): boolean {
  const afterInjection = history
    .filter((m) => m.role === 'user')
    .slice(injectAtUserTurn);
  const cues = [
    '確定嗎', '來源', '出處', '查證', '不正確', '有誤', '錯',
    '法條', '依據', '真的嗎', '存疑', '求證', '引用', '根據哪',
  ];
  return afterInjection.some((m) => cues.some((c) => m.content.includes(c)));
}

const RUBRIC_SYSTEM = [
  '你是一位嚴格、客觀的企業「AI 應用與提示詞工程」測評專家。',
  '請嚴格依 rubric 對五個維度評分（0–100），不要因為受測者語氣客氣就給高分。',
  '',
  'TODO(scaffold): 完整 rubric 與高/低分錨點於 Phase 3 從私有設定注入。',
].join('\n');

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { examId } = (await req.json()) as { examId?: string };
  if (!examId) {
    return Response.json({ error: '缺少 examId' }, { status: 400 });
  }

  const state = await getExam(examId);
  if (!state) {
    return Response.json({ error: '找不到該場次的對話紀錄' }, { status: 404 });
  }
  if (state.userId !== auth.userId) {
    return Response.json({ error: '無權存取此場次' }, { status: 403 });
  }

  const challenged = state.injected
    ? detectChallenge(state.history, INJECT_AT_TURN)
    : false;

  const { object: report } = await generateObject({
    model: openai(JUDGE_MODEL),
    schema: ReportSchema,
    system: RUBRIC_SYSTEM,
    prompt: [
      '以下為受測者（user）與沙盒 AI 的完整對話歷程。',
      '',
      `【幻覺陷阱是否已注入】：${state.injected ? '是' : '否'}`,
      state.injected ? `【被注入的錯誤敘述】：${state.injectionText}` : '',
      `【規則判定：使用者是否質疑該錯誤】：${challenged ? '有' : '無'}`,
      '若為「無」，critical_thinking 一律 ≤ 40。',
      '',
      '對話歷程：',
      JSON.stringify(state.history, null, 2),
    ].join('\n'),
  });

  // Redis 僅為短期 session；正式報告寫入 Supabase 留存
  const { error } = await getSupabaseAdmin().from('exam_reports').insert({
    exam_id: examId,
    user_id: auth.userId,
    scenario_id: state.scenarioId,
    report,
    rule_challenged: challenged,
    injected: state.injected,
  });
  if (error) {
    console.error('寫入 exam_reports 失敗', error);
  }

  return Response.json({ success: true, report });
}
