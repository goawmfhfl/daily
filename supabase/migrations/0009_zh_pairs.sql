-- 문장별 외우기: 번역 하나를 [한국어 ↔ 중국어] 짝으로 나눈 결과.
-- [{ "ko": "...", "from": 0, "to": 12 }, ...]  from/to 는 segments 인덱스 (to 미포함).
-- null 이면 아직 나누지 않음 (처음 "문장별"로 볼 때 한 번 계산해 저장). 다시 번역하면 null 로 돌아간다.
alter table public.zh_translations add column if not exists pairs jsonb;
