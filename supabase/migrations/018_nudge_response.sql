-- Applied manually via Supabase SQL Editor.
-- nudge_events.response: which action button the user chose on a cutoff nudge.
-- Distinguishes deliberate extension from losing track of time.

alter table public.nudge_events
  add column response text;

comment on column public.nudge_events.response is
  'Which action button the user chose on a cutoff nudge (wrapping_up, more_time, opened).';
