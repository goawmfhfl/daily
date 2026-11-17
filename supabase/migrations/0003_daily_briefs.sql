-- ───────── daily_briefs: "어제의 나" 아침 브리핑 ─────────
-- 오늘 이전에 기록한 가장 최근 하루(target_date)를 AI 로 요약해 둔다.
-- 같은 날은 한 번만 만들고, 그날 기록이 바뀌었을 때만(entry_count / source_updated_at 비교) 다시 만든다.
create table if not exists public.daily_briefs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  target_date        date not null,
  content_json       jsonb not null,
  model              text not null,
  entry_count        int not null default 0,
  source_updated_at  timestamptz not null,
  created_at         timestamptz not null default now(),
  unique (user_id, target_date)
);
alter table public.daily_briefs enable row level security;
create policy "daily_briefs: own" on public.daily_briefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
