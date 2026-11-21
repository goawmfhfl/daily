-- ───────── emotion_insights: 주간 감정 요인 분석 ─────────
-- 한 주(월요일 시작)의 기록을 AI 로 읽어 감정별로 "무엇이 그 감정을 만들었는지"를 정리해 둔다.
-- 사용자가 대시보드에서 감정을 처음 펼칠 때 만들고, 그 주 기록·태그가 바뀌면(source_sig) 다시 만들 수 있다.
create table if not exists public.emotion_insights (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  week_start    date not null,
  content_json  jsonb not null,
  model         text not null,
  entry_count   int not null default 0,
  source_sig    text not null,
  created_at    timestamptz not null default now(),
  unique (user_id, week_start)
);
alter table public.emotion_insights enable row level security;
create policy "emotion_insights: own" on public.emotion_insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
