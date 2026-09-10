-- exam_reports 加「對話逐字稿」欄。
-- 之前逐字稿只活在 Redis（1h TTL），評分完就刪；為了日後分析與裁判模型的評測 / 微調，
-- 提交時把它抄一份留在這裡。nullable：舊列與寫入失敗都不受影響。
-- 逐字稿含使用者輸入內容，屬個人資料，保存期限與刪除權利同評分報告（見 /privacy）。
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上 → Run。

alter table public.exam_reports
  add column if not exists transcript jsonb;
