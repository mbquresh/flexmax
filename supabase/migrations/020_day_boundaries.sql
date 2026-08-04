-- Applied manually via Supabase SQL Editor.
-- day_log: sleep/wake as day BOUNDARIES, not blocks. A block is a container of
-- time you use or don't; sleep is a moment you cross. Modeling it as a block
-- made the check-in unanswerable (0 completions / 24 attempts).
-- slept_at may exceed 1440 (past midnight). Migrated from
-- daily_schedule_instances.actual_end_minutes on wind_down blocks.

alter table public.profiles
  add column if not exists sleep_target_minutes integer,
  add column if not exists wake_target_minutes integer;

comment on column public.profiles.sleep_target_minutes is
  'Target bedtime in minutes-since-midnight. May exceed 1440 for late-night targets.';

comment on column public.profiles.wake_target_minutes is
  'Target wake time in minutes-since-midnight (morning values, 0–1440).';

create table if not exists public.day_log (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  date      date not null,
  slept_at  integer,
  woke_at   integer,
  primary key (user_id, date),
  constraint day_log_slept_at_range check (
    slept_at is null or (slept_at >= 0 and slept_at <= 2880)
  ),
  constraint day_log_woke_at_range check (
    woke_at is null or (woke_at >= 0 and woke_at <= 1440)
  )
);

comment on table public.day_log is
  'Sleep and wake as day boundaries. slept_at belongs to the night ending on date; woke_at to the morning of date.';

comment on column public.day_log.slept_at is
  'When the user got to bed. Minutes since midnight; may exceed 1440 for past-midnight bedtimes.';

comment on column public.day_log.woke_at is
  'When the user got up. Minutes since midnight on the morning of date.';

alter table public.day_log enable row level security;

create policy "own day_log" on public.day_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Copy existing wind_down actual_end_minutes into yesterday's slept_at.
insert into public.day_log (user_id, date, slept_at)
select
  i.user_id,
  i.date,
  i.actual_end_minutes
from public.daily_schedule_instances i
inner join public.schedule_blocks b on b.id = i.block_id
where b.category = 'wind_down'
  and i.actual_end_minutes is not null
on conflict (user_id, date) do update
  set slept_at = excluded.slept_at
  where public.day_log.slept_at is null;
