/**
 * 檔案：src/lib/redis.ts
 * 角色：基礎設施層 — 測驗 session 儲存
 * 功能：封裝 Upstash Redis，讀寫一場測驗的完整狀態 ExamState
 *       （key = `exam:{examId}`，TTL = EXAM_TTL_SEC）。
 *       無狀態部署（Vercel Serverless）下取代原設計的行程內記憶體物件。
 */
import { Redis } from '@upstash/redis';
import { EXAM_TTL_SEC } from '@/config/constants';
import type { ExamState } from '@/types/exam';

let client: Redis | null = null;

/** 延遲建立 Upstash Redis client（讀取 UPSTASH_REDIS_REST_URL / _TOKEN）。 */
function redis(): Redis {
  if (!client) client = Redis.fromEnv();
  return client;
}

const examKey = (examId: string) => `exam:${examId}`;

export async function getExam(examId: string): Promise<ExamState | null> {
  return (await redis().get<ExamState>(examKey(examId))) ?? null;
}

export async function setExam(examId: string, state: ExamState): Promise<void> {
  await redis().set(examKey(examId), state, { ex: EXAM_TTL_SEC });
}

export async function deleteExam(examId: string): Promise<void> {
  await redis().del(examKey(examId));
}
