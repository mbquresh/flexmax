-- 047_insight_corrections.sql
-- Applied manually via Supabase SQL Editor.
--
-- Theory of You: the user can tell the engine a belief is wrong. Insights
-- are superseded every week, so a comment on the row dies before the next
-- call can use it. Corrections are standing facts. disputed_at hides the
-- line immediately. The next weekly-insight generation reads the notes
-- and must not restate a rejected claim.
--
-- Writes go through dispute_insight only. authenticated has no insert on
-- either table — same pattern as record_app_open / swap_instance_times.

alter table public.behavioral_insights
  add column if not exists disputed_at timestamptz;

comment on column public.behavioral_insights.disputed_at is
  'Set when the user rejected this belief. Hides the line until the set is replaced. The correction itself lives on insight_corrections.';

create table if not exists public.insight_corrections (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  insight_id      uuid references public.behavioral_insights(id) on delete set null,
  belief_snapshot text not null,
  note            text not null check (char_length(trim(note)) > 0),
  created_at      timestamptz not null default now()
);

create index if not exists insight_corrections_user_created
  on public.insight_corrections (user_id, created_at desc);

alter table public.insight_corrections enable row level security;

drop policy if exists "own corrections readable" on public.insight_corrections;
create policy "own corrections readable"
  on public.insight_corrections for select
  using (auth.uid() = user_id);

create or replace function public.dispute_insight(
  p_insight_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_belief text;
  v_note text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_note := nullif(trim(p_note), '');
  if v_note is null then
    raise exception 'note required';
  end if;

  select belief into v_belief
  from public.behavioral_insights
  where id = p_insight_id
    and user_id = auth.uid()
    and not superseded
    and disputed_at is null;

  if v_belief is null then
    raise exception 'insight not found';
  end if;

  insert into public.insight_corrections (
    user_id, insight_id, belief_snapshot, note
  ) values (
    auth.uid(), p_insight_id, v_belief, left(v_note, 500)
  );

  update public.behavioral_insights
  set disputed_at = now()
  where id = p_insight_id
    and user_id = auth.uid();
end;
$$;

revoke all on function public.dispute_insight(uuid, text) from public;
grant execute on function public.dispute_insight(uuid, text) to authenticated;
