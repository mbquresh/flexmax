-- FlexMax database schema
-- Run: npx supabase db push

-- ─────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- USERS (extends Supabase auth.users)
-- ─────────────────────────────────────────
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  name           text not null,
  timezone       text not null default 'America/Chicago',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- PSYCHOLOGY PROFILE
-- Stores what the AI learns during onboarding.
-- This is the brain of the accountability engine.
-- ─────────────────────────────────────────
create table public.psychology_profiles (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid not null references public.profiles(id) on delete cascade,

  -- Raw onboarding transcript for re-analysis
  onboarding_messages  jsonb not null default '[]',

  -- AI-extracted insights (populated after onboarding)
  peak_energy_times    text[],          -- e.g. ['morning', 'early afternoon']
  avoidance_patterns   text[],          -- e.g. ['checking phone first', 'afternoon slump']
  motivation_style     text,            -- 'intrinsic' | 'accountability' | 'streaks' | 'external'
  sabotage_triggers    text[],          -- e.g. ['tiredness', 'social media', 'unclear next step']
  goals                text[],          -- top 3 goals user stated
  accountability_tone  text,            -- 'firm' | 'gentle' | 'data-driven'
  raw_ai_summary       text,            -- full AI-generated profile summary

  completed_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique(user_id)
);

-- ─────────────────────────────────────────
-- SCHEDULE TEMPLATES
-- A user can have one active template (their "base" week).
-- In v2 this can expand to multiple templates (weekday/weekend).
-- ─────────────────────────────────────────
create table public.schedule_templates (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null default 'My Schedule',
  is_active   boolean not null default true,
  ai_reviewed boolean not null default false,
  ai_feedback text,   -- AI's approval message or suggestions
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- SCHEDULE BLOCKS (template layer)
-- The repeating blocks that define a user's week structure.
-- Time is stored as minutes since midnight for easy sorting/shifting.
-- ─────────────────────────────────────────
create type block_category as enum (
  'deep_work',
  'health',
  'admin',
  'learning',
  'social',
  'rest',
  'morning_routine',
  'wind_down',
  'other'
);

create table public.schedule_blocks (
  id            uuid primary key default uuid_generate_v4(),
  template_id   uuid not null references public.schedule_templates(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,

  name          text not null,
  category      block_category not null default 'other',
  color         text not null default 'purple',   -- purple | teal | amber | coral | gray

  -- Time as minutes since midnight (0–1439)
  -- Allows easy arithmetic for shifting blocks
  start_minutes integer not null,   -- e.g. 360 = 6:00 AM
  end_minutes   integer not null,   -- e.g. 420 = 7:00 AM

  -- Which days this block repeats (0=Sun, 1=Mon, ..., 6=Sat)
  days_of_week  integer[] not null default '{1,2,3,4,5}',

  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint valid_time check (start_minutes >= 0 and end_minutes <= 1440 and start_minutes < end_minutes)
);

-- ─────────────────────────────────────────
-- DAILY INSTANCES
-- Each calendar day gets its own instance of the schedule.
-- This is where time shifts, skips, and task details live.
-- ─────────────────────────────────────────
create table public.daily_schedule_instances (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  block_id          uuid not null references public.schedule_blocks(id) on delete cascade,

  date              date not null,

  -- Can be shifted from template values for this day only
  start_minutes     integer not null,
  end_minutes       integer not null,

  -- User fills this in the night before (or morning of)
  task_detail       text,   -- e.g. "Chest day + 20min run" or "Bio exam prep"

  -- Lifecycle
  status            text not null default 'pending',
  -- pending | active | completed | missed | skipped | rescheduled

  -- Accountability
  completion_rating text,   -- 'crushed' | 'partial' | 'pulled_away'
  reflection_why    text,   -- why they missed (if missed)
  reflection_improve text,  -- what they'd change next time

  -- If rescheduled, points to the new instance
  rescheduled_to_id uuid references public.daily_schedule_instances(id),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique(block_id, date),
  constraint valid_time check (start_minutes >= 0 and end_minutes <= 1440 and start_minutes < end_minutes)
);

-- ─────────────────────────────────────────
-- NOTIFICATIONS LOG
-- Tracks what was sent, when, and whether user responded.
-- Powers the accountability intelligence over time.
-- ─────────────────────────────────────────
create type notification_type as enum (
  'block_start',        -- "Your deep work block starts in 5 min"
  'block_complete',     -- "How'd your workout go?"
  'idle_alert',         -- "You've been idle 15 min — still on task?"
  'missed_block',       -- "Looks like you missed your 6AM workout"
  'nightly_fill',       -- "Fill in tomorrow's blocks"
  'morning_brief',      -- "Here's your day"
  'motivational'        -- AI-generated check-in
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
  response_value  text,   -- what the user tapped / responded

  expo_ticket_id  text,   -- for delivery tracking
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- PUSH TOKENS
-- ─────────────────────────────────────────
create table public.push_tokens (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  token       text not null,
  platform    text not null,   -- 'ios' | 'android'
  created_at  timestamptz not null default now(),
  unique(token)
);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.psychology_profiles enable row level security;
alter table public.schedule_templates enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.daily_schedule_instances enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;

-- Users can only touch their own rows
create policy "own profile" on public.profiles for all using (auth.uid() = id);
create policy "own psych profile" on public.psychology_profiles for all using (auth.uid() = user_id);
create policy "own templates" on public.schedule_templates for all using (auth.uid() = user_id);
create policy "own blocks" on public.schedule_blocks for all using (auth.uid() = user_id);
create policy "own instances" on public.daily_schedule_instances for all using (auth.uid() = user_id);
create policy "own notifications" on public.notifications for all using (auth.uid() = user_id);
create policy "own push tokens" on public.push_tokens for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ─────────────────────────────────────────
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

-- ─────────────────────────────────────────
-- HELPER FUNCTION: generate daily instances
-- Call this nightly to mint the next day's instances from templates.
-- ─────────────────────────────────────────
create or replace function public.generate_daily_instances(target_date date)
returns void as $$
begin
  insert into public.daily_schedule_instances
    (user_id, block_id, date, start_minutes, end_minutes, status)
  select
    sb.user_id,
    sb.id,
    target_date,
    sb.start_minutes,
    sb.end_minutes,
    'pending'
  from public.schedule_blocks sb
  join public.schedule_templates st on st.id = sb.template_id
  where st.is_active = true
    and extract(dow from target_date)::int = any(sb.days_of_week)
  on conflict (block_id, date) do nothing;
end;
$$ language plpgsql security definer;
