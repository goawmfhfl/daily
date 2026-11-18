-- ───────── 중국어 학습 ─────────
-- zh_phrases: 사용자가 입력한 한국어 문장 하나
-- zh_translations: 그 문장의 난이도별 번역 (문장당 난이도마다 하나)
create table if not exists public.zh_phrases (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  source_ko   text not null,
  favorite    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists zh_phrases_user_created_idx on public.zh_phrases (user_id, created_at desc);
alter table public.zh_phrases enable row level security;
create policy "zh_phrases: own" on public.zh_phrases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.zh_translations (
  id          uuid primary key default gen_random_uuid(),
  phrase_id   uuid not null references public.zh_phrases(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  level       text not null check (level in ('easy','conversation','native')),
  hanzi       text not null,
  pinyin      text not null,
  -- [{ hanzi, pinyin, ko }] 단어 단위 분절
  segments    jsonb not null default '[]'::jsonb,
  note        text,
  model       text not null,
  created_at  timestamptz not null default now(),
  unique (phrase_id, level)
);
create index if not exists zh_translations_phrase_idx on public.zh_translations (phrase_id);
alter table public.zh_translations enable row level security;
create policy "zh_translations: own" on public.zh_translations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
