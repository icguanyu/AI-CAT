/**
 * 檔案：src/app/api/evaluate/route.ts  →  POST /api/evaluate
 * 角色：API 層 — 裁判評分引擎（核心）
 * 功能：
 *   1. 擋太短的提交（未到注入輪次無法評估批判思考）
 *   2. detectChallenge() 規則判定使用者是否質疑被注入的錯誤資訊
 *   3. generateObject + JudgeSchema：裁判只輸出五維度分數與總評
 *      （rubric 明確要求「複製任務說明不算能力」「沒有實際成品 task_completion ≤ 20」）
 *   4. computeLevel()：分級由後端依加權分數 + 規則上限決定，不交給裁判
 *   5. 寫入 Supabase、扣次數、清 Redis session
 */
import { generateObject } from 'ai';
import { openai } from '@/lib/openai';
import { getExam, deleteExam } from '@/lib/redis';
import { requireAuth, getSupabaseAdmin } from '@/lib/supabase';
import { consumeQuota } from '@/lib/quota';
import { getScenario } from '@/lib/scenarios';
import { computeLevel } from '@/lib/scoring';
import { JudgeSchema, type ChatMessage, type Report } from '@/types/exam';
import { INJECT_AT_TURN, JUDGE_MODEL } from '@/config/constants';
import { errJson } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  return handle(req).catch(errJson);
}

/** 陷阱注入後，使用者是否對錯誤資訊表達質疑 / 要求查證。 */
function detectChallenge(
  history: ChatMessage[],
  injectAtUserTurn: number,
): boolean {
  const afterInjection = history
    .filter((m) => m.role === 'user')
    .slice(injectAtUserTurn);
  const cues = [
    '確定嗎', '確定', '來源', '出處', '查證', '不正確', '有誤', '錯',
    '法條', '依據', '真的嗎', '存疑', '求證', '引用', '根據哪', '正確嗎',
    '對嗎', '是否正確', '查一下', '再確認',
  ];
  return afterInjection.some((m) => cues.some((c) => m.content.includes(c)));
}

function rubricSystem(): string {
  return [
    '你是嚴格、客觀的企業「AI 應用與提示詞工程」測評專家。針對五個維度各給 0–100 分。',
    '不要因為語氣客氣、字數多、或「看起來應該可行」就給高分。只根據對話裡實際發生的事評分。',
    '',
    '== 核心原則 ==',
    '1. 受測者看得到「任務說明」（下方會附上）。如果他的提示詞主要是把任務說明整段複製或輕微改寫，',
    '   那不算提示能力：prompt_structure 與 decomposition 一律 ≤ 30。分數只來自他「額外」提供的',
    '   角色設定、背景脈絡、分步引導、明確格式/長度要求。',
    '2. task_completion 只看對話中「實際產出的成品」。若助手訊息裡沒有一份完整、逐條符合限制條件的',
    '   成品，task_completion ≤ 20。禁止用「應該可以完成」來給分。',
    '3. efficiency = 最終成品品質 ÷ 有效輪次。一次把需求全部丟出、過程完全沒有追問或修正，',
    '   即使結果堪用，efficiency ≤ 55。空轉、重複、離題再往下扣。',
    '',
    '== Rubric（0–100）==',
    'prompt_structure：在任務說明之外，另有明確角色 + 完整脈絡 + 清楚輸出格式/長度限制 → 90+；',
    '  只補其中一項 → 約 50；只是複製任務說明或一句籠統要求 → ≤ 30。',
    'decomposition：主動把任務拆成可驗證的小步驟並逐步確認 → ≥ 80；一次丟出全部且無任何追問 → ≤ 40。',
    'efficiency：見上。',
    'critical_thinking：見下方「注入結果」欄位，依指示給分。',
    'task_completion：見上；相對於任務說明的每一項限制條件，缺一項 −20。',
    '',
    '== 錨點 ==',
    '低分 prompt_structure（≈15）：使用者訊息幾乎就是任務說明原文。',
    '高分 prompt_structure（≈90）：使用者另外指定「你是資深客服主管、語氣同理不卸責、200 字內、',
    '  三段式結構、結尾附補償方案」等任務說明沒寫的細節。',
    '',
    'overall_summary：一到兩句，明確點出最該改進的那一點（不要只講優點）。',
  ].join('\n');
}

async function handle(req: Request): Promise<Response> {
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

  const userTurns = state.history.filter((m) => m.role === 'user').length;
  if (userTurns < INJECT_AT_TURN) {
    return Response.json(
      {
        error: `對話太短，無法評估。請至少完成 ${INJECT_AT_TURN} 輪對話再提交（目前 ${userTurns} 輪）。`,
      },
      { status: 400 },
    );
  }

  const scenario = getScenario(state.scenarioId);
  const challenged = state.injected
    ? detectChallenge(state.history, INJECT_AT_TURN)
    : false;
  // 陷阱有嘗試注入、而且錯誤敘述確實出現在 AI 回覆裡，才算「有效」
  const trapEffective = state.injected && state.injectionLanded;

  const criticalThinkingRule = !state.injected
    ? '本場尚未觸發批判測試：critical_thinking 給 50，並在總評註明「未觸發批判測試」。'
    : !trapEffective
      ? '陷阱已嘗試注入，但錯誤敘述沒有清楚出現在 AI 回覆裡：critical_thinking 給 50，總評註明「批判測試未生效」。'
      : challenged
        ? '陷阱已生效，且系統判定使用者有質疑/要求查證：依糾正的清楚與正確程度給 60–100。'
        : '陷阱已生效，但使用者未質疑也未糾正：critical_thinking ≤ 40。';

  const { object: judged } = await generateObject({
    model: openai(JUDGE_MODEL),
    schema: JudgeSchema,
    system: rubricSystem(),
    prompt: [
      '【任務說明（受測者看得到的原文）】',
      scenario.brief,
      '',
      `【注入結果】已嘗試注入：${state.injected ? '是' : '否'}；錯誤敘述實際出現在 AI 回覆：${trapEffective ? '是' : '否'}`,
      trapEffective ? `被注入的錯誤敘述：「${state.injectionText}」` : '',
      `【規則判定】注入後使用者是否質疑/要求查證：${challenged ? '有' : '無'}`,
      `→ critical_thinking 給分規則：${criticalThinkingRule}`,
      '',
      '【對話歷程】',
      JSON.stringify(state.history, null, 2),
    ]
      .filter(Boolean)
      .join('\n'),
  });

  const { level, average } = computeLevel(judged.scores, {
    trapEffective,
    challenged,
  });

  const report: Report = {
    scores: judged.scores,
    overall_summary: judged.overall_summary,
    suggested_level: level,
  };

  // Redis 僅為短期 session；正式報告寫入 Supabase 留存
  const { error } = await getSupabaseAdmin().from('exam_reports').insert({
    exam_id: examId,
    user_id: auth.userId,
    scenario_id: state.scenarioId,
    report: { ...report, weighted_average: average },
    rule_challenged: challenged,
    injected: state.injected,
  });
  if (error) {
    // exam_id 有 unique 限制：重複提交同一場不再重複扣次數
    console.error('寫入 exam_reports 失敗（可能為重複提交）', error);
    return Response.json({ success: true, report, duplicate: true });
  }

  // 提交成功才扣一次免費次數；扣點失敗不影響已產生的報告
  try {
    await consumeQuota(auth.userId);
  } catch (e) {
    console.error('扣減 user_quota 失敗', e);
  }

  // 這場已結束，清掉 Redis session
  await deleteExam(examId).catch(() => {});

  return Response.json({ success: true, report });
}
