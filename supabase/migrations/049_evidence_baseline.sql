-- 049_evidence_baseline.sql
-- DOCUMENTATION SNAPSHOT — do not run.
--
-- Captured from the live database via pg_get_functiondef on 2026-09-09.
-- No migration file held the current get_behavior_evidence body: 033 and 038
-- (and later in-place rewrites 039, 041) rewrote the deployed definition.
-- This file is the baseline for 050_block_coupling.sql.
--
-- Applied? No. This is not a schema change. Pasting it into the SQL Editor
-- is a no-op if the live definition already matches.

CREATE OR REPLACE FUNCTION public.get_behavior_evidence(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  result  jsonb;
  v_today date;
begin
  select (now() at time zone p.timezone)::date into v_today
  from profiles p where p.id = p_user_id;

  with tracked as (
    select i.block_id
    from daily_schedule_instances i
    where i.user_id = p_user_id
      and i.date >= v_today - 30
      and i.date < v_today
    group by i.block_id
    having count(*) filter (where i.status in ('completed','missed')) >= least(3, greatest(2, count(*)))
       and count(*) filter (where i.status in ('completed','missed'))::numeric
           / count(*) >= 0.25
  ),
  engaged as (
    select i.date
    from daily_schedule_instances i
    where i.user_id = p_user_id
      and i.status in ('completed','missed')
      and i.date < v_today
    group by i.date
  ),
  base as (
    select i.id, i.date, i.status, i.block_id, i.start_minutes,
           i.reflection_why, i.reflection_improve, i.completion_rating,
           i.miss_reason_tag, i.quality_reason_tag, b.name
    from daily_schedule_instances i
    join schedule_blocks b on b.id = i.block_id
    join tracked t         on t.block_id = i.block_id
    join engaged e         on e.date = i.date
    where i.user_id = p_user_id
      and i.date >= v_today - 30
      and i.date < v_today
  )
  select jsonb_build_object(

    -- WHEN a pattern happened, and how long the block has existed.
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

    'block_stats', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.failed desc), '[]'::jsonb)
      from (
        select name,
               count(*) filter (where status = 'completed')   as completed,
               count(*) filter (where status = 'missed')      as missed,
               count(*) filter (where status = 'unaccounted') as unaccounted,
               count(*) filter (where status in ('missed','unaccounted')) as failed,
               count(*) as total
        from base group by name having count(*) >= 3
      ) t
    ),

    'reflections', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'date', date, 'block', name, 'status', status,
               'why', reflection_why, 'improve', reflection_improve
             ) order by date desc), '[]'::jsonb)
      from base
      where reflection_why is not null or reflection_improve is not null
    ),

    'weekly_trend', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.week_start), '[]'::jsonb)
      from (
        select date_trunc('week', date)::date as week_start,
               count(*) filter (where status = 'completed') as completed,
               count(*) filter (where status in ('missed','unaccounted')) as failed,
               count(distinct date) as days_with_data
        from base group by 1
        having count(distinct date) >= 4
      ) t
    ),

    'day_shape', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.date desc), '[]'::jsonb)
      from (
        select date,
               count(*) filter (where status = 'completed') as completed,
               count(*) filter (where status in ('missed','unaccounted')) as failed,
               string_agg(name, ', ') filter (where status in ('missed','unaccounted')) as failed_blocks
        from base group by date
      ) t
    ),

    -- SWAP DRIFT — NET displacement per instance, not per edit event.
    --
    -- Every edit to one instance collapses to a single figure: the ORIGINAL
    -- scheduled start (earliest row's old_start) versus the FINAL resting
    -- start (latest row's new_start). Instances that end where they began are
    -- dropped entirely.
    --
    -- Duration-only edits (start unchanged, end moved) net to zero and are
    -- correctly excluded — swap_drift describes WHEN a block sits, not how
    -- long it runs. That matches the pre-existing behaviour, which also read
    -- start only.
    --
    -- times_moved now counts DAYS THE BLOCK ENDED UP ELSEWHERE, not edits.
    -- The >= 2 threshold is correspondingly stricter than it was.
    'swap_drift', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      from (
        select name,
               count(*) as times_moved,
               count(*) filter (where net > 0)  as moved_later,
               count(*) filter (where net < 0)  as moved_earlier,
               round(avg(net)  filter (where net > 0))  as avg_later_by,
               round(avg(-net) filter (where net < 0))  as avg_earlier_by
        from (
          select b.name,
                 c.instance_id,
                 (array_agg(c.new_start order by c.changed_at desc, c.id desc))[1]
                 - (array_agg(c.old_start order by c.changed_at, c.id))[1] as net
          from instance_time_changes c
          join schedule_blocks b on b.id = c.block_id
          join tracked tr        on tr.block_id = c.block_id
          join daily_schedule_instances i on i.id = c.instance_id
          where c.user_id = p_user_id
            and c.changed_at >= now() - interval '30 days'
            and i.status in ('completed','missed')
          group by b.name, c.instance_id
        ) moves
        where net <> 0
        group by name
        having count(*) >= 2
      ) t
    ),

    'quality_drift', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.recent_poor desc), '[]'::jsonb)
      from (
        select name,
               count(*) filter (where completion_rating is not null) as rated,
               count(*) filter (where completion_rating = 'crushed') as crushed,
               count(*) filter (where completion_rating = 'partial') as partial,
               count(*) filter (where completion_rating = 'pulled_away') as pulled_away,
               count(*) filter (
                 where completion_rating in ('partial','pulled_away')
                   and rn <= 7
               ) as recent_poor,
               count(*) filter (where rn <= 7) as recent_rated
        from (
          select name, completion_rating, date, quality_reason_tag,
                 row_number() over (partition by name order by date desc) as rn
          from base
          where completion_rating is not null
        ) x
        group by name
        having count(*) >= 3
      ) t
    ),

    -- Why a block is degrading, captured at the check-in that crossed the
    -- threshold (4 of the last 7 rated instances poor). Mirrors miss_reasons
    -- exactly: tapped presets, countable, never quotable.
    'quality_reasons', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.count desc), '[]'::jsonb)
      from (
        select quality_reason_tag as tag, count(*) as count,
               string_agg(distinct name, ', ') as blocks
        from base
        where quality_reason_tag is not null
        group by quality_reason_tag
      ) t
    ),

    'cannibalization', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.lift desc), '[]'::jsonb)
      from (
        select trigger_name, sacrificed_name,
               count(*) as mixed_days,
               count(*) filter (where trigger_won) as trigger_won_days,
               count(*) filter (where trigger_won and sacrificed_failed) as won_and_sacrificed,
               round(100.0 * count(*) filter (where trigger_won and sacrificed_failed)
                     / nullif(count(*) filter (where trigger_won), 0))::int
                 as pct_when_trigger_wins,
               round(100.0 * count(*) filter (where not trigger_won and sacrificed_failed)
                     / nullif(count(*) filter (where not trigger_won), 0))::int
                 as pct_otherwise,
               round(100.0 * count(*) filter (where trigger_won and sacrificed_failed)
                       / nullif(count(*) filter (where trigger_won), 0)
                     - 100.0 * count(*) filter (where not trigger_won and sacrificed_failed)
                       / nullif(count(*) filter (where not trigger_won), 0))::int
                 as lift
        from (
          select x.date,
                 x.name as trigger_name,
                 (x.status = 'completed') as trigger_won,
                 y.name as sacrificed_name,
                 (y.status in ('missed','unaccounted')) as sacrificed_failed
          from base x
          join base y
            on y.date = x.date
           and y.name <> x.name
           and x.start_minutes < y.start_minutes
          join (
            select date from base group by date
            having count(*) filter (where status = 'completed') >= 2
               and count(*) filter (where status in ('missed','unaccounted')) >= 2
          ) md on md.date = x.date
        ) pairs
        group by trigger_name, sacrificed_name
        having count(*) >= 8
           and count(*) filter (where trigger_won) >= 4
           and count(*) filter (where not trigger_won) >= 4
           and round(100.0 * count(*) filter (where trigger_won and sacrificed_failed)
                       / nullif(count(*) filter (where trigger_won), 0)
                     - 100.0 * count(*) filter (where not trigger_won and sacrificed_failed)
                       / nullif(count(*) filter (where not trigger_won), 0)) >= 25
      ) t
    ),

    'nudge_outcomes', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.fired desc), '[]'::jsonb)
      from (
        select b.name,
               count(*) as fired,
               count(*) filter (where n.response = 'wrapping_up') as said_wrapping_up,
               count(*) filter (where n.response = 'more_time')   as said_more_time,
               count(*) filter (where n.response is null)         as no_response,
               count(*) filter (where i.status = 'completed')     as then_completed,
               count(*) filter (where n.response is not null)     as responded_total,
               count(*) filter (where n.response is not null and i.status = 'completed')
                 as completed_after_responding
        from nudge_events n
        join daily_schedule_instances i on i.id = n.instance_id
        join schedule_blocks b on b.id = i.block_id
        where n.user_id = p_user_id
          and n.scheduled_for < now()
          and i.date < v_today
        group by b.name
        having count(*) >= 3
      ) t
    ),

    -- The denominator for miss_reasons. Tag counts alone are unreadable:
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

    'miss_reasons', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.count desc), '[]'::jsonb)
      from (
        select miss_reason_tag as tag, count(*) as count,
               string_agg(distinct name, ', ') as blocks
        from base
        where miss_reason_tag is not null
        group by miss_reason_tag
      ) t
    ),

    'data_quality', jsonb_build_object(
      'engaged_days',     (select count(*) from engaged where date >= v_today - 30),
      'reflection_count', (select count(*) from base
                           where reflection_why is not null
                              or reflection_improve is not null),
      'window_days', 30,
      'excludes_today', true,
      'caveats', jsonb_build_array(
        'start_minutes and end_minutes are SCHEDULED template times, not records of when anything happened. Never claim a block "ran until" a time.',
        'unaccounted = no user acknowledgement at all. Disengagement signal, weaker than a confirmed miss. Describe as "never checked in", never as "you failed this".',
        'Blocks the user does not track regularly are excluded entirely.',
        'block_stats is a FLAT 30-day total and carries no sense of when anything happened. Before describing any pattern as current, check block_recency. If the failures sit in failed_prior and not in failed_7d, the pattern has STOPPED -- describe it in the past tense as something the user has already changed, or leave it out. Never write "this month", "lately" or "recently" about a pattern absent from the last 7 days. A habit the user has already fixed, reported back as current, is the fastest way to lose their trust in everything else here.',
        'A low days_tracked has TWO possible meanings and first_seen tells them apart. A recent first_seen means the block is new. An older first_seen with few days_tracked means the block is INFREQUENT by design -- it may run every other week, or on one day a week, or within a fixed date range. Never treat an infrequent block as neglected, inconsistent, or poorly tracked. Two completions out of two scheduled is perfect adherence, not thin data, and must be described that way.',
        'block_recency.days_tracked and first_seen say how long a block has EXISTED, not how well it is going. A block with few days_tracked is new and still settling. Never diagnose a new block as broken, never say it has no working slot, and never prescribe restructuring the schedule around it -- say plainly that it is new and has not landed yet. The tracked filter admits any block with 3 resolved instances, which a block reaches in its first days, so a low completion count on a young block is the absence of evidence rather than evidence of failure.',
        'Today is excluded and partial weeks are omitted. Never describe a trend from an incomplete period.',
        'Judge trends from weekly_trend and day_shape (whole days), never from a single block type. A day where the mornings landed can still be a day that collapsed.',
        'quality_drift describes the BLOCK''s trajectory, never the user''s effort. Ratings are crushed / partial / pulled_away. Say "landing at half strength", never "you have not been focused".',
        'cannibalization measures one block SUCCEEDING while a later block fails, on mixed days only, time-ordered. It is CORRELATION, not proof of a trade. State it as co-occurrence ("these two move together"), and only call it a trade if the user''s own reflections independently say so.',
        'miss_reasons are TAPPED PRESETS, not the user''s own words. Cite them as counts only; never quote them as something the user wrote.',
        'miss_reasons describes END-OF-DAY misses only, never misses in general. The tag is written solely by the evening close-today sweep; a user who deals with a miss during the day writes reflection_why and leaves no tag. ALWAYS read the counts against miss_totals, never alone. If tagged_misses is a small share of total_misses, say the tags cover only part of the picture, or omit them. A LOW share means the user resolved most misses promptly, which is ENGAGEMENT -- never describe it as missing data, avoidance, poor tracking, or a failure to reflect.',
        'quality_reasons are TAPPED PRESETS recorded on a COMPLETED block that was degrading, not on a miss. Cite them as counts only; never quote them as something the user wrote, and never describe the block as missed.',
        'quality_drift recent_poor/recent_rated use a 7-instance window, matching the in-app prompt threshold. Do not describe it as "this week" — it is the last 7 rated sessions of that block, which may span more or less than a week.',
        'nudge_outcomes: a local notification fires whether or not the app is running, and iOS does not report delivery. "fired" means scheduled and elapsed, never confirmed seen.',
        'swap_drift.times_moved counts DAYS A BLOCK ENDED UP IN A DIFFERENT SLOT than it was scheduled — not how many times the user touched it. Adjustments that return a block to its original time are excluded entirely. Never describe these figures as the user "fiddling with", "rearranging", or "constantly changing" their schedule; that is a characterisation the data does not support and this product does not make.'
      )
    )

  ) into result;
  return result;
end;
$function$
