-- ───────── factor_insights: 최근 30일 스트레스·평온 상위 요인 ─────────
-- 기록마다 AI 가 붙이는 "스트레스 원인" 태그는 표현이 매번 달라(마감 압박 / 업무 마감 스트레스 …)
-- 단순 집계로는 모두 1회가 된다. 그래서 최근 30일 기록 전체를 AI 로 읽어 비슷한 것끼리 묶고,
-- 스트레스를 준 것과 평온하게 해준 것을 함께 뽑아 사용자당 한 행으로 둔다.
-- 대시보드를 열 때 그 사이 기록·태그가 바뀌었으면(source_sig) 자동으로 다시 만든다.
create table if not exists public.factor_insights (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  window_from   date not null,
  window_to     date not null,
  content_json  jsonb not null,
  model         text not null,
  entry_count   int not null default 0,
  source_sig    text not null,
  created_at    timestamptz not null default now(),
  unique (user_id)
);
alter table public.factor_insights enable row level security;
create policy "factor_insights: own" on public.factor_insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
