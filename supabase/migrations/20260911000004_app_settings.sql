-- 通用的後台可調參數表：key/value（jsonb），給「不想改 code / 不想 redeploy」的數值設定用。
-- 第一個用途：judge_consistency_runs（裁判 self-consistency 跑幾次）。
-- 跟 scenarios 表同一個安全模式：RLS 開啟但不建 policy → anon / authenticated 一律讀不到，
-- 只有後端 service_role client（src/lib/app-settings.ts）能存取；後台寫入走 requireAdmin() 守門。

create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

alter table public.app_settings enable row level security;

create or replace function public.touch_app_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_settings_touch_updated_at on public.app_settings;
create trigger app_settings_touch_updated_at
  before update on public.app_settings
  for each row execute function public.touch_app_settings_updated_at();
