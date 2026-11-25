-- HSK 독해 2부분(문장 고르기): 빈칸 5개가 보기 6개(A~F)를 함께 쓴다. 1개는 남는 보기.
-- choices: [{ text, note }]  note = 어느 빈칸의 어떤 단서와 이어지는지, 남는 보기면 왜 어디에도 안 맞는지
-- blanks 의 answer 는 choices 의 번호, options/option_notes 는 빈 배열
alter table public.hsk_sets add column if not exists choices jsonb;
