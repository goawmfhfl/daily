-- 단어장 암기 상태와 복습 주기 (시험 없이 스스로 "외웠어요 / 아직"을 체크).
-- stage 0: 외우지 않음(review_count 0) 또는 외우는 중
-- stage 1~6: 외움. 다음 복습까지 1일 → 3일 → 1주 → 2주 → 1달 → 3달
-- stage 7: 완전히 외움 (더 이상 복습에 나오지 않음)
alter table public.zh_vocab
  add column if not exists stage smallint not null default 0,
  add column if not exists due_on date,
  add column if not exists review_count integer not null default 0,
  add column if not exists last_reviewed_at timestamptz;

alter table public.zh_vocab drop constraint if exists zh_vocab_stage_valid;
alter table public.zh_vocab add constraint zh_vocab_stage_valid check (stage between 0 and 7);

create index if not exists zh_vocab_user_due_idx on public.zh_vocab (user_id, due_on);
