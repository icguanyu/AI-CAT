-- exam_reports 加「排除訓練集」旗標。後台可把題目壞掉／裁判明顯亂打的那幾筆
-- 標記排除，日後匯出訓練資料時跳過；不影響評分、不影響使用者看到的報告。
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上 → Run。

alter table public.exam_reports
  add column if not exists excluded_from_training boolean not null default false;
