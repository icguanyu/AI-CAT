-- 原子遞增免費次數。/api/evaluate 於提交評分成功後呼叫（Phase 3）。
-- 用 upsert + returning 保證併發安全，不做讀-改-寫。
create or replace function public.consume_quota(p_user_id uuid)
returns public.user_quota
language plpgsql
security definer set search_path = public
as $$
declare
  result public.user_quota;
begin
  insert into public.user_quota (user_id, used)
  values (p_user_id, 1)
  on conflict (user_id)
  do update set used = public.user_quota.used + 1, updated_at = now()
  returning * into result;
  return result;
end;
$$;
