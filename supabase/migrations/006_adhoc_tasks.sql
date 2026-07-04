-- Ad-hoc tasks for Today: timed (on timeline) or anytime (tray below)

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
