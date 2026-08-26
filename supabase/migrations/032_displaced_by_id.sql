-- 032_displaced_by_id.sql
-- Applied manually via Supabase SQL Editor.
--
-- Reschedule collision is allowed: on a genuinely full day, placing a block
-- MEANS something else does not happen, and forcing the user to name the
-- sacrifice is the behavioral point. But overlapping rows are never written --
-- two blocks at the same time guarantees a miss that says nothing about the
-- person, which degrades the ledger.
--
-- Displaced blocks are written 'removed', not 'skipped'. 'skipped' is in
-- ACCOUNTED (stats.ts) and means "I chose not to do this"; a displaced block
-- was not declined, it lost its slot. 'removed' is in EXCLUDED and is filtered
-- out of Today at the query level.
--
-- Consequence: 'removed' now has two meanings -- user-deleted and displaced --
-- separated only by this column.

alter table public.daily_schedule_instances
  add column if not exists displaced_by_id uuid
    references public.daily_schedule_instances(id) on delete set null;

comment on column public.daily_schedule_instances.displaced_by_id is
  'Set when this block was removed to make room for another instance during a recovery reschedule. Distinguishes "I deleted this" from "something else took its place." Null for ordinary removals.';

create index if not exists idx_instances_displaced_by
  on public.daily_schedule_instances (displaced_by_id)
  where displaced_by_id is not null;
