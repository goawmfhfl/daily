-- ============================================================
-- Daily: 자기이해 기록 앱 스키마
-- Supabase SQL Editor 에 그대로 붙여 넣어 실행하거나
-- `supabase db push` 로 적용합니다.
-- 모든 표에 user_id 가 있고, 행 단위 보안(RLS)으로 본인 행만 접근합니다.
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists vector;

-- ───────── 공통 트리거: updated_at ─────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ───────── profiles ─────────
create table if not exists public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: own" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- 가입 시 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────── entries: 기록 원문 ─────────
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  entry_date  date not null default ((now() at time zone 'Asia/Seoul')::date),
  mode        text not null check (mode in ('free','dialogue')),
  content     text not null,
  ai_reply    text,
  ai_mode     text check (ai_mode in ('comfort','organize','analyze','coach')),
  risk_flag   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists entries_user_date_idx on public.entries (user_id, entry_date desc, created_at desc);
alter table public.entries enable row level security;
create policy "entries: own" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger entries_updated_at before update on public.entries
  for each row execute function public.set_updated_at();

-- ───────── entry_tags: 기록별 태그 (AI/사용자 구분) ─────────
create table if not exists public.entry_tags (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.entries(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in (
                'emotion','intensity','event','stressor','energy','stress_level',
                'self_view_positive','self_view_negative')),
  value       text not null,
  source      text not null check (source in ('user','ai')),
  created_at  timestamptz not null default now()
);
create index if not exists entry_tags_entry_idx on public.entry_tags (entry_id);
create index if not exists entry_tags_user_kind_idx on public.entry_tags (user_id, kind, value);
alter table public.entry_tags enable row level security;
create policy "entry_tags: own" on public.entry_tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ───────── habits: 지속하고 싶은 활동 ─────────
create table if not exists public.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  started_at  date not null default ((now() at time zone 'Asia/Seoul')::date),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.habits enable row level security;
create policy "habits: own" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ───────── habit_checks: 날짜별 지속 여부 ─────────
create table if not exists public.habit_checks (
  id          uuid primary key default gen_random_uuid(),
  habit_id    uuid not null references public.habits(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  entry_date  date not null,
  done        boolean not null default true,
  unique (habit_id, entry_date)
);
create index if not exists habit_checks_user_date_idx on public.habit_checks (user_id, entry_date desc);
alter table public.habit_checks enable row level security;
create policy "habit_checks: own" on public.habit_checks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ───────── reports: 생성된 리포트와 이력 ─────────
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  period_key    text not null check (period_key in ('7d','30d','all')),
  period_start  date not null,
  period_end    date not null,
  mode          text not null default 'analyze',
  content_json  jsonb not null,
  model         text not null,
  entry_count   int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists reports_user_created_idx on public.reports (user_id, created_at desc);
alter table public.reports enable row level security;
create policy "reports: own" on public.reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ───────── report_evidence: 리포트 주장별 근거 기록 ─────────
create table if not exists public.report_evidence (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  entry_id    uuid not null references public.entries(id) on delete cascade,
  section     text not null,
  quote       text not null
);
create index if not exists report_evidence_report_idx on public.report_evidence (report_id);
alter table public.report_evidence enable row level security;
create policy "report_evidence: own" on public.report_evidence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ───────── entry_embeddings: 의미 기반 검색 ─────────
create table if not exists public.entry_embeddings (
  entry_id    uuid primary key references public.entries(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  embedding   vector(1536) not null,
  created_at  timestamptz not null default now()
);
alter table public.entry_embeddings enable row level security;
create policy "entry_embeddings: own" on public.entry_embeddings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 의미 검색 함수 (security invoker → RLS 적용)
create or replace function public.match_entries(
  query_embedding vector(1536),
  match_count int default 20
)
returns table (entry_id uuid, similarity float)
language sql stable as $$
  select e.entry_id, 1 - (e.embedding <=> query_embedding) as similarity
  from public.entry_embeddings e
  where e.user_id = auth.uid()
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- ───────── experiences: 이력서용 경험 카드 (2단계, 스키마만) ─────────
create table if not exists public.experiences (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  entry_ids   uuid[] not null default '{}',
  summary     text not null,
  skills      text[] not null default '{}',
  created_at  timestamptz not null default now()
);
alter table public.experiences enable row level security;
create policy "experiences: own" on public.experiences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
