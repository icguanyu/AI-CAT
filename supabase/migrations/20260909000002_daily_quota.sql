-- 檢測次數改為「每日 3 次（台北時間隔日重置）+ 生涯上限 21 次」。
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上 → Run。
-- 應用層：src/config/constants.ts（DAILY_ATTEMPTS / MAX_ATTEMPTS）、src/lib/quota.ts。

-- 1) 每日計數欄：day_used 當日已用、day_date 當日日期（台北時間）
alter table public.user_quota
  add column if not exists day_used integer not null default 0,
  add column if not exists day_date date not null
    default ((now() at time zone 'Asia/Taipei')::date);

-- 2) 生涯上限：舊預設 2 → 21（只動沒被手動改過的列）
alter table public.user_quota alter column free_limit set default 21;
update public.user_quota set free_limit = 21 where free_limit = 2;

-- 3) consume_quota：原子 +1，同時累加當日計數、跨日自動歸零
create or replace function public.consume_quota(p_user_id uuid)
returns public.user_quota
language plpgsql
security definer set search_path = public
as $$
declare
  result public.user_quota;
  today  date := (now() at time zone 'Asia/Taipei')::date;
begin
  insert into public.user_quota (user_id, used, day_used, day_date)
  values (p_user_id, 1, 1, today)
  on conflict (user_id) do update set
    used     = public.user_quota.used + 1,
    day_used = case
                 when public.user_quota.day_date = today
                 then public.user_quota.day_used + 1
                 else 1
               end,
    day_date = today,
    updated_at = now()
  returning * into result;
  return result;
end;
$$;
