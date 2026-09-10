-- profiles 加：Google 免費就給的欄（given_name / family_name / locale），
-- 以及使用者自願自填的分群欄（age_band 年齡區間 / education 學歷 / gender 性別）。
-- 註：Google 標準登入不提供生日 / 年齡 / 性別，故 age_band / gender 一律靠使用者自填。
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上 → Run。

alter table public.profiles
  add column if not exists given_name        text,
  add column if not exists family_name       text,
  add column if not exists locale            text,
  add column if not exists age_band          text,
  add column if not exists education         text,
  add column if not exists gender            text,
  add column if not exists extras_updated_at timestamptz;

-- sync_profile：登入 / metadata 更新時，多鏡射 given_name / family_name / locale。
-- 刻意不碰 age_band / education / gender / extras_updated_at —— 那是使用者自填的，trigger 不得覆寫。
create or replace function public.sync_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, full_name, given_name, family_name, avatar_url, provider, locale, updated_at
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'given_name',
    new.raw_user_meta_data->>'family_name',
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    coalesce(new.raw_app_meta_data->>'provider', 'unknown'),
    new.raw_user_meta_data->>'locale',
    now()
  )
  on conflict (id) do update set
    email       = excluded.email,
    full_name   = coalesce(excluded.full_name, public.profiles.full_name),
    given_name  = coalesce(excluded.given_name, public.profiles.given_name),
    family_name = coalesce(excluded.family_name, public.profiles.family_name),
    avatar_url  = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    provider    = excluded.provider,
    locale      = coalesce(excluded.locale, public.profiles.locale),
    updated_at  = now();
  return new;
end;
$$;

-- 補跑一次，把現有使用者的 given_name / family_name / locale 灌進去
update public.profiles p
set
  given_name  = coalesce(p.given_name,  u.raw_user_meta_data->>'given_name'),
  family_name = coalesce(p.family_name, u.raw_user_meta_data->>'family_name'),
  locale      = coalesce(p.locale,      u.raw_user_meta_data->>'locale')
from auth.users u
where u.id = p.id;
