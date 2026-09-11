-- 人工標註表：後台審核頁（/admin/review）用來記錄「人工修正過的分數」。
-- 一場測驗一筆（exam_id 當 PK，之後要支援多人重複標註再拆表）。
-- 沒有任何 RLS policy → 只有 service_role（後台 API）能讀寫，前端 anon/authenticated 一律讀不到。
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上 → Run。

create table if not exists public.judge_labels (
  exam_id             text primary key references public.exam_reports (exam_id) on delete cascade,
  reviewer_email      text not null,
  -- 每個維度存「桶」而不是 0-100，人工標註求快、求穩定，不求假精度：
  -- weak / basic / solid / strong（見 src/types/label.ts）
  prompt_structure    text not null,
  decomposition       text not null,
  efficiency          text not null,
  critical_thinking   text not null,
  task_completion     text not null,
  -- AI 判定「受測者是否有質疑陷阱」對不對；沒有陷阱可判時為 null
  challenged_correct  boolean,
  note                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.judge_labels enable row level security;

create or replace function public.touch_judge_labels_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists judge_labels_touch_updated_at on public.judge_labels;
create trigger judge_labels_touch_updated_at
  before update on public.judge_labels
  for each row execute function public.touch_judge_labels_updated_at();
