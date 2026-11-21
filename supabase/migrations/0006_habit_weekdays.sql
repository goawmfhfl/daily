-- ───────── 활동별 요일 ─────────
-- 0=일 1=월 … 6=토 (JS Date.getDay 와 같은 번호). 기존 활동은 매일로 둔다.
alter table public.habits
  add column if not exists weekdays smallint[] not null default '{0,1,2,3,4,5,6}';

alter table public.habits
  add constraint habits_weekdays_valid
  check (cardinality(weekdays) between 1 and 7 and weekdays <@ '{0,1,2,3,4,5,6}'::smallint[]);
