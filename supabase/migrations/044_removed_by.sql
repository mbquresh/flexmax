-- 044_removed_by.sql
-- Applied manually via Supabase SQL Editor.
--
-- status='removed' was written by four different paths — swipe-to-remove,
-- recovery displacement, block archive, and away periods — with nothing to
-- tell them apart. Archive restore and away-period cancel then cleared every
-- tombstone, which resurrected blocks the user had removed by hand.
--
-- Client writers set this explicitly. Null on rows predating the column.

alter table public.daily_schedule_instances
  add column if not exists removed_by text;

comment on column public.daily_schedule_instances.removed_by is
  'Provenance of status=removed: user, displacement, archive, or away. Null on rows predating this column.';
