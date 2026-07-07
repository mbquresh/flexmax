-- FlexMax: run this entire file once in Supabase SQL Editor
-- Dashboard → SQL → New query → paste → Run

-- Migration 001
-- FlexMax database schema

create extension if not exists "uuid-ossp";

create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  name           text not null,
  timezone       text not null default 'America/Chicago',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.psychology_profiles (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  onboarding_messages  jsonb not null default '[]',
  peak_energy_times    text[],
  avoidance_patterns   text[],
  motivation_style     text,
  sabotage_triggers    text[],
  goals                text[],
  accountability_tone  text,
  raw_ai_summary       text,
  completed_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique(user_id)
);

create table public.schedule_templates (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null default 'My Schedule',
  is_active   boolean not null default true,
  ai_reviewed boolean not null default false,
  ai_feedback text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create type block_category as enum (
  'deep_work', 'health', 'admin', 'learning', 'social',
  'rest', 'morning_routine', 'wind_down', 'other'
);

create table public.schedule_blocks (
  id            uuid primary key default uuid_generate_v4(),
  template_id   uuid not null references public.schedule_templates(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  category      block_category not null default 'other',
  color         text not null default 'purple',
  start_minutes integer not null,
  end_minutes   integer not null,
  days_of_week  integer[] not null default '{1,2,3,4,5}',
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint valid_time check (start_minutes >= 0 and end_minutes <= 1440 and start_minutes < end_minutes)
);

create table public.daily_schedule_instances (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  block_id          uuid not null references public.schedule_blocks(id) on delete cascade,
  date              date not null,
  start_minutes     integer not null,
  end_minutes       integer not null,
  task_detail       text,
  status            text not null default 'pending',
  completion_rating text,
  reflection_why    text,
  reflection_improve text,
  rescheduled_to_id uuid references public.daily_schedule_instances(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(block_id, date),
  constraint valid_time check (start_minutes >= 0 and end_minutes <= 1440 and start_minutes < end_minutes)
);

create type notification_type as enum (
  'block_start', 'block_complete', 'idle_alert', 'missed_block',
  'nightly_fill', 'morning_brief', 'motivational'
);

create table public.notifications (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  instance_id     uuid references public.daily_schedule_instances(id),
  type            notification_type not null,
  title           text not null,
  body            text not null,
  sent_at         timestamptz,
  opened_at       timestamptz,
  responded_at    timestamptz,
  response_value  text,
  expo_ticket_id  text,
  created_at      timestamptz not null default now()
);

create table public.push_tokens (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  token       text not null,
  platform    text not null,
  created_at  timestamptz not null default now(),
  unique(token)
);

alter table public.profiles enable row level security;
alter table public.psychology_profiles enable row level security;
alter table public.schedule_templates enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.daily_schedule_instances enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id);
create policy "own psych profile" on public.psychology_profiles for all using (auth.uid() = user_id);
create policy "own templates" on public.schedule_templates for all using (auth.uid() = user_id);
create policy "own blocks" on public.schedule_blocks for all using (auth.uid() = user_id);
create policy "own instances" on public.daily_schedule_instances for all using (auth.uid() = user_id);
create policy "own notifications" on public.notifications for all using (auth.uid() = user_id);
create policy "own push tokens" on public.push_tokens for all using (auth.uid() = user_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated before update on public.profiles for each row execute function handle_updated_at();
create trigger trg_psych_updated before update on public.psychology_profiles for each row execute function handle_updated_at();
create trigger trg_templates_updated before update on public.schedule_templates for each row execute function handle_updated_at();
create trigger trg_blocks_updated before update on public.schedule_blocks for each row execute function handle_updated_at();
create trigger trg_instances_updated before update on public.daily_schedule_instances for each row execute function handle_updated_at();

create or replace function public.generate_daily_instances(target_date date)
returns void as $$
begin
  insert into public.daily_schedule_instances
    (user_id, block_id, date, start_minutes, end_minutes, status)
  select sb.user_id, sb.id, target_date, sb.start_minutes, sb.end_minutes, 'pending'
  from public.schedule_blocks sb
  join public.schedule_templates st on st.id = sb.template_id
  where st.is_active = true
    and extract(dow from target_date)::int = any(sb.days_of_week)
  on conflict (block_id, date) do nothing;
end;
$$ language plpgsql security definer;

-- Migration 002: auto-create profile on signup

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Migration 003
alter table public.psychology_profiles
  add column if not exists schedule_tips text[];

-- Migration 004: block flexibility (fixed anchors)
alter table public.schedule_blocks
  add column if not exists is_fixed boolean not null default false;

alter table public.daily_schedule_instances
  add column if not exists is_fixed boolean not null default false;

create or replace function public.generate_daily_instances(target_date date)
returns void as $$
begin
  insert into public.daily_schedule_instances
    (user_id, block_id, date, start_minutes, end_minutes, status, is_fixed)
  select
    sb.user_id,
    sb.id,
    target_date,
    sb.start_minutes,
    sb.end_minutes,
    'pending',
    sb.is_fixed
  from public.schedule_blocks sb
  join public.schedule_templates st on st.id = sb.template_id
  where st.is_active = true
    and extract(dow from target_date)::int = any(sb.days_of_week)
  on conflict (block_id, date) do nothing;
end;
$$ language plpgsql security definer;

-- Migration 005: block removal from today
alter table public.daily_schedule_instances
  add column if not exists removed_reason text;

-- Migration 006: ad-hoc tasks for Today
create table if not exists public.adhoc_tasks (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  date              date not null,
  name              text not null,
  start_minutes     integer,
  end_minutes       integer,
  status            text not null default 'pending',
  completion_rating text,
  created_at        timestamptz not null default now(),

  constraint valid_adhoc_time check (
    (start_minutes is null and end_minutes is null) or
    (start_minutes is not null and end_minutes is not null
     and start_minutes >= 0 and end_minutes <= 1440 and start_minutes < end_minutes)
  )
);

alter table public.adhoc_tasks enable row level security;

create policy "own adhoc tasks" on public.adhoc_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Migration 007: secure generate_daily_instances RPC split
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

-- Migration 008: atomic swap of two instance time slots
-- Atomic swap of two daily_schedule_instances' time slots.
-- Both updates commit together or not at all.
-- Scoped to the calling user for safety.

create or replace function public.swap_instance_times(
  instance_a_id uuid,
  a_start integer,
  a_end integer,
  instance_b_id uuid,
  b_start integer,
  b_end integer
)
returns void as $$
begin
  -- Verify both instances belong to the caller before touching anything
  if not exists (
    select 1 from public.daily_schedule_instances
    where id = instance_a_id and user_id = auth.uid()
  ) or not exists (
    select 1 from public.daily_schedule_instances
    where id = instance_b_id and user_id = auth.uid()
  ) then
    raise exception 'Instance not found or not owned by caller';
  end if;

  update public.daily_schedule_instances
    set start_minutes = a_start, end_minutes = a_end
    where id = instance_a_id and user_id = auth.uid();

  update public.daily_schedule_instances
    set start_minutes = b_start, end_minutes = b_end
    where id = instance_b_id and user_id = auth.uid();
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.swap_instance_times(uuid, integer, integer, uuid, integer, integer) to authenticated;
