-- Atomic swap of two daily_schedule_instances' time slots.
-- Both updates commit together or not at all.
-- Scoped to the calling user for safety.

create or replace function public.swap_instance_times(
  instance_a_id uuid,
  a_start integer,
  a_end integer,
  instance_b_id uuid,
  b_start integer,
  b_end integer
)
returns void as $$
begin
  -- Verify both instances belong to the caller before touching anything
  if not exists (
    select 1 from public.daily_schedule_instances
    where id = instance_a_id and user_id = auth.uid()
  ) or not exists (
    select 1 from public.daily_schedule_instances
    where id = instance_b_id and user_id = auth.uid()
  ) then
    raise exception 'Instance not found or not owned by caller';
  end if;

  update public.daily_schedule_instances
    set start_minutes = a_start, end_minutes = a_end
    where id = instance_a_id and user_id = auth.uid();

  update public.daily_schedule_instances
    set start_minutes = b_start, end_minutes = b_end
    where id = instance_b_id and user_id = auth.uid();
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.swap_instance_times(uuid, integer, integer, uuid, integer, integer) to authenticated;
