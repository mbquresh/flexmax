-- Applied manually via Supabase SQL Editor.
-- Audit trail for daily_schedule_instances time changes.
-- Trigger-based so swap_instance_times (008) is untouched — the unified
-- anchor-rebuild swap logic must not be modified.
-- txid groups both halves of a swap into one logical event.

-- Audit trail for instance time changes. Feeds v2b behavioral learning:
-- "this user always drags deep work later" is only knowable if we keep history.

create table public.instance_time_changes (
  id           bigserial primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  instance_id  uuid not null references public.daily_schedule_instances(id) on delete cascade,
  block_id     uuid not null references public.schedule_blocks(id) on delete cascade,
  date         date not null,
  old_start    integer not null,
  old_end      integer not null,
  new_start    integer not null,
  new_end      integer not null,
  txid         bigint not null,   -- groups both halves of a swap
  changed_at   timestamptz not null default now()
);

create index instance_time_changes_user_recent
  on public.instance_time_changes (user_id, changed_at desc);

create index instance_time_changes_block
  on public.instance_time_changes (user_id, block_id);

alter table public.instance_time_changes enable row level security;

-- Users may READ their own history (weekly recap will want this).
-- No insert/update/delete policies: history must not be forgeable or erasable.
-- The trigger below is SECURITY DEFINER, so it bypasses RLS to write.
create policy "read own time changes"
  on public.instance_time_changes for select
  using (auth.uid() = user_id);

create or replace function public.log_instance_time_change()
returns trigger as $$
begin
  if (old.start_minutes is distinct from new.start_minutes)
     or (old.end_minutes is distinct from new.end_minutes) then
    insert into public.instance_time_changes (
      user_id, instance_id, block_id, date,
      old_start, old_end, new_start, new_end, txid
    ) values (
      new.user_id, new.id, new.block_id, new.date,
      old.start_minutes, old.end_minutes, new.start_minutes, new.end_minutes,
      txid_current()
    );
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger instance_time_change_audit
  after update on public.daily_schedule_instances
  for each row
  execute function public.log_instance_time_change();
