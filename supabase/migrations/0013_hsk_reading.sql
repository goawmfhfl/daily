-- ───────── HSK 독해 연습 ─────────
-- 세트: AI 가 만들고 블라인드 검수까지 통과한 문제. served_at 이 null 이면 아직 꺼내지 않은 풀.
create table if not exists public.hsk_sets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  level          smallint not null check (level between 1 and 9),
  part           smallint not null default 1,
  topic          text not null,
  title          text not null default '',
  -- {{1}} … {{5}} 로 빈칸을 표시한 지문
  passage        text not null,
  -- [{ no, kind, options[4], answer, explanation, option_notes[4] }]
  blanks         jsonb not null,
  translation_ko text not null default '',
  status         text not null default 'active' check (status in ('active','reported')),
  origin         text not null default 'pool' check (origin in ('pool','similar')),
  focus_words    text[] not null default '{}',
  verify         jsonb,
  model          text,
  served_at      timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists hsk_sets_pool_idx on public.hsk_sets (user_id, level, part, served_at, created_at);
alter table public.hsk_sets enable row level security;
create policy "hsk_sets: own" on public.hsk_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 풀이 기록 (처음 풀이·다시 풀기)
create table if not exists public.hsk_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  set_id        uuid not null references public.hsk_sets(id) on delete cascade,
  mode          text not null default 'first' check (mode in ('first','retry')),
  -- 빈칸 번호 → 고른 보기 번호
  selected      jsonb not null,
  correct       smallint not null,
  total         smallint not null,
  duration_sec  integer,
  created_at    timestamptz not null default now()
);
create index if not exists hsk_attempts_user_idx on public.hsk_attempts (user_id, created_at desc);
alter table public.hsk_attempts enable row level security;
create policy "hsk_attempts: own" on public.hsk_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 오답노트: 빈칸 단위. stage 0~3, 세 번 맞히면 resolved
create table if not exists public.hsk_wrong (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  set_id        uuid not null references public.hsk_sets(id) on delete cascade,
  blank_no      smallint not null,
  selected      smallint not null,
  answer        smallint not null,
  stage         smallint not null default 0,
  due_on        date,
  review_count  integer not null default 0,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, set_id, blank_no)
);
create index if not exists hsk_wrong_user_due_idx on public.hsk_wrong (user_id, resolved_at, due_on);
alter table public.hsk_wrong enable row level security;
create policy "hsk_wrong: own" on public.hsk_wrong
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
