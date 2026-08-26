-- 030_app_sessions.sql
-- Applied manually via Supabase SQL Editor.
--
-- The north-star metric is whether a user comes back after a bad week. No row
-- anywhere could produce it, and absence of data is indistinguishable from
-- churn. Un-backfillable: a tester who leaves in week one leaves no trace.
--
-- One row per user per LOCAL date. Day granularity is what the metric needs
-- and it makes the write idempotent -- iOS fires foreground events far more
-- often than a person meaningfully "opens" the app.

create table if not exists public.app_sessions (
  user_id         uuid not null references auth.users(id) on delete cascade,
  local_date      date not null,
  first_opened_at timestamptz not null default now(),
  last_opened_at  timestamptz not null default now(),
  open_count      int not null default 1,
  primary key (user_id, local_date)
);

alter table public.app_sessions enable row level security;

drop policy if exists "own sessions readable" on public.app_sessions;
create policy "own sessions readable"
  on public.app_sessions for select
  using (auth.uid() = user_id);

-- Writes go through record_app_open only; no insert/update policy.

create or replace function public.record_app_open(p_local_date date)
returns void as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.app_sessions (user_id, local_date)
  values (auth.uid(), p_local_date)
  on conflict (user_id, local_date) do update
    set last_opened_at = now(),
        open_count     = public.app_sessions.open_count + 1;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.record_app_open(date) to authenticated;
