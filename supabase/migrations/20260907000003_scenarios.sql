-- AI-CAT 題庫表：把 SCENARIOS_JSON 搬進資料庫，改題不用 redeploy。
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上 → Run。

-- RLS 開啟但「刻意不建任何 policy」→ anon / authenticated 一律讀不到；
-- 只有後端 service_role client（src/lib/supabase.ts）能存取。
-- system / variants（含 injectionText）這些機密照樣不外流。

create table if not exists public.scenarios (
  id          text primary key,
  brief       text not null,
  system      text not null,
  variants    jsonb not null
              check (
                jsonb_typeof(variants) = 'array'
                and jsonb_array_length(variants) >= 1
              ),
  active      boolean not null default true,
  category    text,
  note        text,
  updated_at  timestamptz not null default now()
);

alter table public.scenarios enable row level security;

-- updated_at 自動更新
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists scenarios_touch_updated_at on public.scenarios;
create trigger scenarios_touch_updated_at
  before update on public.scenarios
  for each row execute function public.touch_updated_at();

-- 從舊的 SCENARIOS_JSON 搬資料的範例（改成你的實際內容再跑）：
--   insert into public.scenarios (id, brief, system, variants, category) values
--   ('ecommerce_apology', '任務說明…', '沙盒 system…',
--    '[{"injectionText":"…","correction":"…"}]'::jsonb, '客服文案');
