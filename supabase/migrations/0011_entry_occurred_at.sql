-- 생각이 떠오른 시각. 비어 있으면 작성 시각(created_at)이 곧 그 시각이다.
alter table public.entries add column if not exists occurred_at timestamptz;
