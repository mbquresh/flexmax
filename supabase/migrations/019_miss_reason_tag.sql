-- Applied manually via Supabase SQL Editor.
-- miss_reason_tag: preset reason tapped during the evening sweep.
-- Deliberately separate from reflection_why — a tapped preset is not the user's
-- own words and must never be quoted as prose by the insight narrator.

alter table public.daily_schedule_instances
  add column if not exists miss_reason_tag text;

comment on column public.daily_schedule_instances.miss_reason_tag is
  'Preset reason tapped during the evening sweep. Deliberately separate from reflection_why — a tapped preset is not the user''s own words and must never be quoted as prose by the insight narrator.';

create index if not exists daily_schedule_instances_miss_reason_tag_idx
  on public.daily_schedule_instances (miss_reason_tag)
  where miss_reason_tag is not null;
