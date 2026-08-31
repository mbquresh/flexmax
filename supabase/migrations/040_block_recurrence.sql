-- 040_block_recurrence.sql
-- Applied manually via Supabase SQL Editor.
--
-- Recurrence beyond a weekly day-mask. Until now days_of_week was the ENTIRE
-- model: no every-other-week, no start or end date, and no way to skip a date
-- in advance. A week of travel meant seven manual removals, each of which
-- reads to the behavioural engine as disengagement rather than as life.
--
-- Four additive columns plus one table. Every default preserves existing
-- behaviour exactly: interval_weeks 1, null date bounds, no exceptions.
--
-- DELIBERATELY NOT RRULE. RRULE would express more and would interoperate with
-- an ICS export later, but generate_daily_instances is plpgsql doing a single
-- dow comparison -- evaluating RRULE in SQL means carrying a spec to cover
-- cases nobody has asked for. Every field here maps cleanly onto ICS when
-- export arrives: interval_weeks -> INTERVAL, ends_on -> UNTIL,
-- block_exceptions -> EXDATE.
--
-- MONTHLY PATTERNS ("first Monday") ARE OUT OF SCOPE. Every-N-weeks covers
-- alternating gym splits, biweekly commitments and 4-on-4-off shifts. Monthly
-- needs different machinery and can wait for a real request.

-- ---------------------------------------------------------------
-- 1. Recurrence columns
-- ---------------------------------------------------------------

alter table public.schedule_blocks
  add column if not exists starts_on      date,
  add column if not exists ends_on        date,
  add column if not exists interval_weeks integer not null default 1,
  add column if not exists anchor_date    date;

comment on column public.schedule_blocks.starts_on is
  'First date this block may generate. NULL = no lower bound.';
comment on column public.schedule_blocks.ends_on is
  'Last date this block may generate. NULL = open ended.';
comment on column public.schedule_blocks.interval_weeks is
  'Generate every N weeks. 1 = every week (default, preserves prior behaviour).';
comment on column public.schedule_blocks.anchor_date is
  'Defines which week is week 0 for interval_weeks. Falls back to starts_on, then created_at.';

-- NOT VALID throughout, matching 025: legacy rows are not checked, everything
-- written from here on is governed.
alter table public.schedule_blocks
  drop constraint if exists interval_weeks_valid;
alter table public.schedule_blocks
  add constraint interval_weeks_valid
  check (interval_weeks >= 1 and interval_weeks <= 8) not valid;

alter table public.schedule_blocks
  drop constraint if exists block_date_range_valid;
alter table public.schedule_blocks
  add constraint block_date_range_valid
  check (ends_on is null or starts_on is null or ends_on >= starts_on) not valid;

-- ---------------------------------------------------------------
-- 2. Advance skip
-- ---------------------------------------------------------------
--
-- An exception PREVENTS the instance from existing. It must NOT create a
-- skipped one: get_behavior_evidence's tracked CTE requires 25% of a block's
-- instances to be resolved, so a week of unresolved placeholder rows would push
-- a block below the floor and drop it out of the engine entirely. Skipping has
-- to be invisible to the evidence pack, not merely unanswered.

create table if not exists public.block_exceptions (
  block_id   uuid not null references public.schedule_blocks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  date       date not null,
  created_at timestamptz not null default now(),
  primary key (block_id, date)
);

create index if not exists block_exceptions_user_date_idx
  on public.block_exceptions (user_id, date);

alter table public.block_exceptions enable row level security;

drop policy if exists "own block exceptions" on public.block_exceptions;
create policy "own block exceptions" on public.block_exceptions
  for all using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- 3. Generation
-- ---------------------------------------------------------------
--
-- Both functions get identical recurrence predicates. They already diverge
-- only in the auth.uid() filter -- keep it that way.
--
-- Interval arithmetic: (target_date - anchor) is an integer day count, integer
-- division by 7 gives whole weeks elapsed, and mod by interval_weeks picks the
-- "on" weeks. anchor falls back to starts_on then created_at::date, never to
-- current_date -- a moving anchor would silently reshuffle which weeks a block
-- lands on every day that passes.

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
  on conflict (block_id, date) do nothing;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.generate_daily_instances(date) from authenticated, anon;
grant execute on function public.generate_my_daily_instances(date) to authenticated;
