-- 038_miss_reason_denominator.sql
-- Applied manually via Supabase SQL Editor.
--
-- miss_reasons reported tag counts with no base. Three misses tagged
-- 'Low energy' means something very different out of four misses than out of
-- forty, and the narrator had no way to tell which. A count without its
-- denominator is the same defect the 027 swap_drift audit found.
--
-- Adds a sibling 'miss_totals' key rather than restructuring 'miss_reasons',
-- so the edit anchors on ONE distinctive line instead of a nine-line block.
-- Following 033's precedent, this rewrites the deployed definition in place so
-- the other ~300 lines cannot drift -- but unlike 033 it asserts every anchor
-- first and raises rather than silently doing nothing.
--
-- WHY THE SHARE IS NOT A QUALITY SCORE: miss_reason_tag is written only by the
-- evening close-today sweep. A user who deals with a miss during the day
-- writes reflection_why and leaves no tag. So tagged_misses / total_misses is
-- the share of misses left unresolved until evening -- a LOW share means the
-- user handled misses promptly, which is engagement, not missing data.

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
    raise exception '038: public.get_behavior_evidence not found';
  end if;

  src := pg_get_functiondef(fn_oid);

  -- Guard: refuse to run twice.
  if strpos(src, $a$'miss_totals'$a$) > 0 then
    raise exception '038: miss_totals already present; migration already applied';
  end if;

  ----------------------------------------------------------------
  -- 1. Insert miss_totals immediately before the miss_reasons key
  ----------------------------------------------------------------
  if strpos(src, $a$    'miss_reasons', ($a$) = 0 then
    raise exception '038: miss_reasons anchor not found -- function has drifted';
  end if;

  before := length(src);
  src := replace(
    src,
    $a$    'miss_reasons', ($a$,
    $a$    -- The denominator for miss_reasons. Tag counts alone are unreadable:
    -- 3 of 4 and 3 of 40 are different findings. See the caveat below for why
    -- a low tagged share is engagement rather than missing data.
    'miss_totals', jsonb_build_object(
      'total_misses', (
        select count(*) from base where status in ('missed','unaccounted')
      ),
      'tagged_misses', (
        select count(*) from base where miss_reason_tag is not null
      )
    ),

    'miss_reasons', ($a$
  );
  if length(src) = before then
    raise exception '038: miss_totals insert made no change';
  end if;

  ----------------------------------------------------------------
  -- 2. Teach the narrator how to read it
  ----------------------------------------------------------------
  if strpos(src, $a$miss_reasons are TAPPED PRESETS$a$) = 0 then
    raise exception '038: miss_reasons caveat anchor not found';
  end if;

  before := length(src);
  src := replace(
    src,
    $a$'miss_reasons are TAPPED PRESETS, not the user''s own words. Cite them as counts only; never quote them as something the user wrote.',$a$,
    $a$'miss_reasons are TAPPED PRESETS, not the user''s own words. Cite them as counts only; never quote them as something the user wrote.',
        'miss_reasons describes END-OF-DAY misses only, never misses in general. The tag is written solely by the evening close-today sweep; a user who deals with a miss during the day writes reflection_why and leaves no tag. ALWAYS read the counts against miss_totals, never alone. If tagged_misses is a small share of total_misses, say the tags cover only part of the picture, or omit them. A LOW share means the user resolved most misses promptly, which is ENGAGEMENT -- never describe it as missing data, avoidance, poor tracking, or a failure to reflect.',$a$
  );
  if length(src) = before then
    raise exception '038: caveat insert made no change';
  end if;

  execute src;
end;
$outer$;

grant execute on function public.get_behavior_evidence(uuid) to service_role;
