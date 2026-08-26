-- 033_swap_drift_resolved_only.sql
-- Applied manually via Supabase SQL Editor.
--
-- swap_drift counted net displacement on instances that were never resolved.
-- Measured over 7 days: 6 pending, 8 removed, 9 unaccounted out of 188 rows --
-- about 12% of swap signal attached to outcomes that never happened. The
-- 'removed' rows are the worst: displacement reported for a block later
-- displaced out of the day entirely.
--
-- Same failure as 027 one layer down. 027 stopped counting edit rows instead
-- of net displacement; this stops counting displacement on blocks that were
-- never completed or missed. A move is only signal once the outcome is known.
--
-- 'unaccounted' stays excluded deliberately: the sweep assigns it, the user
-- never answered, so there is no behavior to attribute the move to.
--
-- MEASURED IMPACT: none. swap_drift returned 0 entries both before and after,
-- and the unfiltered reconstruction also returned 0 rows. See the Known issues
-- note added alongside this migration -- swap_drift appears structurally
-- dormant, not merely empty for this account.
--
-- Applied via a text rewrite of the deployed function rather than a full
-- redefinition, so the other ~260 lines could not drift from 027.

do $$
declare
  src text;
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_behavior_evidence';

  if src is null then
    raise exception 'get_behavior_evidence not found';
  end if;

  if position('join daily_schedule_instances i on i.id = c.instance_id' in src) > 0 then
    raise notice 'already applied, nothing to do';
    return;
  end if;

  src := replace(
    src,
    'from instance_time_changes c
          join schedule_blocks b on b.id = c.block_id
          join tracked tr        on tr.block_id = c.block_id
          where c.user_id = p_user_id
            and c.changed_at >= now() - interval ''30 days''',
    'from instance_time_changes c
          join schedule_blocks b on b.id = c.block_id
          join tracked tr        on tr.block_id = c.block_id
          join daily_schedule_instances i on i.id = c.instance_id
          where c.user_id = p_user_id
            and c.changed_at >= now() - interval ''30 days''
            and i.status in (''completed'',''missed'')'
  );

  if position('daily_schedule_instances i' in src) = 0 then
    raise exception 'pattern did not match -- whitespace differs, apply by hand';
  end if;

  execute src;
end $$;
