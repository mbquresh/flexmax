-- 046_block_time_overrides.sql
-- Applied manually via Supabase SQL Editor.
--
-- Per-weekday time overrides. schedule_blocks holds ONE start/end plus a
-- days_of_week array, so "gym at 6am on weekdays and 9am on Saturday" is
-- unexpressible -- you have to create a second block.
--
-- That workaround is worse than it looks: get_behavior_evidence groups by
-- block NAME, so two blocks called "Gym" already merge into one row in
-- block_stats, quality_drift and cannibalization. The engine has been treating
-- them as one thing while the UI insisted they were two.
--
-- Sparse jsonb keyed by day-of-week 0-6 (0 = Sunday), mirroring
-- profiles.day_boundary_overrides which is already proven. Days absent use the
-- block's base start_minutes/end_minutes, so every existing row is unaffected
-- and nothing needs backfilling.
--
--   {"6": {"start": 540, "end": 600}}
--
-- Both keys are required together when a day is present. A half-override would
-- mean inheriting one end of a window and not the other, which is never what
-- someone means.

alter table public.schedule_blocks
  add column if not exists time_overrides jsonb not null default '{}'::jsonb;

comment on column public.schedule_blocks.time_overrides is
  'Sparse per-weekday time overrides, keys 0-6 (0=Sunday), each {start,end} in minutes since midnight. Absent days use start_minutes/end_minutes.';

-- Generation resolves the override for the target weekday. coalesce falls back
-- to the base columns, so a block with no overrides behaves exactly as before.
create or replace function public.generate_my_daily_instances(target_date date)
returns void as $$
declare
  v_dow text := extract(dow from target_date)::int::text;
begin
  insert into public.daily_schedule_instances
    (user_id, block_id, date, start_minutes, end_minutes, status, is_fixed)
  select
    sb.user_id, sb.id, target_date,
    coalesce((sb.time_overrides -> v_dow ->> 'start')::int, sb.start_minutes),
    coalesce((sb.time_overrides -> v_dow ->> 'end')::int,   sb.end_minutes),
    'pending', sb.is_fixed
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
declare
  v_dow text := extract(dow from target_date)::int::text;
begin
  insert into public.daily_schedule_instances
    (user_id, block_id, date, start_minutes, end_minutes, status, is_fixed)
  select
    sb.user_id, sb.id, target_date,
    coalesce((sb.time_overrides -> v_dow ->> 'start')::int, sb.start_minutes),
    coalesce((sb.time_overrides -> v_dow ->> 'end')::int,   sb.end_minutes),
    'pending', sb.is_fixed
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
