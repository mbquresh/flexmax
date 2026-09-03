-- 045: backfill marker on daily_schedule_instances.
--
-- Past-day access lets a user answer a block days after it happened. Every
-- timing column in this table stamps now(): acknowledged_at (024),
-- rated_at and reflected_at (010). A block from last Tuesday answered today
-- would therefore report a recovery time of five days, and recovery time is
-- the metric Tier 1 justified acknowledged_at with. Without this column the
-- corruption is silent and unrecoverable — the row looks exactly like a
-- same-day answer that took a very long time.
--
-- A trigger rather than a client write. The client is currently the only
-- writer, but a marker that exists to protect a metric must not depend on
-- every future call site remembering it, and the app has already shipped a
-- notification resync that dropped a category for exactly that reason.
--
-- Nothing reads this yet, deliberately. No version of get_behavior_evidence
-- computes a timing metric, so there is nothing to filter today; the column
-- exists because the distinction is un-backfillable and the data starts
-- accumulating the moment past-day editing ships. This is capture without
-- consumption in the letter but not the spirit of the day_log removal —
-- day_log occupied a render slot and suppressed the engine's only daily
-- output. This is invisible.

alter table public.daily_schedule_instances
  add column if not exists backfilled_at timestamptz;

comment on column public.daily_schedule_instances.backfilled_at is
  'Set when the row''s outcome was written after its own local date had passed. Timing metrics (acknowledged_at, rated_at, reflected_at) must exclude these rows; outcome metrics must not.';

create or replace function public.stamp_backfill()
returns trigger as $$
declare
  tz text;
  local_today date;
begin
  -- Only an outcome write counts. A swap, a reschedule, or a task_detail
  -- edit on a past day is housekeeping, not a late answer.
  if new.status is not distinct from old.status
     and new.completion_rating is not distinct from old.completion_rating
     and new.reflection_why is not distinct from old.reflection_why
     and new.miss_reason_tag is not distinct from old.miss_reason_tag then
    return new;
  end if;

  -- Once marked, always marked. An undo followed by a re-answer is still a
  -- late answer — the day cannot come back.
  if new.backfilled_at is not null then
    return new;
  end if;

  select coalesce(p.timezone, 'UTC') into tz
  from public.profiles p
  where p.id = new.user_id;

  -- The user's own date, not UTC. Yesterday is the common backfill and a
  -- UTC comparison would classify it as same-day for half the world.
  begin
    local_today := (now() at time zone coalesce(tz, 'UTC'))::date;
  exception when others then
    local_today := (now() at time zone 'UTC')::date;
  end;

  if new.date < local_today then
    new.backfilled_at := now();
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists stamp_backfill_trigger on public.daily_schedule_instances;

create trigger stamp_backfill_trigger
  before update on public.daily_schedule_instances
  for each row execute function public.stamp_backfill();
