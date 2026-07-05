-- ─────────────────────────────────────────────────────────
-- SECURITY FIX: split generate_daily_instances into
--   1. user-scoped version the client can safely call (only touches caller's own data)
--   2. global version reserved for the service role / cron only
-- ─────────────────────────────────────────────────────────

-- 1. User-scoped version: generates instances ONLY for the calling user.
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
    and sb.user_id = auth.uid()                    -- CRITICAL: only the caller's own data
    and extract(dow from target_date)::int = any(sb.days_of_week)
  on conflict (block_id, date) do nothing;
end;
$$ language plpgsql security definer set search_path = public;

-- 2. Global version stays for the cron job, but revoke it from normal users.
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
    and extract(dow from target_date)::int = any(sb.days_of_week)
  on conflict (block_id, date) do nothing;
end;
$$ language plpgsql security definer set search_path = public;

-- Lock down execute permissions
revoke execute on function public.generate_daily_instances(date) from authenticated, anon;
grant execute on function public.generate_my_daily_instances(date) to authenticated;
