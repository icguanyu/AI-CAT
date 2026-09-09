-- scenarios 加中文標題欄。給人看用（個人歷史列表 / log）；
-- 應用層（src/lib/scenarios.ts）載入時強制非空，DB 這裡留 nullable。
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上 → Run。
-- 跑完記得 `npm run scenarios:import` 把現有題目的 title_zh 灌進去。

alter table public.scenarios
  add column if not exists title_zh text;
