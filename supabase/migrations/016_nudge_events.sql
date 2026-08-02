-- Applied manually via Supabase SQL Editor.
-- Nudge telemetry. Local notifications fire without the app running, so rows
-- are written at SCHEDULE time; "fired" is inferred as scheduled_for < now().
-- unique(instance_id, kind) makes rescheduling an upsert, never a duplicate.

create table public.nudge_events (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  instance_id     uuid not null references public.daily_schedule_instances(id) on delete cascade,
  kind            text not null,
  scheduled_for   timestamptz not null,
  tapped_at       timestamptz,
  created_at      timestamptz not null default now(),

  unique (instance_id, kind)
);

create index nudge_events_user_scheduled
  on public.nudge_events (user_id, scheduled_for desc);

alter table public.nudge_events enable row level security;

create policy "users manage own nudge events"
  on public.nudge_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
