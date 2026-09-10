/**
 * 檔案：src/components/ProfilePrompt.tsx
 * 角色：前端層 — /me 上的「補充個人資料」小卡（年齡區間 / 學歷 / 性別）
 * 功能：登入後在 /me 顯示一次；可「略過」（記 localStorage，之後只剩一行提示可再展開）。
 *       三項都填或略過後收合。純選項按鈕，一次儲存，僅供彙總分析。
 *       樣式內嵌（避免和其他人正在改的 globals.css 撞），沿用 .panel / .pill-toggle / .btn。
 */
'use client';

import { useEffect, useState } from 'react';
import { getMyProfile, saveMyProfile } from '@/lib/client-api';
import {
  AGE_BANDS,
  AGE_BAND_LABEL,
  EDUCATIONS,
  EDUCATION_LABEL,
  GENDERS,
  GENDER_LABEL,
  isProfileComplete,
  type ProfileExtras,
} from '@/types/profile';

const DISMISS_KEY = 'ai_cat_profile_dismissed';

/** 內嵌樣式；只針對本元件的 .pp-* 類，其餘沿用全域 .panel / .pill-toggle / .btn。 */
function PPStyle() {
  return (
    <style>{`
      .pp-thin{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--fg-faint);padding:8px 2px}
      .pp-card{display:flex;flex-direction:column;gap:14px}
      .pp-head{display:flex;flex-direction:column;gap:4px}
      .pp-head .section-sub{font-size:12px;line-height:1.6}
      .pp-row{display:flex;flex-direction:column;gap:6px}
      .pp-label{font-family:var(--font-mono);font-size:11px;letter-spacing:.1em;color:var(--fg-faint)}
      .pp-row .pill-toggle{flex-wrap:wrap}
      .pp-actions{display:flex;align-items:center;gap:14px;margin-top:2px}
      .pp-actions .btn{margin-top:0}
    `}</style>
  );
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}
function writeDismissed(v: boolean) {
  try {
    if (v) localStorage.setItem(DISMISS_KEY, '1');
    else localStorage.removeItem(DISMISS_KEY);
  } catch {
    /* 無痕視窗可能不給寫，略過即可 */
  }
}

export function ProfilePrompt() {
  const [extras, setExtras] = useState<ProfileExtras | null>(null);
  const [form, setForm] = useState<ProfileExtras>({
    ageBand: null,
    education: null,
    gender: null,
  });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getMyProfile()
      .then((p) => {
        if (!alive) return;
        setExtras(p);
        setForm(p);
        setOpen(!isProfileComplete(p) && !readDismissed());
      })
      .catch(() => {
        /* 讀不到就不顯示 */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!extras) return null;
  const complete = isProfileComplete(extras);

  if (!open) {
    return (
      <div className="pp-thin">
        <PPStyle />
        <span>
          {complete
            ? '個人資料：已填寫'
            : '想幫我們做彙總分析？補充年齡 / 學歷 / 性別（可跳過）'}
        </span>
        <button type="button" className="linkbtn" onClick={() => setOpen(true)}>
          {complete ? '修改' : '填一下'}
        </button>
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveMyProfile(form);
      setExtras(saved);
      setForm(saved);
      writeDismissed(false);
      setOpen(false);
    } catch {
      /* 失敗就維持展開，讓使用者重試 */
    } finally {
      setSaving(false);
    }
  };

  const skip = () => {
    if (!complete) writeDismissed(true);
    setOpen(false);
  };

  return (
    <div className="pp-card panel">
      <PPStyle />
      <div className="pp-head">
        <strong>補充個人資料</strong>
        <span className="section-sub">自願填寫，僅用於整體數據分析，不會顯示在你的報告或分享卡上。</span>
      </div>

      <div className="pp-row">
        <span className="pp-label">年齡</span>
        <div className="pill-toggle" role="group" aria-label="年齡區間">
          {AGE_BANDS.map((v) => (
            <button
              key={v}
              type="button"
              data-on={form.ageBand === v}
              onClick={() => setForm((f) => ({ ...f, ageBand: v }))}
            >
              {AGE_BAND_LABEL[v]}
            </button>
          ))}
        </div>
      </div>

      <div className="pp-row">
        <span className="pp-label">學歷</span>
        <div className="pill-toggle" role="group" aria-label="學歷">
          {EDUCATIONS.map((v) => (
            <button
              key={v}
              type="button"
              data-on={form.education === v}
              onClick={() => setForm((f) => ({ ...f, education: v }))}
            >
              {EDUCATION_LABEL[v]}
            </button>
          ))}
        </div>
      </div>

      <div className="pp-row">
        <span className="pp-label">性別</span>
        <div className="pill-toggle" role="group" aria-label="性別">
          {GENDERS.map((v) => (
            <button
              key={v}
              type="button"
              data-on={form.gender === v}
              onClick={() => setForm((f) => ({ ...f, gender: v }))}
            >
              {GENDER_LABEL[v]}
            </button>
          ))}
        </div>
      </div>

      <div className="pp-actions">
        <button
          type="button"
          className="btn"
          onClick={save}
          disabled={
            saving ||
            (form.ageBand == null &&
              form.education == null &&
              form.gender == null)
          }
        >
          {saving ? '儲存中…' : '儲存'}
        </button>
        <button type="button" className="linkbtn" onClick={skip}>
          {complete ? '收起' : '略過'}
        </button>
      </div>
    </div>
  );
}
