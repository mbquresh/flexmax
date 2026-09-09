-- 052_insight_kind_structural.sql
-- Applied manually via Supabase SQL Editor. Do not run `supabase db push`.
--
-- Adds 'structural' to behavioral_insights.kind so keystone and weekday
-- findings have a home that is neither causal (the engine does not claim
-- cause) nor pattern (a schedule-structure claim, not a recurrence).
-- Ships with the narrator prompt change; apply before deploying
-- weekly-insight. No rows are rewritten.

alter table public.behavioral_insights
  drop constraint if exists behavioral_insights_kind_check;

alter table public.behavioral_insights
  add constraint behavioral_insights_kind_check
  check (kind in ('causal', 'pattern', 'strength', 'structural'));
