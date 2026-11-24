-- 지속 활동: 보여 주는 순서(드래그로 변경)와 이모지
alter table public.habits
  add column if not exists sort_order integer not null default 0,
  add column if not exists emoji text check (emoji is null or char_length(emoji) <= 16);

-- 기존 활동은 만든 순서대로
update public.habits h set sort_order = o.rn
from (select id, row_number() over (partition by user_id order by created_at) - 1 as rn from public.habits) o
where h.id = o.id;
