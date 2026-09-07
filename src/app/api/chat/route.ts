/**
 * 檔案：src/app/api/chat/route.ts  →  POST /api/chat
 * 角色：API 層 — 沙盒對話控制器（核心）
 * 功能：驗證登入與流量後，把使用者訊息接進該場測驗歷程，串流沙盒模型回應，
 *       並於第 INJECT_AT_TURN 輪「決定性注入」幻覺陷阱（不經模型、暗號不入 prompt）。
 *       注入輪次也以相同的 data-stream 協定回傳，前端一律當作 assistant 訊息處理。
 *       對話狀態存 Redis；正常輪次由 onFinish 落地 assistant 回覆。
 *
 * 請求 body：{ examId: string, message: string }
 * 回應：Vercel AI SDK data stream（header x-vercel-ai-data-stream: v1），
 *       或錯誤時的 JSON + 對應 HTTP 狀態碼。
 */
import { streamText, formatDataStreamPart } from 'ai';
import { openai } from '@/lib/openai';
import { getExam, setExam } from '@/lib/redis';
import { requireAuth } from '@/lib/supabase';
import { getRatelimit, clientIp } from '@/lib/ratelimit';
import { getScenario } from '@/lib/scenarios';
import {
  MAX_INPUT_CHARS,
  MAX_USER_TURNS,
  INJECT_AT_TURN,
  SANDBOX_MODEL,
} from '@/config/constants';

export const runtime = 'nodejs';

/** 把一段固定文字包成 data stream 回應，讓前端與正常串流一致處理。 */
function textAsDataStream(text: string): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(formatDataStreamPart('text', text)));
      controller.close();
    },
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'x-vercel-ai-data-stream': 'v1',
    },
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { success } = await getRatelimit().limit(`ip:${clientIp(req)}`);
  if (!success) {
    return Response.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 });
  }

  const { examId, message } = (await req.json()) as {
    examId?: string;
    message?: string;
  };

  if (!examId) {
    return Response.json({ error: '缺少 examId' }, { status: 400 });
  }
  if (typeof message !== 'string' || message.trim().length === 0) {
    return Response.json({ error: '訊息不可為空' }, { status: 400 });
  }
  if (message.length > MAX_INPUT_CHARS) {
    return Response.json(
      { error: `輸入字數超過 ${MAX_INPUT_CHARS} 字限制` },
      { status: 400 },
    );
  }

  const state = await getExam(examId);
  if (!state) {
    return Response.json({ error: '測驗場次不存在或已過期' }, { status: 404 });
  }
  if (state.userId !== auth.userId) {
    return Response.json({ error: '無權存取此場次' }, { status: 403 });
  }

  const userTurns = state.history.filter((m) => m.role === 'user').length;
  if (userTurns >= MAX_USER_TURNS) {
    return Response.json(
      { error: `已達最高對話輪次上限（${MAX_USER_TURNS} 輪），請提交評分` },
      { status: 400 },
    );
  }

  state.history.push({ role: 'user', content: message });
  const currentTurn = userTurns + 1;
  const scenario = getScenario(state.scenarioId);

  // ── 決定性幻覺注入（不經模型）──
  if (currentTurn === INJECT_AT_TURN && !state.injected) {
    const injectedReply = [
      '以下是一版可用的草稿：',
      '',
      '（草稿內容省略）',
      '',
      `另外補充一點資訊供參考：${scenario.injectionText}`,
    ].join('\n');

    state.injected = true;
    state.injectionText = scenario.injectionText;
    state.history.push({ role: 'assistant', content: injectedReply });
    await setExam(examId, state);

    return textAsDataStream(injectedReply);
  }

  // ── 正常輪次：串流沙盒模型回應 ──
  const result = streamText({
    model: openai(SANDBOX_MODEL),
    system: scenario.system,
    messages: state.history,
    onFinish: async ({ text }) => {
      state.history.push({ role: 'assistant', content: text });
      await setExam(examId, state);
    },
  });

  return result.toDataStreamResponse();
}
