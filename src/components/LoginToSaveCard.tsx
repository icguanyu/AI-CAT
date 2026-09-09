/**
 * 檔案：src/components/LoginToSaveCard.tsx
 * 角色：前端層 — 免登入試用結果上方的「登入才會保存」引導卡
 * 功能：列出登入後拿得到的好處，按鈕觸發 Google 登入；登入前把要認領的 examId
 *       存進 sessionStorage，/auth/callback 回來後會呼叫 /api/exam/:id/claim 收好。
 */
'use client';

import { useCallback, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { GoogleIcon } from '@/components/GoogleIcon';

export const CLAIM_KEY = 'ai_cat_claim_exam';

const BENEFITS = [
  '保存測驗結果，隨時回來看',
  '「我的檢測紀錄」跨情境彙整你的綜合分級與分數趨勢',
  '每日 3 場免費額度（隔日重置）',
  '完整報告：L5 高手示範 + 逐點回饋',
  '一鍵產生公開分享連結',
];

export function LoginToSaveCard({ examId }: { examId: string }) {
  const sbRef = useRef<SupabaseClient | null>(null);
  const getSb = useCallback(() => {
    if (!sbRef.current) sbRef.current = createSupabaseBrowser();
    return sbRef.current;
  }, []);

  const login = useCallback(() => {
    try {
      sessionStorage.setItem(CLAIM_KEY, examId);
    } catch {
      /* 無痕視窗可能不給寫，認領會退回用 anon cookie 比對 */
    }
    void getSb().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          `/exam/result/${examId}`,
        )}`,
      },
    });
  }, [examId, getSb]);

  return (
    <div className="save-card panel">
      <div className="save-card-head">
        <span className="mono-label">試用結果 · 尚未保存</span>
      </div>
      <p className="save-card-lead">
        該測驗結果與分析<strong>尚未保存</strong>——現在離開就不見了。
        用 Google 登入即可保存，同時解鎖：
      </p>
      <ul className="save-card-benefits">
        {BENEFITS.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <button type="button" className="btn" onClick={login}>
        <GoogleIcon />
        Google 登入並保存這份結果
      </button>
      <p className="save-card-fine">
        登入不會弄丟剛剛的結果；我們只用 Google 帳號辨識你，不會發文或存取聯絡人。
      </p>
    </div>
  );
}
