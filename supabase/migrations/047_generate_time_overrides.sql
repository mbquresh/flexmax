-- 047_generate_time_overrides.sql
-- Paste into the Supabase SQL Editor. supabase db push is out of sync.
--
-- 046 added time_overrides but the last committed generate_* bodies still
-- insert the base start/end for every day. A Saturday 9am gym then lands
-- on Today at the weekday 6am. Both functions resolve the JSON the same
-- way the client does: override for that dow if present, else the base.
--
-- Also give the column a DEFAULT so an omitted write is {} rather than a
-- 23502. Live column is already NOT NULL.

alter table public.schedule_blocks
  alter column time_overrides set default '{}'::jsonb;

create or replace function public.generate_my_daily_instances(target_date date)
returns void as $$
begin
  insert into public.daily_schedule_instances
    (user_id, block_id, date, start_minutes, end_minutes, status, is_fixed)
  select
    sb.user_id, sb.id, target_date,
    coalesce(
      (sb.time_overrides -> ((extract(dow from target_date))::int::text) ->> 'start')::int,
      sb.start_minutes
    ),
    coalesce(
      (sb.time_overrides -> ((extract(dow from target_date))::int::text) ->> 'end')::int,
      sb.end_minutes
    ),
    'pending', sb.is_fixed
  from public.schedule_blocks sb
  join public.schedule_templates st on st.id = sb.template_id
  where st.is_active = true
    and sb.is_active = true
    and sb.user_id = auth.uid()
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
    coalesce(
      (sb.time_overrides -> ((extract(dow from target_date))::int::text) ->> 'start')::int,
      sb.start_minutes
    ),
    coalesce(
      (sb.time_overrides -> ((extract(dow from target_date))::int::text) ->> 'end')::int,
      sb.end_minutes
    ),
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
