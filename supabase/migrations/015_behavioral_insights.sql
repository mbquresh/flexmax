-- Applied manually via Supabase SQL Editor.
-- behavioral_insights: stored beliefs written weekly by weekly-insight and
-- injected free at read time. Never edited — new sets supersede old ones.
-- RLS: users read their own; only service_role writes.

create table public.behavioral_insights (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  kind            text not null check (kind in ('causal', 'pattern', 'strength')),
  belief          text not null,
  evidence        text not null,
  suggestion      text,
  related_blocks  text[] not null default '{}',
  rank            integer not null,
  superseded      boolean not null default false,
  generated_at    timestamptz not null default now()
);

create index behavioral_insights_user_active
  on public.behavioral_insights (user_id, generated_at desc)
  where not superseded;

alter table public.behavioral_insights enable row level security;

create policy "users read own insights"
  on public.behavioral_insights for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies for authenticated users.
-- weekly-insight edge function writes via service_role only.
