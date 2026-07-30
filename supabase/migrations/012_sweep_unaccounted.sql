-- Applied manually via Supabase SQL Editor.
-- Adds 'unaccounted' status: past-date blocks the user never acknowledged.
-- Distinct from 'missed' (user engaged and marked it). Silence is signal.
-- Timezone-aware: uses each user's local date, so today is never swept.
-- 4am local grace period allows post-midnight check-ins.
-- Runs hourly via pg_cron, idempotent.

-- Closes out past-date blocks the user never acknowledged.
-- 'unaccounted' is distinct from 'missed': missed means the user engaged and
-- marked it; unaccounted means total silence. For the behavioral engine,
-- silence is its own signal (disengaged / lost the evening), not missing data.
create or replace function public.sweep_unaccounted_instances()
returns integer as $$
declare swept integer;
begin
  with updated as (
    update public.daily_schedule_instances i
    set status = 'unaccounted'
    from public.profiles p
    where p.id = i.user_id
      and i.status in ('pending', 'active')
      -- Each user's OWN local date, so today's blocks are never touched
      and i.date < (now() at time zone p.timezone)::date
      -- Grace period: don't sweep at 12:01am. Night owls checking in after
      -- midnight keep yesterday open until 4am local.
      and extract(hour from (now() at time zone p.timezone)) >= 4
    returning 1
  )
  select count(*) into swept from updated;
  return swept;
end;
$$ language plpgsql security definer set search_path = public;

-- Hourly, offset from the notify job at :00 so they don't contend.
-- Idempotent — a missed run is caught by the next hour.
select cron.schedule(
  'flexmax-sweep-unaccounted',
  '15 * * * *',
  $$select public.sweep_unaccounted_instances();$$
);
