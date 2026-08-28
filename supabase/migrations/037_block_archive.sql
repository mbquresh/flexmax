-- 037_block_archive.sql
-- Applied manually via Supabase SQL Editor.
--
-- schedule_blocks.is_active lets a block retire without destroying its record.
-- Until now the only removal path was delete, and
-- daily_schedule_instances.block_id is ON DELETE CASCADE -- so retiring a
-- finished programme meant permanently deleting every completion, miss,
-- rating and reflection it ever produced.
--
-- Archived blocks stop generating instances. Their history stays, so
-- get_behavior_evidence's 30-day window continues to see them until they
-- naturally age out. No change to the evidence pack is needed.
--
-- NOTE the two is_active columns: st.is_active is the TEMPLATE flag that
-- already existed, sb.is_active is new and per-block. Both must be checked.

alter table public.schedule_blocks
  add column if not exists is_active boolean not null default true;

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
  on conflict (block_id, date) do nothing;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.generate_daily_instances(date) from authenticated, anon;
grant execute on function public.generate_my_daily_instances(date) to authenticated;
