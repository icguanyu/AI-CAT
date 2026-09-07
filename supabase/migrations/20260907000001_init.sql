-- AI-CAT 初始資料表
-- 執行方式：Supabase Dashboard → SQL Editor → New query → 貼上全部 → Run。
-- （或用 supabase CLI：supabase db push）

-- ══ 評分報告 ═══════════════════════════════════════════════════════
-- /api/evaluate 於使用者提交時寫入。Redis 只放 1 小時的臨時對話 session，
-- 最終報告留在這裡長期保存。
create table if not exists public.exam_reports (
  id              uuid primary key default gen_random_uuid(),
  exam_id         text not null unique,
  user_id         uuid not null references auth.users (id) on delete cascade,
  scenario_id     text not null,
  report          jsonb not null,            -- 裁判輸出（對應 types/exam.ts 的 ReportSchema）
  rule_challenged  boolean not null default false,  -- 規則判定：是否質疑被注入的錯誤資訊
  injected        boolean not null default false,   -- 該場是否已注入幻覺陷阱
  created_at      timestamptz not null default now()
);

create index if not exists exam_reports_user_id_idx
  on public.exam_reports (user_id, created_at desc);

alter table public.exam_reports enable row level security;

-- 寫入一律走後端 service_role（繞過 RLS），不開放前端寫。
-- 只允許本人讀自己的報告（未來「我的成績」頁會用到）。
drop policy if exists "own reports are readable" on public.exam_reports;
create policy "own reports are readable"
  on public.exam_reports for select
  using (auth.uid() = user_id);

-- ══ 免費次數 ═══════════════════════════════════════════════════════
-- 每個帳號預設 2 次免費檢測；used 由後端在提交評分時 +1。
create table if not exists public.user_quota (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  used       integer not null default 0,
  free_limit integer not null default 2,
  updated_at timestamptz not null default now()
);

alter table public.user_quota enable row level security;

drop policy if exists "own quota is readable" on public.user_quota;
create policy "own quota is readable"
  on public.user_quota for select
  using (auth.uid() = user_id);

-- ══ 新使用者自動建立 quota 列 ════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_quota (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 已存在的使用者補建 quota 列（trigger 只對之後註冊的生效）
insert into public.user_quota (user_id)
select id from auth.users
on conflict (user_id) do nothing;
