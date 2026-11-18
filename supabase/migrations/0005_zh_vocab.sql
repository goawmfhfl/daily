-- ───────── 중국어 단어장 ─────────
-- 단어·숙어·문장을 한 표에 저장한다.
-- 직접 입력한 항목은 AI 가 뜻·해석·예문을 만들고,
-- 번역 카드에서 저장한 문장은 그 번역(source_translation_id)을 그대로 옮겨 온다.
create table if not exists public.zh_vocab (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  kind                   text not null check (kind in ('word','idiom','sentence')),
  -- 사용자가 입력한 원문 (한국어 또는 중국어)
  input                  text not null,
  hanzi                  text not null,
  pinyin                 text not null,
  -- 품사 (문장은 빈 문자열)
  part_of_speech         text not null default '',
  -- 뜻 (문장은 한국어 해석)
  meaning                text not null,
  -- 해석: 쓰임·뉘앙스·문법 포인트
  explanation            text not null default '',
  -- [{ hanzi, pinyin, ko }]
  examples               jsonb not null default '[]'::jsonb,
  -- 문장일 때 단어 분절 [{ hanzi, pinyin, ko }]
  segments               jsonb not null default '[]'::jsonb,
  source_translation_id  uuid references public.zh_translations(id) on delete set null,
  model                  text,
  created_at             timestamptz not null default now(),
  unique (user_id, kind, hanzi)
);
create index if not exists zh_vocab_user_created_idx on public.zh_vocab (user_id, created_at desc);
alter table public.zh_vocab enable row level security;
create policy "zh_vocab: own" on public.zh_vocab
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
