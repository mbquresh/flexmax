-- Applied manually via Supabase SQL Editor.
-- Adds quality_drift to the evidence pack. completion_rating (crushed /
-- partial / pulled_away) was captured on every check-in and read by nothing.
-- A block still COMPLETING but rated partial/pulled_away repeatedly is
-- degrading before it starts being missed — the earliest warning available.
-- Also adds completion_rating to the base CTE.

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
           i.reflection_why, i.reflection_improve, i.completion_rating, b.name
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

    -- G. Quality drift. A block still completing but rated 'partial'/'pulled_away'
    -- repeatedly is degrading before it starts being missed. Ordering by date
    -- lets the narrator see direction, not just totals.
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
                 row_number() over (
                   partition by name
                   order by date desc
                 ) as rn
          from base
          where completion_rating is not null
        ) x
        group by name
        having count(*) >= 3
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
        'Judge trends from weekly_trend and day_shape (whole days), never from a single block type. A day where the mornings landed can still be a day that collapsed.'
      )
    )

  ) into result;
  return result;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.get_behavior_evidence(uuid) to service_role;
