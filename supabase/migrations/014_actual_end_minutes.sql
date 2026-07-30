-- Applied manually via Supabase SQL Editor.
-- actual_end_minutes: user-reported REAL end time, vs end_minutes which is
-- scheduled template time and never varies. Allows >1440 for past-midnight.
-- Captured retroactively the next morning for wind_down blocks.

alter table public.daily_schedule_instances
  add column actual_end_minutes integer;

comment on column public.daily_schedule_instances.actual_end_minutes is
  'User-reported REAL end time, vs end_minutes which is scheduled template time and never varies. Allows >1440 for past-midnight. Captured retroactively the next morning for wind_down blocks.';
