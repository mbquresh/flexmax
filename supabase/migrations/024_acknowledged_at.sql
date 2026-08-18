-- Applied manually via Supabase SQL Editor.
-- acknowledged_at: when the user gave a block a real status. rated_at stamps
-- only on completion and reflected_at only when text is written (~31% of
-- misses), so recovery time — deviation to acknowledgment — was uncomputable.
-- Un-backfillable: every day without this column is data permanently lost.
-- Stamps on FIRST acknowledgment only; cleared on undo so a re-answer restamps.

-- 024: acknowledgment timing. rated_at stamps only on completion; reflected_at
-- only when text is written (~31% of misses). There is currently no record of
-- WHEN a user acknowledged a deviation, so recovery time — the metric that
-- tests whether execution actually improves — is uncomputable. Cannot be
-- backfilled; every day without it is data permanently lost.
alter table public.daily_schedule_instances
  add column acknowledged_at timestamptz;

create or replace function public.stamp_acknowledged()
returns trigger as $$
begin
  if new.status is distinct from old.status then
    -- First real acknowledgment only. Changing missed -> completed later must
    -- not restamp; the original moment of engagement is what matters.
    if new.status in ('completed','missed','skipped')
       and old.acknowledged_at is null then
      new.acknowledged_at := now();
    -- Undo returns the block to open. Clear it so a later re-answer stamps fresh.
    elsif new.status in ('pending','active') then
      new.acknowledged_at := null;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger acknowledged_stamp
  before update on public.daily_schedule_instances
  for each row execute function public.stamp_acknowledged();
