-- 035_day_boundary_overrides.sql
-- Applied manually via Supabase SQL Editor.
--
-- Sparse per-weekday overrides for wake and sleep. Keys are day-of-week 0-6
-- (0 = Sunday), matching schedule_blocks.days_of_week. Days absent from the
-- map fall back to profiles.wake_target_minutes / sleep_target_minutes.
--
-- Sparse and additive on purpose: the scalar columns stay authoritative as the
-- default, so every existing consumer -- findRescheduleSlot's dayEnd, the
-- pastBedtime warning, planDisplacement's bedtime bound -- keeps working
-- untouched. Most users have one schedule and at most a couple of different
-- days; forcing seven stored rows would make the common case worse.
--
--   {"0": {"wake": 540, "sleep": 1440}, "6": {"wake": 540}}
--
-- Either key may be absent independently.

alter table public.profiles
  add column if not exists day_boundary_overrides jsonb not null default '{}'::jsonb;

comment on column public.profiles.day_boundary_overrides is
  'Sparse per-weekday wake/sleep overrides, keys 0-6 (0=Sunday). Absent days fall back to wake_target_minutes / sleep_target_minutes.';
