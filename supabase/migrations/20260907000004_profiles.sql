-- AI-CAT 使用者基本資料表。
-- Google 登入時 Supabase 已把 email / 姓名 / 頭像塞進 auth.users.raw_user_meta_data，
-- 這張表只是把它鏡射成好查詢 / join 的形式（例如接 exam_reports 看誰測過）。
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上 → Run。

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  provider    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 本人可讀自己的 profile；寫入一律走後端 service_role（trigger 也是）。
drop policy if exists "own profile readable" on public.profiles;
create policy "own profile readable"
  on public.profiles for select
  using (auth.uid() = id);

-- 註冊時、以及之後 email / metadata 有變動時，用 Google 回傳的資料 upsert profile。
create or replace function public.sync_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, provider, updated_at)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    coalesce(new.raw_app_meta_data->>'provider', 'unknown'),
    now()
  )
  on conflict (id) do update set
    email      = excluded.email,
    full_name  = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    provider   = excluded.provider,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_sync_profile on auth.users;
create trigger on_auth_user_sync_profile
  after insert or update of raw_user_meta_data, email on auth.users
  for each row execute function public.sync_profile();

-- 補建：已登入過的既有使用者
insert into public.profiles (id, email, full_name, avatar_url, provider)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
  coalesce(u.raw_app_meta_data->>'provider', 'unknown')
from auth.users u
on conflict (id) do nothing;
