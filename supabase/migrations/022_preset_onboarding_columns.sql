-- Applied manually via Supabase SQL Editor.
-- Recognition-screen answers from the seven-beat preset onboarding.
-- Nothing downstream reads these yet — their job in the flow is recognition
-- ("they know me"), not data extraction. Recorded here so the repo stays the
-- schema record.

alter table public.psychology_profiles
  add column planners_abandoned text,   -- 'few' | 'several' | 'lost_count'
  add column past_failure_mode text;    -- 'shame' | 'rigidity' | 'faded'
