-- 028_reschedule_provenance.sql
-- Applied manually via Supabase SQL Editor.
--
-- handleReschedule mutates start_minutes/end_minutes in place and sets status
-- back to 'pending'. That write destroys the fact the block was ever missed,
-- so "do rescheduled blocks actually get completed?" -- the falsifiable test
-- stated as a query -- was unanswerable.
--
-- Written explicitly by the client, NOT by a trigger. A trigger watching
-- start_minutes would also fire on swap_instance_times, and swaps would be
-- miscounted as reschedules.
--
-- NOTE: every row predating this reads as reschedule_count 0 whether or not it
-- was actually rescheduled. Queries over this column have a hard floor at the
-- date it was applied.

alter table public.daily_schedule_instances
  add column if not exists reschedule_count int not null default 0,
  add column if not exists original_start_minutes int,
  add column if not exists original_end_minutes int;

comment on column public.daily_schedule_instances.reschedule_count is
  'Times this instance was rescheduled out of a missed state. 0 = never. Not incremented by swaps.';

comment on column public.daily_schedule_instances.original_start_minutes is
  'Scheduled start before the FIRST reschedule. Set once, never overwritten, so it survives repeated moves.';

comment on column public.daily_schedule_instances.original_end_minutes is
  'Scheduled end before the FIRST reschedule. With original_start_minutes, gives the original duration -- lets compression be distinguished from a plain time shift.';
