alter table public.psychology_profiles
  add column if not exists schedule_tips text[];
