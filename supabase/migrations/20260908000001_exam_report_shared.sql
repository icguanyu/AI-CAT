-- 測驗結果「可分享」旗標：預設 false，使用者在結果頁按「建立分享連結」才設為 true。
-- 公開路由 /s/:examId 只有在 shared = true 時才回傳「非機密」的卡片欄位
-- （分級 / 五維分數 / 一句總評 / 品牌）；陷阱內容、L5 示範、逐點回饋一律不外流。
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上 → Run。

alter table public.exam_reports
  add column if not exists shared boolean not null default false;

-- 公開卡片查詢會用到；只掃已分享的列
create index if not exists exam_reports_shared_idx
  on public.exam_reports (exam_id)
  where shared;
