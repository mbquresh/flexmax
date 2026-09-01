-- 042_away_periods.sql
-- Applied manually via Supabase SQL Editor.
--
-- "I'm away next week." Until now a week of travel meant manually removing
-- every block on every day, and each removal reads to the behavioural engine
-- as disengagement rather than as life. The evidence pack cannot tell the
-- difference between a user who stopped caring and a user who was on a plane.
--
-- USER-LEVEL, not per block. 040's block_exceptions is the right primitive for
-- "no gym next Tuesday", but an away WEEK written that way is 60+ rows, needs
-- consecutive dates regrouped into ranges to display or cancel, and silently
-- misses any block created during the period. One row per absence fixes all
-- three. block_exceptions stays for the per-block case.
--
-- No instances are generated for these dates at all. Deliberately not skipped
-- placeholder rows: get_behavior_evidence's tracked CTE requires 25% of a
-- block's instances to be resolved, so a week of unanswered rows would push
-- blocks below the floor and drop them out of the engine entirely -- the exact
-- misreading this exists to prevent.
--
-- The accounted-for streak already handles this correctly with no change:
-- computeStreakData requires relevant > 0 per day, so a day with no blocks
-- neither breaks nor extends the streak.

create table if not exists public.away_periods (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  starts_on  date not null,
  ends_on    date not null,
  label      text,
  created_at timestamptz not null default now(),
  constraint away_range_valid check (ends_on >= starts_on)
);

create index if not exists away_periods_user_range_idx
  on public.away_periods (user_id, starts_on, ends_on);

alter table public.away_periods enable row level security;

drop policy if exists "own away periods" on public.away_periods;
create policy "own away periods" on public.away_periods
  for all using (auth.uid() = user_id);

-- Overlapping periods are allowed and harmless: the predicate below is an
-- existence check, so two overlapping absences suppress the same dates once.

create or replace function public.generate_my_daily_instances(target_date date)
returns void as $$
begin
  insert into public.daily_schedule_instances
    (user_id, block_id, date, start_minutes, end_minutes, status, is_fixed)
  select
    sb.user_id, sb.id, target_date,
    sb.start_minutes, sb.end_minutes, 'pending', sb.is_fixed
  from public.schedule_blocks sb
  join public.schedule_templates st on st.id = sb.template_id
  where st.is_active = true
    and sb.is_active = true
    and sb.user_id = auth.uid()                    -- CRITICAL: only the caller's own data
    and extract(dow from target_date)::int = any(sb.days_of_week)
    and (sb.starts_on is null or target_date >= sb.starts_on)
    and (sb.ends_on   is null or target_date <= sb.ends_on)
    and (
      sb.interval_weeks = 1
      or mod(
           ((target_date - coalesce(sb.anchor_date, sb.starts_on, sb.created_at::date)) / 7)::int,
           sb.interval_weeks
         ) = 0
    )
    and not exists (
      select 1 from public.block_exceptions be
      where be.block_id = sb.id and be.date = target_date
    )
    and not exists (
      select 1 from public.away_periods ap
      where ap.user_id = sb.user_id
        and target_date between ap.starts_on and ap.ends_on
    )
  on conflict (block_id, date) do nothing;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.generate_daily_instances(target_date date)
returns void as $$
begin
  insert into public.daily_schedule_instances
    (user_id, block_id, date, start_minutes, end_minutes, status, is_fixed)
  select
    sb.user_id, sb.id, target_date,
    sb.start_minutes, sb.end_minutes, 'pending', sb.is_fixed
  from public.schedule_blocks sb
  join public.schedule_templates st on st.id = sb.template_id
  where st.is_active = true
    and sb.is_active = true
    and extract(dow from target_date)::int = any(sb.days_of_week)
    and (sb.starts_on is null or target_date >= sb.starts_on)
    and (sb.ends_on   is null or target_date <= sb.ends_on)
    and (
      sb.interval_weeks = 1
      or mod(
           ((target_date - coalesce(sb.anchor_date, sb.starts_on, sb.created_at::date)) / 7)::int,
           sb.interval_weeks
         ) = 0
    )
    and not exists (
      select 1 from public.block_exceptions be
      where be.block_id = sb.id and be.date = target_date
    )
    and not exists (
      select 1 from public.away_periods ap
      where ap.user_id = sb.user_id
        and target_date between ap.starts_on and ap.ends_on
    )
  on conflict (block_id, date) do nothing;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.generate_daily_instances(date) from authenticated, anon;
grant execute on function public.generate_my_daily_instances(date) to authenticated;
