-- 039_block_recency.sql
-- Applied manually via Supabase SQL Editor.
--
-- The evidence pack was TIME-FLAT. block_stats aggregates 30 days with no
-- recency signal, so a pattern that stopped four weeks ago is indistinguishable
-- from one happening today -- and the narrator described a July habit as
-- "this month". It also had no notion of block AGE: the tracked CTE admits any
-- block with 3 resolved instances at 25%, which a brand-new block reaches in
-- days, so a block in its first week was diagnosed as having "no functioning
-- slot" and prescribed restructuring.
--
-- Adds a sibling 'block_recency' key rather than restructuring block_stats, so
-- the edit anchors on ONE distinctive line. Following 033/038, this rewrites
-- the deployed definition in place and asserts every anchor first.

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
    raise exception '039: public.get_behavior_evidence not found';
  end if;

  src := pg_get_functiondef(fn_oid);

  if strpos(src, $a$'block_recency'$a$) > 0 then
    raise exception '039: block_recency already present; migration already applied';
  end if;

  ----------------------------------------------------------------
  -- 1. Insert block_recency immediately before block_stats
  ----------------------------------------------------------------
  if strpos(src, $a$    'block_stats', ($a$) = 0 then
    raise exception '039: block_stats anchor not found -- function has drifted';
  end if;

  before := length(src);
  src := replace(
    src,
    $a$    'block_stats', ($a$,
    $a$    -- WHEN a pattern happened, and how long the block has existed.
    -- block_stats alone cannot tell a habit that ended a month ago from one
    -- happening now, and cannot tell a settled block from a new one.
    'block_recency', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.name), '[]'::jsonb)
      from (
        select name,
               min(date)            as first_seen,
               count(distinct date) as days_tracked,
               count(*) filter (
                 where date >= v_today - 7 and status = 'completed'
               ) as completed_7d,
               count(*) filter (
                 where date >= v_today - 7 and status in ('missed','unaccounted')
               ) as failed_7d,
               count(*) filter (
                 where date < v_today - 7 and status = 'completed'
               ) as completed_prior,
               count(*) filter (
                 where date < v_today - 7 and status in ('missed','unaccounted')
               ) as failed_prior
        from base
        group by name
      ) t
    ),

    'block_stats', ($a$
  );
  if length(src) = before then
    raise exception '039: block_recency insert made no change';
  end if;

  ----------------------------------------------------------------
  -- 2. Teach the narrator to use it
  ----------------------------------------------------------------
  if strpos(src, $a$Blocks the user does not track regularly are excluded entirely.$a$) = 0 then
    raise exception '039: caveat anchor not found';
  end if;

  before := length(src);
  src := replace(
    src,
    $a$'Blocks the user does not track regularly are excluded entirely.',$a$,
    $a$'Blocks the user does not track regularly are excluded entirely.',
        'block_stats is a FLAT 30-day total and carries no sense of when anything happened. Before describing any pattern as current, check block_recency. If the failures sit in failed_prior and not in failed_7d, the pattern has STOPPED -- describe it in the past tense as something the user has already changed, or leave it out. Never write "this month", "lately" or "recently" about a pattern absent from the last 7 days. A habit the user has already fixed, reported back as current, is the fastest way to lose their trust in everything else here.',
        'block_recency.days_tracked and first_seen say how long a block has EXISTED, not how well it is going. A block with few days_tracked is new and still settling. Never diagnose a new block as broken, never say it has no working slot, and never prescribe restructuring the schedule around it -- say plainly that it is new and has not landed yet. The tracked filter admits any block with 3 resolved instances, which a block reaches in its first days, so a low completion count on a young block is the absence of evidence rather than evidence of failure.',$a$
  );
  if length(src) = before then
    raise exception '039: caveat insert made no change';
  end if;

  execute src;
end;
$outer$;

grant execute on function public.get_behavior_evidence(uuid) to service_role;
