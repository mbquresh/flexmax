-- 051_block_coupling_table.sql
-- Applied manually via Supabase SQL Editor. Do not run `supabase db push`.
--
-- Persists the qualifying pairs from get_behavior_evidence.block_coupling
-- so Today can pick a preempt target from a keystone that has already
-- failed, without recomputing the evidence pack on every load.
-- Written by weekly-insight via service_role only.

create table if not exists public.block_coupling (
  user_id          uuid not null references public.profiles(id) on delete cascade,
  trigger_block_id uuid not null references public.schedule_blocks(id) on delete cascade,
  later_block_id   uuid not null references public.schedule_blocks(id) on delete cascade,
  relation         text not null check (relation in ('keystone','cannibalization')),
  lift             int  not null,
  pct_when_won     int  not null,
  pct_when_lost    int  not null,
  days             int  not null,
  n_won            int  not null,
  n_lost           int  not null,
  persistence      text not null,
  computed_at      timestamptz not null default now(),
  primary key (user_id, trigger_block_id, later_block_id)
);

alter table public.block_coupling enable row level security;

drop policy if exists "users read own coupling" on public.block_coupling;
create policy "users read own coupling" on public.block_coupling
  for select using (auth.uid() = user_id);
-- Written by the weekly-insight edge function via service_role only.

-- Optional one-shot seed so preempt can be tested before the next weekly
-- generation. Replace YOUR-USER-ID. weekly-insight keeps this in sync after
-- a successful generate.
--
-- insert into public.block_coupling (
--   user_id, trigger_block_id, later_block_id, relation, lift,
--   pct_when_won, pct_when_lost, days, n_won, n_lost, persistence
-- )
-- select
--   'YOUR-USER-ID'::uuid,
--   (c->>'trigger_id')::uuid,
--   (c->>'later_id')::uuid,
--   c->>'relation',
--   (c->>'lift')::int,
--   (c->>'pct_when_won')::int,
--   (c->>'pct_when_lost')::int,
--   (c->>'days')::int,
--   (c->>'n_won')::int,
--   (c->>'n_lost')::int,
--   c->>'persistence'
-- from jsonb_array_elements(
--   public.get_behavior_evidence('YOUR-USER-ID') -> 'block_coupling'
-- ) c
-- on conflict (user_id, trigger_block_id, later_block_id) do update set
--   relation      = excluded.relation,
--   lift          = excluded.lift,
--   pct_when_won  = excluded.pct_when_won,
--   pct_when_lost = excluded.pct_when_lost,
--   days          = excluded.days,
--   n_won         = excluded.n_won,
--   n_lost        = excluded.n_lost,
--   persistence   = excluded.persistence,
--   computed_at   = now();
