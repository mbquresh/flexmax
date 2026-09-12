-- 054_discriminating_tests.sql
-- Applied manually via Supabase SQL Editor. Do not run `supabase db push`.
--
-- Rewritten from live get_behavior_evidence (050 + 053). Adds `qualified`
-- (the narrator's rule-9 filter, in SQL) and points `keystones` at it so
-- a trigger whose pairs were all rejected cannot appear as a keystone.
-- Discriminating tests (anchor, domain, gap) run only on qualified pairs
-- and emit surviving / ruled_out / untested in SQL. The narrator reports
-- those lists; it never invents an explanation. Do not lower floors.

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
  ),
  -- 60-day window for coupling only. Joined to the existing 30-day tracked
  -- set so a block that is not currently tracked cannot appear. Today stays
  -- excluded. unaccounted is kept distinct from missed at every later step.
  couple_base as (
    select i.date, i.status, i.block_id, i.start_minutes, i.end_minutes,
           b.name, b.category
    from daily_schedule_instances i
    join schedule_blocks b on b.id = i.block_id
    join tracked t         on t.block_id = i.block_id
    where i.user_id = p_user_id
      and i.date >= v_today - 60
      and i.date < v_today
      and i.status in ('completed','missed','unaccounted')
  ),
  -- Day-level control. Replaces the old mixed-day restriction.
  -- Excluding data was the wrong fix for a confound; the right fix is to ship
  -- the confound alongside the finding so the narrator can see it. If the rest
  -- of the day moves as much as the pair does, it is whole-day collapse, not a
  -- specific relationship between these two blocks.
  day_stats as (
    select date,
           count(*) as day_total,
           count(*) filter (where status in ('missed','unaccounted')) as day_failed
    from couple_base
    group by date
  ),
  pairs as (
    select x.date,
           x.block_id as trigger_id, x.name as trigger_name,
           y.block_id as later_id,   y.name as later_name,
           (x.status = 'completed')                    as trigger_won,
           (y.status in ('missed','unaccounted'))      as later_failed,
           (y.status = 'unaccounted')                  as later_unaccounted,
           (ds.day_failed
              - (case when x.status in ('missed','unaccounted') then 1 else 0 end)
              - (case when y.status in ('missed','unaccounted') then 1 else 0 end)
           )::numeric / nullif(ds.day_total - 2, 0)    as day_rest_fail_rate,
           (x.date >= v_today - 30)                    as recent,
           x.end_minutes                               as trigger_end,
           y.start_minutes                             as later_start,
           x.category                                  as trigger_category,
           y.category                                  as later_category
    from couple_base x
    join couple_base y
      on y.date = x.date
     and y.block_id <> x.block_id
     and x.start_minutes < y.start_minutes
    join day_stats ds on ds.date = x.date
  ),
  agg as (
    select trigger_id, trigger_name, later_id, later_name, recent,
           count(*)                                        as days,
           count(*) filter (where trigger_won)             as n_won,
           count(*) filter (where not trigger_won)         as n_lost,
           count(*) filter (where later_unaccounted)       as later_unaccounted_days,
           count(*) filter (where trigger_won and later_failed)     as n_won_later_failed,
           count(*) filter (where not trigger_won and later_failed) as n_lost_later_failed,
           round(100.0 * count(*) filter (where trigger_won and later_failed)
                 / nullif(count(*) filter (where trigger_won), 0))::int      as pct_when_won,
           round(100.0 * count(*) filter (where not trigger_won and later_failed)
                 / nullif(count(*) filter (where not trigger_won), 0))::int  as pct_when_lost,
           round(100.0 * avg(day_rest_fail_rate) filter (where trigger_won))::int     as day_rest_when_won,
           round(100.0 * avg(day_rest_fail_rate) filter (where not trigger_won))::int as day_rest_when_lost
    from pairs
    group by 1,2,3,4,5
  ),
  coupling as (
    select r.trigger_id, r.trigger_name, r.later_id, r.later_name,
           r.days, r.n_won, r.n_lost,
           r.n_won_later_failed, r.n_lost_later_failed,
           r.pct_when_won, r.pct_when_lost,
           (r.pct_when_won - r.pct_when_lost)                     as lift,
           (r.day_rest_when_won - r.day_rest_when_lost)           as day_baseline_shift,
           r.later_unaccounted_days,
           case
             when r.pct_when_won < r.pct_when_lost then 'keystone'
             else 'cannibalization'
           end                                                    as relation,
           p.pct_when_won - p.pct_when_lost                       as prior_lift,
           case
             when p.days is null or p.n_won < 4 or p.n_lost < 4 then 'single_window'
             when sign(p.pct_when_won - p.pct_when_lost)
                  = sign(r.pct_when_won - r.pct_when_lost)
                  and abs(p.pct_when_won - p.pct_when_lost) >= 15 then 'confirmed'
             else 'contradicted'
           end                                                    as persistence
    from agg r
    left join agg p
      on p.trigger_id = r.trigger_id and p.later_id = r.later_id and p.recent = false
    where r.recent = true
      and r.days  >= 10
      and r.n_won >= 6
      and r.n_lost >= 6
      and abs(r.pct_when_won - r.pct_when_lost) >= 30
  ),
  -- Narrator rule 9, in SQL. Tests and keystones read this; block_coupling
  -- still emits the unfiltered set so the table and the pack stay aligned.
  qualified as (
    select * from coupling
    where persistence = 'confirmed'
      and abs(day_baseline_shift) * 2 < abs(lift)
      and (n_won_later_failed + n_lost_later_failed) > later_unaccounted_days * 2
  ),
  -- Anchor: most reliable early block from the 30-day base. Highest
  -- completion rate among blocks that start before the trigger and have
  -- at least 15 tracked days. Picked per trigger, never hard-coded.
  trigger_start as (
    select q.trigger_id, min(cb.start_minutes) as start_minutes
    from qualified q
    join couple_base cb on cb.block_id = q.trigger_id
    group by q.trigger_id
  ),
  early_block_rates as (
    select b.block_id, b.name,
           min(b.start_minutes) as start_minutes,
           count(*) as days,
           (count(*) filter (where b.status = 'completed'))::numeric
             / nullif(count(*), 0) as completion_rate
    from base b
    group by b.block_id, b.name
    having count(*) >= 15
  ),
  pair_anchor as (
    select distinct on (q.trigger_id)
           q.trigger_id,
           e.block_id as anchor_id,
           e.name as anchor_name,
           e.days as anchor_days
    from qualified q
    join trigger_start ts on ts.trigger_id = q.trigger_id
    join early_block_rates e
      on e.block_id <> q.trigger_id
     and e.start_minutes < ts.start_minutes
    order by q.trigger_id, e.completion_rate desc, e.start_minutes, e.name
  ),
  anchored_days as (
    select p.trigger_id, p.later_id,
           p.trigger_won, p.later_failed,
           pa.anchor_name, pa.anchor_days
    from pairs p
    join pair_anchor pa on pa.trigger_id = p.trigger_id
    join couple_base ac
      on ac.date = p.date
     and ac.block_id = pa.anchor_id
     and ac.status = 'completed'
    where p.recent
  ),
  anchored_agg as (
    select trigger_id, later_id,
           max(anchor_name) as anchor_name,
           max(anchor_days) as anchor_days,
           count(*) filter (where trigger_won) as n_won,
           count(*) filter (where not trigger_won) as n_lost,
           round(100.0 * count(*) filter (where trigger_won and later_failed)
                 / nullif(count(*) filter (where trigger_won), 0))::int
             as pct_when_won_anchored,
           round(100.0 * count(*) filter (where not trigger_won and later_failed)
                 / nullif(count(*) filter (where not trigger_won), 0))::int
             as pct_when_lost_anchored
    from anchored_days
    group by trigger_id, later_id
  ),
  anchor_control as (
    select q.trigger_id, q.later_id,
           aa.anchor_name,
           aa.anchor_days,
           aa.pct_when_won_anchored,
           aa.pct_when_lost_anchored,
           (aa.pct_when_won_anchored - aa.pct_when_lost_anchored) as lift_anchored,
           case
             when aa.later_id is null then 'insufficient_data'
             when aa.n_won < 5 or aa.n_lost < 5 then 'insufficient_data'
             when abs(aa.pct_when_won_anchored - aa.pct_when_lost_anchored)
                  < abs(q.lift) * 0.5 then 'upstream_weakened'
             when abs(aa.pct_when_won_anchored - aa.pct_when_lost_anchored)
                  >= abs(q.lift) then 'upstream_ruled_out'
             else 'inconclusive'
           end as verdict
    from qualified q
    left join anchored_agg aa
      on aa.trigger_id = q.trigger_id and aa.later_id = q.later_id
  ),
  -- Lift of this trigger against every later block in the recent window,
  -- grouped by whether the later block shares the stored category.
  -- Never infer a category from a name.
  later_lifts as (
    select a.trigger_id, a.later_id, a.later_name, a.lift,
           tb.category as trigger_category,
           lb.category as later_category
    from agg a
    join schedule_blocks tb on tb.id = a.trigger_id
    join schedule_blocks lb on lb.id = a.later_id
    where a.recent
      and a.n_won > 0
      and a.n_lost > 0
  ),
  domain_spread as (
    select q.trigger_id,
           count(*) filter (where ll.trigger_category = ll.later_category)
             as same_category_pairs,
           round(avg(ll.lift) filter (where ll.trigger_category = ll.later_category))::int
             as avg_lift_same_category,
           count(*) filter (where ll.trigger_category <> ll.later_category)
             as other_category_pairs,
           round(avg(ll.lift) filter (where ll.trigger_category <> ll.later_category))::int
             as avg_lift_other_category,
           coalesce(
             (select jsonb_agg(x.later_name order by x.later_name)
              from later_lifts x
              where x.trigger_id = q.trigger_id and abs(x.lift) < 10),
             '[]'::jsonb
           ) as flat_blocks,
           case
             when count(*) filter (where ll.trigger_category = ll.later_category) < 2
               or count(*) filter (where ll.trigger_category <> ll.later_category) < 2
               then 'insufficient_data'
             when abs(avg(ll.lift) filter (where ll.trigger_category = ll.later_category))
                  >= abs(avg(ll.lift) filter (where ll.trigger_category <> ll.later_category)) * 2
               then 'domain_specific'
             when abs(avg(ll.lift) filter (where ll.trigger_category = ll.later_category))
                  <= abs(avg(ll.lift) filter (where ll.trigger_category <> ll.later_category)) * 1.25
              and abs(avg(ll.lift) filter (where ll.trigger_category <> ll.later_category))
                  <= abs(avg(ll.lift) filter (where ll.trigger_category = ll.later_category)) * 1.25
               then 'global'
             else 'inconclusive'
           end as verdict
    from qualified q
    left join later_lifts ll on ll.trigger_id = q.trigger_id
    group by q.trigger_id
  ),
  -- Gap buckets use coupling's sample floors (any lift) for a trigger that
  -- already has a qualified pair. Three pairs per populated bucket is
  -- intentional; insufficient_data is the common and correct result.
  gap_pairs as (
    select a.trigger_id, a.later_id, a.later_name, a.lift,
           avg(p.later_start - p.trigger_end) as avg_gap_minutes
    from agg a
    join pairs p
      on p.trigger_id = a.trigger_id
     and p.later_id = a.later_id
     and p.recent
    where a.recent
      and a.days >= 10
      and a.n_won >= 6
      and a.n_lost >= 6
      and a.trigger_id in (select trigger_id from qualified)
    group by a.trigger_id, a.later_id, a.later_name, a.lift
  ),
  gap_bucketed as (
    select trigger_id, lift, avg_gap_minutes,
           case
             when avg_gap_minutes < 90 then 'adjacent'
             when avg_gap_minutes <= 240 then 'mid'
             else 'distant'
           end as bucket
    from gap_pairs
  ),
  gap_bucket_stats as (
    select trigger_id, bucket,
           count(*) as pairs,
           round(avg(lift))::int as avg_lift,
           round(avg(avg_gap_minutes))::int as avg_gap_minutes
    from gap_bucketed
    group by trigger_id, bucket
  ),
  gap_sensitivity as (
    select t.trigger_id,
           coalesce(
             (select jsonb_agg(jsonb_build_object(
                       'bucket', s.bucket,
                       'pairs', s.pairs,
                       'avg_lift', s.avg_lift,
                       'avg_gap_minutes', s.avg_gap_minutes
                     ) order by case s.bucket
                       when 'adjacent' then 1
                       when 'mid' then 2
                       else 3 end)
              from gap_bucket_stats s
              where s.trigger_id = t.trigger_id),
             '[]'::jsonb
           ) as gap_buckets,
           case
             when (select count(*) from gap_bucket_stats s
                   where s.trigger_id = t.trigger_id) < 2
               then 'insufficient_data'
             when exists (
               select 1 from gap_bucket_stats s
               where s.trigger_id = t.trigger_id and s.pairs < 3
             ) then 'insufficient_data'
             when adj.avg_lift is not null
              and dist.avg_lift is not null
              and abs(adj.avg_lift) >= abs(dist.avg_lift) * 2
              and (mid.avg_lift is null
                   or (abs(adj.avg_lift) >= abs(mid.avg_lift)
                       and abs(mid.avg_lift) >= abs(dist.avg_lift)))
               then 'cascade_favoured'
             when adj.avg_lift is not null
              and dist.avg_lift is not null
              and abs(dist.avg_lift) >= abs(adj.avg_lift) * 0.6
               then 'carry_favoured'
             else 'inconclusive'
           end as verdict
    from (select distinct trigger_id from qualified) t
    left join gap_bucket_stats adj
      on adj.trigger_id = t.trigger_id and adj.bucket = 'adjacent'
    left join gap_bucket_stats mid
      on mid.trigger_id = t.trigger_id and mid.bucket = 'mid'
    left join gap_bucket_stats dist
      on dist.trigger_id = t.trigger_id and dist.bucket = 'distant'
  ),
  -- surviving / ruled_out / untested are derived here. The narrator
  -- reads the lists; it does not assign a hypothesis to a verdict.
  hypothesis_rows as (
    select q.trigger_id, q.later_id, q.trigger_name, q.later_name, q.lift,
           ac.anchor_name, ac.anchor_days,
           ac.pct_when_won_anchored, ac.pct_when_lost_anchored,
           ac.lift_anchored, ac.verdict as anchor_verdict,
           ds.same_category_pairs, ds.avg_lift_same_category,
           ds.other_category_pairs, ds.avg_lift_other_category,
           ds.flat_blocks, ds.verdict as domain_verdict,
           gs.gap_buckets, gs.verdict as gap_verdict,
           case
             when gs.verdict = 'cascade_favoured' then 'ruled_out'
             when ds.verdict = 'domain_specific'
               or gs.verdict = 'carry_favoured' then 'surviving'
             else 'untested'
           end as carry_status,
           case
             when ac.verdict = 'upstream_ruled_out'
               or ds.verdict = 'domain_specific' then 'ruled_out'
             when ac.verdict = 'upstream_weakened'
               or ds.verdict = 'global' then 'surviving'
             else 'untested'
           end as upstream_status,
           case
             when gs.verdict = 'carry_favoured' then 'ruled_out'
             when gs.verdict = 'cascade_favoured' then 'surviving'
             else 'untested'
           end as cascade_status
    from qualified q
    left join anchor_control ac
      on ac.trigger_id = q.trigger_id and ac.later_id = q.later_id
    left join domain_spread ds on ds.trigger_id = q.trigger_id
    left join gap_sensitivity gs on gs.trigger_id = q.trigger_id
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

    -- Ordered within-day pairs, both signs. Negative lift is a keystone
    -- (earlier failing predicts later failing). Positive lift is
    -- cannibalization (earlier completing predicts later failing). The old
    -- filter kept lift >= 25 and dropped every real signal in the founder
    -- data. Persistence across the prior 30 days is the multiple-comparisons
    -- guard: with both directions live, up to 72 pairs are tested.
    'block_coupling', (
      select coalesce(jsonb_agg(row_to_json(t) order by abs(t.lift) desc), '[]'::jsonb)
      from coupling t
    ),

    -- A claim about the schedule's structure, not one block's rate.
    -- Requires two or more keystone relations that already cleared coupling.
    'keystones', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.carries desc), '[]'::jsonb)
      from (
        select trigger_name as name,
               count(*) filter (where relation = 'keystone')       as carries,
               count(*) filter (where relation = 'cannibalization') as competes,
               round(avg(lift) filter (where relation = 'keystone'))::int as avg_carry_lift
        from qualified
        group by trigger_name
        having count(*) filter (where relation = 'keystone') >= 2
      ) t
    ),

    'hypothesis_tests', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'trigger_name', h.trigger_name,
               'later_name', h.later_name,
               'anchor_control', jsonb_build_object(
                 'anchor_name', h.anchor_name,
                 'anchor_days', h.anchor_days,
                 'pct_when_won_anchored', h.pct_when_won_anchored,
                 'pct_when_lost_anchored', h.pct_when_lost_anchored,
                 'lift_anchored', h.lift_anchored,
                 'verdict', h.anchor_verdict
               ),
               'domain_spread', jsonb_build_object(
                 'same_category_pairs', h.same_category_pairs,
                 'avg_lift_same_category', h.avg_lift_same_category,
                 'other_category_pairs', h.other_category_pairs,
                 'avg_lift_other_category', h.avg_lift_other_category,
                 'flat_blocks', h.flat_blocks,
                 'verdict', h.domain_verdict
               ),
               'gap_sensitivity', jsonb_build_object(
                 'gap_buckets', h.gap_buckets,
                 'verdict', h.gap_verdict
               ),
               'surviving', (
                 select coalesce(jsonb_agg(v.name order by v.ord), '[]'::jsonb)
                 from (values
                   (1, 'carry', h.carry_status),
                   (2, 'upstream', h.upstream_status),
                   (3, 'cascade', h.cascade_status)
                 ) v(ord, name, status)
                 where v.status = 'surviving'
               ),
               'ruled_out', (
                 select coalesce(jsonb_agg(v.name order by v.ord), '[]'::jsonb)
                 from (values
                   (1, 'carry', h.carry_status),
                   (2, 'upstream', h.upstream_status),
                   (3, 'cascade', h.cascade_status)
                 ) v(ord, name, status)
                 where v.status = 'ruled_out'
               ),
               'untested', (
                 select coalesce(jsonb_agg(v.name order by v.ord), '[]'::jsonb)
                 from (values
                   (1, 'carry', h.carry_status),
                   (2, 'upstream', h.upstream_status),
                   (3, 'cascade', h.cascade_status)
                 ) v(ord, name, status)
                 where v.status = 'untested'
               )
             ) order by abs(h.lift) desc), '[]'::jsonb)
      from hypothesis_rows h
    ),

    'day_of_week', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.dow), '[]'::jsonb)
      from (
        select to_char(date, 'Dy')            as day,
               extract(dow from date)::int    as dow,
               count(*)                       as relevant,
               count(*) filter (where status in ('missed','unaccounted')) as failed,
               round(100.0 * count(*) filter (where status in ('missed','unaccounted'))
                     / count(*))::int         as fail_pct
        from base
        group by 1, 2
        having count(*) >= 8
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
      'coupling_note', 'lift is associational, never causal. day_baseline_shift approaching abs(lift) means whole-day collapse, not a pair-specific relationship. persistence = single_window means fewer than 60 days exist or the prior window lacked enough arms.',
      'hypothesis_note', 'hypothesis_tests eliminate explanations; they do not establish causation. insufficient_data means untested, not ruled out. All results are observational. The three candidates are fixed: carry, upstream, cascade. Never invent a fourth, and never mention willpower depletion.',
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
        'block_coupling.lift is associational, never causal. Never say "causes". Cite both arms with their counts. day_baseline_shift is the rest-of-day fail-rate change excluding the pair: when its magnitude approaches abs(lift), the whole day moved, not this pair — describe it as a day-level pattern or omit it. persistence = single_window means the prior 30 days lacked enough arms, or fewer than 60 days exist; you may state the finding but must say the window is short. persistence = contradicted means the prior window disagreed; do not raise it. persistence = confirmed means the sign and a 15-point effect repeated. later_unaccounted_days counts days the later block was never checked in, not confirmed misses. unaccounted is not missed. block_coupling and keystones read a 60-day window so a finding can be checked against the prior 30 days; every other section still uses the 30-day base.',
        'miss_reasons are TAPPED PRESETS, not the user''s own words. Cite them as counts only; never quote them as something the user wrote.',
        'miss_reasons describes END-OF-DAY misses only, never misses in general. The tag is written solely by the evening close-today sweep; a user who deals with a miss during the day writes reflection_why and leaves no tag. ALWAYS read the counts against miss_totals, never alone. If tagged_misses is a small share of total_misses, say the tags cover only part of the picture, or omit them. A LOW share means the user resolved most misses promptly, which is ENGAGEMENT -- never describe it as missing data, avoidance, poor tracking, or a failure to reflect.',
        'quality_reasons are TAPPED PRESETS recorded on a COMPLETED block that was degrading, not on a miss. Cite them as counts only; never quote them as something the user wrote, and never describe the block as missed.',
        'quality_drift recent_poor/recent_rated use a 7-instance window, matching the in-app prompt threshold. Do not describe it as "this week" — it is the last 7 rated sessions of that block, which may span more or less than a week.',
        'nudge_outcomes: a local notification fires whether or not the app is running, and iOS does not report delivery. "fired" means scheduled and elapsed, never confirmed seen.',
        'swap_drift.times_moved counts DAYS A BLOCK ENDED UP IN A DIFFERENT SLOT than it was scheduled — not how many times the user touched it. Adjustments that return a block to its original time are excluded entirely. Never describe these figures as the user "fiddling with", "rearranging", or "constantly changing" their schedule; that is a characterisation the data does not support and this product does not make.',
        'hypothesis_tests eliminate candidate explanations for a qualified coupling pair; they do not name a cause. Report only what surviving / ruled_out / untested already state. insufficient_data is untested, never ruled out. Never write because, causes, or the reason is. Never mention willpower or ego depletion. Never invent a fourth hypothesis. Cite the numbers each elimination rests on.'
      )
    )

  ) into result;
  return result;
end;
$function$;

grant execute on function public.get_behavior_evidence(uuid) to service_role;

-- Verification (run after applying, replace YOUR-USER-ID):
--
-- select jsonb_pretty(
--   (public.get_behavior_evidence('YOUR-USER-ID')) -> 'keystones'
-- );
--
-- keystones must not list a trigger whose pairs fail persistence,
-- day_baseline, or the unaccounted guard. block_coupling is unchanged.
--
-- select jsonb_pretty(
--   (public.get_behavior_evidence('d8c23a37-229f-4204-bf45-1c58684d385d'))
--     -> 'hypothesis_tests'
-- );
--
-- Expected on that account, one pair (Deep work morning → Deep work afternoon):
--   anchor_control.verdict = upstream_ruled_out (anchor Fajr / Quran;
--     anchored lift larger than unanchored). If inconclusive, leave the
--     0.5 multiplier alone and read the raw anchored lift.
--   domain_spread.verdict = domain_specific; flat_blocks includes Dinner.
--     If same_category_pairs < 2 the floor returns insufficient_data —
--     do not lower it.
--   gap_sensitivity.verdict is usually insufficient_data.
--   surviving: [carry], ruled_out: [upstream], untested: [cascade].
