-- 053_coupling_arm_counts.sql
-- Applied manually via Supabase SQL Editor. Do not run `supabase db push`.
--
-- The narrator must cite "X of Y days" for each coupling arm without
-- multiplying a rounded percent. SQL already had the counts; this emits
-- them as n_won_later_failed and n_lost_later_failed.

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
    raise exception '053: public.get_behavior_evidence not found';
  end if;

  src := pg_get_functiondef(fn_oid);

  if strpos(src, 'n_won_later_failed') > 0 then
    raise exception '053: already applied';
  end if;

  if strpos(src, $a$count(*) filter (where later_unaccounted)       as later_unaccounted_days,$a$) = 0 then
    raise exception '053: agg later_unaccounted_days anchor not found';
  end if;

  before := length(src);
  src := replace(
    src,
    $a$count(*) filter (where later_unaccounted)       as later_unaccounted_days,$a$,
    $a$count(*) filter (where later_unaccounted)       as later_unaccounted_days,
           count(*) filter (where trigger_won and later_failed)     as n_won_later_failed,
           count(*) filter (where not trigger_won and later_failed) as n_lost_later_failed,$a$
  );
  if length(src) = before then
    raise exception '053: agg replace made no change';
  end if;

  if strpos(src, $a$r.days, r.n_won, r.n_lost,
           r.pct_when_won, r.pct_when_lost,$a$) = 0 then
    raise exception '053: coupling select anchor not found';
  end if;

  before := length(src);
  src := replace(
    src,
    $a$r.days, r.n_won, r.n_lost,
           r.pct_when_won, r.pct_when_lost,$a$,
    $a$r.days, r.n_won, r.n_lost,
           r.n_won_later_failed, r.n_lost_later_failed,
           r.pct_when_won, r.pct_when_lost,$a$
  );
  if length(src) = before then
    raise exception '053: coupling replace made no change';
  end if;

  execute src;
end;
$outer$;

grant execute on function public.get_behavior_evidence(uuid) to service_role;
