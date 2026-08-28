-- 036_accountability_tone_check.sql
-- Applied manually via Supabase SQL Editor.
--
-- accountability_tone is written verbatim into the weekly-insight prompt as
-- the first line of the user message. The column accepted any string; the only
-- thing keeping it clean was TONE_OPTIONS in account.tsx. NOT VALID matching
-- 025's style: legacy rows from the deleted AI onboarding are not checked, but
-- everything written from here on is governed.

alter table public.psychology_profiles
  drop constraint if exists accountability_tone_valid;

alter table public.psychology_profiles
  add constraint accountability_tone_valid check (
    accountability_tone is null
    or accountability_tone in ('firm', 'gentle', 'data-driven')
  ) not valid;
