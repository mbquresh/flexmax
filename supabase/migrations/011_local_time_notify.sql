-- Applied manually via Supabase SQL Editor.
-- Returns push tokens for users whose LOCAL hour matches target_hour.
-- Postgres resolves IANA zones itself, so DST is handled automatically —
-- 'America/Chicago' is 9pm in July and 9pm in December, no drift.
-- Called hourly by nightly-notify with target_hour = 21.
create or replace function public.users_to_notify_now(target_hour integer)
returns table (token text, user_id uuid) as $$
  select pt.token, pt.user_id
  from public.push_tokens pt
  join public.profiles p on p.id = pt.user_id
  where extract(hour from (now() at time zone p.timezone)) = target_hour;
$$ language sql security definer set search_path = public;

-- Only the service role (nightly-notify) may call this. No grant to authenticated.
grant execute on function public.users_to_notify_now(integer) to service_role;
