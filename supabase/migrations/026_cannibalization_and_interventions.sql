-- Applied manually via Supabase SQL Editor.
-- Adds three sections: cannibalization, nudge_outcomes, miss_reasons.
-- Also adds miss_reason_tag to the base CTE.
--
-- cannibalization took three attempts. v1 compared days the trigger FAILED and
-- found only whole-day collapse ("when breakfast fails, everything fails").
-- v2 added a mixed-day restriction and found time-of-day clustering, plus an
-- impossible result where a 7am block appeared to cause a 6am failure.
-- v3 (shipped) inverts the trigger to COMPLETION — the aggressor block wins and
-- takes a later block's time — restricts to mixed days, and requires the
-- trigger to start earlier than the sacrificed block.

create or replace function public.get_behavior_evidence(p_user_id uuid)
returns jsonb as $$
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
    having count(*) filter (where i.status in ('completed','missed')) >= 3
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
           i.miss_reason_tag, b.name
    from daily_schedule_instances i
    join schedule_blocks b on b.id = i.block_id
    join tracked t         on t.block_id = i.block_id
    join engaged e         on e.date = i.date
    where i.user_id = p_user_id
      and i.date >= v_today - 30
      and i.date < v_today
  )
  select jsonb_build_object(

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

    'swap_drift', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      from (
        select b.name,
               count(*) as times_moved,
               count(*) filter (where c.new_start > c.old_start) as moved_later,
               count(*) filter (where c.new_start < c.old_start) as moved_earlier,
               round(avg(c.new_start - c.old_start)
                     filter (where c.new_start > c.old_start)) as avg_later_by,
               round(avg(c.old_start - c.new_start)
                     filter (where c.new_start < c.old_start)) as avg_earlier_by
        from instance_time_changes c
        join schedule_blocks b on b.id = c.block_id
        join tracked t on t.block_id = c.block_id
        where c.user_id = p_user_id
          and c.changed_at >= now() - interval '30 days'
        group by b.name having count(*) >= 2
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
                   and rn <= 5
               ) as recent_poor,
               count(*) filter (where rn <= 5) as recent_rated
        from (
          select name, completion_rating, date,
                 row_number() over (partition by name order by date desc) as rn
          from base
          where completion_rating is not null
        ) x
        group by name
        having count(*) >= 3
      ) t
    ),

    -- CANNIBALIZATION — one block's SUCCESS predicting another's failure.
    --
    -- This measures subsidy, not co-failure. An earlier version compared days
    -- the trigger FAILED and found only time-of-day clustering ("evening blocks
    -- die together"), because the real pattern is the opposite: the aggressor
    -- block WINS and takes the other's time. "I extended my deep work too much
    -- and ate into this" — deep work completed. So the trigger condition is
    -- completion, and the comparison is B's failure rate on days A completed
    -- versus days A did not.
    --
    -- Restricted to MIXED days: on a total collapse every pair co-fails and on
    -- a perfect day none do, so unrestricted this measures whole-day collapse.
    -- Time-ordered: only a block that STARTS EARLIER can take a later block's
    -- time. Without this the query reported a 7am block causing a 6am failure.
    -- CORRELATION, not proven cause.
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
           and x.start_minutes < y.start_minutes   -- only earlier can take later
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
        'Today is excluded and partial weeks are omitted. Never describe a trend from an incomplete period.',
        'Judge trends from weekly_trend and day_shape (whole days), never from a single block type. A day where the mornings landed can still be a day that collapsed.',
        'quality_drift describes the BLOCK''s trajectory, never the user''s effort. Ratings are crushed / partial / pulled_away. Say "landing at half strength", never "you have not been focused".',
        'cannibalization measures one block SUCCEEDING while a later block fails, on mixed days only, time-ordered. It is CORRELATION, not proof of a trade. State it as co-occurrence ("these two move together"), and only call it a trade if the user''s own reflections independently say so.',
        'miss_reasons are TAPPED PRESETS, not the user''s own words. Cite them as counts only; never quote them as something the user wrote.',
        'nudge_outcomes: a local notification fires whether or not the app is running, and iOS does not report delivery. "fired" means scheduled and elapsed, never confirmed seen.'
      )
    )

  ) into result;
  return result;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.get_behavior_evidence(uuid) to service_role;
