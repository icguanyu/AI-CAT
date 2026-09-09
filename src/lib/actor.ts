/**
 * 檔案：src/lib/actor.ts
 * 角色：基礎設施層 — 把「這個請求是誰」統一成 Actor
 * 功能：resolveActor(req) —— 有 Bearer 就走 requireAuth（登入者）；
 *       沒有 Bearer 就看簽章 anon cookie（免登入試用者）；都沒有則錯誤。
 *       ownsExam(state, actor) —— 場次歸屬檢查（登入看 userId、試用看 anonId）。
 */
import { requireAuth } from '@/lib/supabase';
import { readAnonId } from '@/lib/anon';
import type { ExamState } from '@/types/exam';

export type Actor =
  | { kind: 'user'; userId: string; name: string | null }
  | { kind: 'anon'; anonId: string }
  | { error: string; status: number };

function hasBearer(req: Request): boolean {
  return /^Bearer\s+/i.test(req.headers.get('authorization') ?? '');
}

/**
 * 有 Authorization header → 一律當登入請求驗（驗不過就回它的錯，不會退到 anon，
 * 避免「帶了壞 token 卻被當訪客」的混淆）。沒有 header → 試 anon cookie。
 */
export async function resolveActor(req: Request): Promise<Actor> {
  if (hasBearer(req)) {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth;
    return { kind: 'user', userId: auth.userId, name: auth.name };
  }
  const anonId = readAnonId(req);
  if (anonId) return { kind: 'anon', anonId };
  return { error: '需要登入或有效的試用工作階段', status: 401 };
}

/** 場次歸屬：登入場比對 userId、試用場比對 anonId。 */
export function ownsExam(state: ExamState, actor: Actor): boolean {
  if ('error' in actor) return false;
  if (actor.kind === 'user') {
    return !state.anonId && state.userId === actor.userId;
  }
  return state.anonId === actor.anonId;
}
