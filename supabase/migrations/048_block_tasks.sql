-- 048_block_tasks.sql
-- Applied manually via Supabase SQL Editor.
--
-- Structured tasks inside recurring blocks.
--
-- Keyed on (user_id, block_id, date), NOT instance_id. Instances are generated
-- lazily by generate_daily_instances, so a task moved to a future date has no
-- instance row to reference. The block is permanent; the date selects the
-- occurrence. This also means tasks survive swap, reschedule, shrink and
-- restore without any extra work, since none of those change block_id or date.
--
-- daily_schedule_instances.block_id is NOT NULL (001 valid unique(block_id,
-- date)), so the backfill's `is not null` guard is a backstop, not a skip.

create table if not exists public.block_tasks (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  block_id   uuid not null references public.schedule_blocks(id) on delete cascade,
  date       date not null,
  name       text not null,
  done       boolean not null default false,
  position   integer not null default 0,
  created_at timestamptz not null default now(),

  constraint block_tasks_name_not_blank check (length(btrim(name)) > 0)
);

create index if not exists block_tasks_lookup
  on public.block_tasks (user_id, date, block_id);

alter table public.block_tasks enable row level security;

create policy "own block tasks" on public.block_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Backfill existing task_detail into block_tasks.
--
-- done is taken from the instance status. With exactly one task per block this
-- is identity, not inference: if the block completed, its single task completed.
-- Do not extend this reasoning to multi-task blocks.

insert into public.block_tasks (user_id, block_id, date, name, done, position)
select
  i.user_id,
  i.block_id,
  i.date,
  btrim(i.task_detail),
  (i.status = 'completed'),
  0
from public.daily_schedule_instances i
where i.task_detail is not null
  and btrim(i.task_detail) <> ''
  and i.block_id is not null
  and not exists (
    select 1 from public.block_tasks t
    where t.user_id = i.user_id
      and t.block_id = i.block_id
      and t.date = i.date
  );
