-- 031_account_deletion.sql
-- Applied manually via Supabase SQL Editor.
--
-- Apple guideline 5.1.1(v) requires an in-app account deletion path.
--
-- Every user-owned table references profiles(id) on delete cascade, and
-- profiles references auth.users(id) on delete cascade, so deleting the auth
-- user removes everything in one statement -- no manual teardown, no ordering
-- to get wrong.
--
-- The client cannot delete an auth user; that needs the service role key,
-- which must never ship in the app. This runs as definer and deletes only the
-- caller's own row.
--
-- NOTE: deleting a user does not revoke JWTs already on device. AuthProvider
-- detects the orphaned session via getUser() and signs out (see 9d67bb5).

create or replace function public.delete_my_account()
returns void as $$
declare
  uid uuid;
begin
  uid := auth.uid();

  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from auth.users where id = uid;
end;
$$ language plpgsql security definer set search_path = public, auth;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
