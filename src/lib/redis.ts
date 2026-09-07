/**
 * 檔案：src/lib/redis.ts
 * 角色：基礎設施層 — 測驗 session 儲存 + Redis client 單一出口
 * 功能：封裝 Upstash Redis，讀寫一場測驗的完整狀態 ExamState
 *       （key = `exam:{examId}`，TTL = EXAM_TTL_SEC）。
 *       無狀態部署（Vercel Serverless）下取代原設計的行程內記憶體物件。
 *       同時提供 getRedis() 給 ratelimit.ts 共用同一個連線。
 */
import { Redis } from '@upstash/redis';
import { EXAM_TTL_SEC } from '@/config/constants';
import type { ExamState } from '@/types/exam';

let client: Redis | null = null;

/**
 * 延遲建立 Upstash Redis client。
 * 相容兩種環境變數命名：
 *   - 手動 / Upstash 原生：UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 *   - Vercel「Upstash for Redis」整合自動帶入：KV_REST_API_URL / KV_REST_API_TOKEN
 *     （注意不是 KV_URL，那是 rediss:// 的 TCP 連線字串，非 REST 端點）
 */
export function getRedis(): Redis {
  if (client) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error(
      '缺少 Upstash Redis 連線設定：需要 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN' +
        '（或 Vercel 整合帶入的 KV_REST_API_URL / KV_REST_API_TOKEN）',
    );
  }

  client = new Redis({ url, token });
  return client;
}

const examKey = (examId: string) => `exam:${examId}`;

export async function getExam(examId: string): Promise<ExamState | null> {
  return (await getRedis().get<ExamState>(examKey(examId))) ?? null;
}

export async function setExam(examId: string, state: ExamState): Promise<void> {
  await getRedis().set(examKey(examId), state, { ex: EXAM_TTL_SEC });
}

export async function deleteExam(examId: string): Promise<void> {
  await getRedis().del(examKey(examId));
}
