-- 041_tracked_interval_aware.sql
-- Applied manually via Supabase SQL Editor.
--
-- The tracked CTE required 3 resolved instances in 30 days. That floor was set
-- when every block was weekly-or-more-frequent. 040 introduced interval_weeks,
-- so a biweekly block on one or two days a week produces about 2 instances a
-- month and can NEVER reach the floor -- it would be silently absent from
-- block_stats, quality_drift, cannibalization and the pre-block nudge, with
-- nothing anywhere telling the user their block is invisible.
--
-- The floor now scales to what the block can actually produce:
--
--   least(3, greatest(2, count(*)))
--
--   21 scheduled -> needs 3   (unchanged for every existing block)
--    2 scheduled -> needs 2   (both must be resolved)
--    1 scheduled -> needs 2   -> impossible, correctly excluded
--
-- Two resolved instances is the hard minimum regardless of cadence. A single
-- observation must never enter the evidence pack.
--
-- The 25% RESOLUTION RATE condition is untouched: it is already a ratio and so
-- already cadence-independent.

do $outer$
declare
  fn_oid oid;
  src    text;
  before int;
begin
  select p.oid into fn_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_behavior_evidence';

  if fn_oid is null then
    raise exception '041: public.get_behavior_evidence not found';
  end if;

  src := pg_get_functiondef(fn_oid);

  if strpos(src, $a$least(3, greatest(2, count(*)))$a$) > 0 then
    raise exception '041: already applied';
  end if;

  ----------------------------------------------------------------
  -- 1. Scale the tracked floor to the block's cadence
  ----------------------------------------------------------------
  if strpos(src, $a$('completed','missed')) >= 3$a$) = 0 then
    raise exception '041: tracked floor anchor not found -- function has drifted';
  end if;

  before := length(src);
  src := replace(
    src,
    $a$('completed','missed')) >= 3$a$,
    $a$('completed','missed')) >= least(3, greatest(2, count(*)))$a$
  );
  if length(src) = before then
    raise exception '041: tracked floor replace made no change';
  end if;

  ----------------------------------------------------------------
  -- 2. Tell the narrator that thin can mean INFREQUENT, not new
  ----------------------------------------------------------------
  if strpos(src, $a$block_recency.days_tracked and first_seen$a$) = 0 then
    raise exception '041: block_recency caveat anchor not found';
  end if;

  before := length(src);
  src := replace(
    src,
    $a$'block_recency.days_tracked and first_seen$a$,
    $a$'A low days_tracked has TWO possible meanings and first_seen tells them apart. A recent first_seen means the block is new. An older first_seen with few days_tracked means the block is INFREQUENT by design -- it may run every other week, or on one day a week, or within a fixed date range. Never treat an infrequent block as neglected, inconsistent, or poorly tracked. Two completions out of two scheduled is perfect adherence, not thin data, and must be described that way.',
        'block_recency.days_tracked and first_seen$a$
  );
  if length(src) = before then
    raise exception '041: caveat insert made no change';
  end if;

  execute src;
end;
$outer$;

grant execute on function public.get_behavior_evidence(uuid) to service_role;
