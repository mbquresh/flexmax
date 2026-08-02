-- Applied manually via Supabase SQL Editor.
-- nudge_line: notification-sized (<=80 char) restatement of an insight's belief.
-- iOS truncates long notification bodies mid-sentence; beliefs run 140-200 chars.

alter table public.behavioral_insights
  add column nudge_line text;

comment on column public.behavioral_insights.nudge_line is
  'Notification-sized (<=80 char) restatement of downstream cost; shown in cutoff nudges.';
