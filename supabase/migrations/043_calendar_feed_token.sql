-- 043_calendar_feed_token.sql
-- Applied manually via Supabase SQL Editor.
--
-- Token for the calendar subscription feed. Calendar clients cannot send
-- Authorization headers, so the feed URL must carry its own secret and be
-- publicly reachable. This is the only unauthenticated endpoint in the product
-- and the token is the ONLY thing protecting it.
--
-- Design constraints that follow from that:
--   * 24 random bytes, hex encoded (48 chars). NOT the user id -- a user id
--     appears in logs, error messages and support threads, and is not
--     rotatable.
--   * NULLABLE and generated lazily. A user who never exports has no live
--     endpoint at all, so the attack surface is opt-in.
--   * Rotatable. Regenerating invalidates the old URL, which is the only
--     recovery available once a link has leaked.
--
-- Exposure if a link leaks: block names and times. Mild for "Cardio", not mild
-- for "Therapy". The UI must say so plainly rather than burying it.

alter table public.profiles
  add column if not exists calendar_feed_token text;

-- Enforced uniqueness matters here: the token is the sole lookup key for an
-- unauthenticated endpoint, so a collision would serve one user another user's
-- schedule. Partial index so the many NULLs do not collide with each other.
create unique index if not exists profiles_calendar_feed_token_key
  on public.profiles (calendar_feed_token)
  where calendar_feed_token is not null;

comment on column public.profiles.calendar_feed_token is
  'Secret for the public ICS feed URL. NULL until the user first enables export. Rotatable; rotating invalidates the previous URL.';

-- Generates on first call, returns the existing token afterwards, and rotates
-- on demand. SECURITY DEFINER with an auth.uid() filter so a caller can only
-- ever touch their own row.
create or replace function public.get_or_create_calendar_token(p_rotate boolean default false)
returns text as $$
declare
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not p_rotate then
    select calendar_feed_token into v_token
    from public.profiles where id = auth.uid();
    if v_token is not null then
      return v_token;
    end if;
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  update public.profiles
  set calendar_feed_token = v_token
  where id = auth.uid();

  return v_token;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.get_or_create_calendar_token(boolean) from anon;
grant execute on function public.get_or_create_calendar_token(boolean) to authenticated;

-- Disabling export. Sets the token to NULL so the endpoint stops resolving
-- entirely rather than continuing to serve an orphaned link.
create or replace function public.revoke_calendar_token()
returns void as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update public.profiles set calendar_feed_token = null where id = auth.uid();
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.revoke_calendar_token() from anon;
grant execute on function public.revoke_calendar_token() to authenticated;
