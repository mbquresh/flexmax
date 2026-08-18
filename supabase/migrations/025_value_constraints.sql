-- Applied manually via Supabase SQL Editor.
-- CHECK constraints on status and completion_rating. The status set already
-- drifted once ('removed' in code, absent from the original schema comment).
-- NOT VALID so existing rows are not checked and the migration cannot fail on
-- legacy data; all future writes are governed.

-- 025: value constraints. The status set already drifted once ('removed'
-- appears in code but not the original schema comment). NOT VALID skips
-- checking existing rows, so this cannot fail on legacy data; it governs all
-- future writes.
alter table public.daily_schedule_instances
  add constraint status_valid check (
    status in ('pending','active','completed','missed','skipped',
               'unaccounted','removed','rescheduled')
  ) not valid;

alter table public.daily_schedule_instances
  add constraint rating_valid check (
    completion_rating is null
    or completion_rating in ('crushed','partial','pulled_away')
  ) not valid;
