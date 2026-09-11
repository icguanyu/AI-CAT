-- judge_labels 改成「每個 (測驗, 標註人) 存一份」，而不是每個測驗只存一份。
-- 原本用 exam_id 當 PK，第二人（或同一人第二次）複查會直接覆蓋掉前一份，
-- 沒辦法拿來算「多人複查一致率」。改成 id 當 PK、(exam_id, reviewer_email) 唯一，
-- 同一人重標同一題還是覆寫自己那份（等於「改我的判斷」），不同人各自留一份。
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上 → Run。

alter table public.judge_labels drop constraint if exists judge_labels_pkey;

alter table public.judge_labels
  add column if not exists id uuid not null default gen_random_uuid();

alter table public.judge_labels add primary key (id);

alter table public.judge_labels
  add constraint judge_labels_exam_reviewer_unique unique (exam_id, reviewer_email);
