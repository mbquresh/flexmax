-- Applied manually via Supabase SQL Editor.
-- Adds rated_at / reflected_at to daily_schedule_instances.
-- BEFORE UPDATE trigger stamps them on first write, clears on undo.
-- Feeds v2b: lag between block end and rating is a presence signal.

-- Check-in timing. Rating a block the moment it ends vs. six hours later
-- means very different things: one is presence, the other is retroactive
-- guessing. v2b needs the lag, and lag needs a timestamp.

alter table public.daily_schedule_instances
  add column rated_at     timestamptz,
  add column reflected_at timestamptz;

create or replace function public.stamp_checkin_timing()
returns trigger as $$
begin
  -- Stamp when a rating is first given; clear it if the rating is undone
  -- (Today's reset path sets completion_rating back to null).
  if new.completion_rating is distinct from old.completion_rating then
    if new.completion_rating is null then
      new.rated_at := null;
    elsif old.completion_rating is null then
      new.rated_at := now();
    end if;
  end if;

  -- Same for miss reflections.
  if (new.reflection_why is distinct from old.reflection_why
      or new.reflection_improve is distinct from old.reflection_improve) then
    if new.reflection_why is null and new.reflection_improve is null then
      new.reflected_at := null;
    elsif old.reflection_why is null and old.reflection_improve is null then
      new.reflected_at := now();
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- BEFORE, not AFTER: this trigger modifies the row being written,
-- unlike 009 which inserts into a separate audit table.
create trigger checkin_timing_stamp
  before update on public.daily_schedule_instances
  for each row
  execute function public.stamp_checkin_timing();
