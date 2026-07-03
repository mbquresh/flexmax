-- Block flexibility: fixed anchors (work, commute) cannot be moved or swap targets

alter table public.schedule_blocks
  add column if not exists is_fixed boolean not null default false;

alter table public.daily_schedule_instances
  add column if not exists is_fixed boolean not null default false;

create or replace function public.generate_daily_instances(target_date date)
returns void as $$
begin
  insert into public.daily_schedule_instances
    (user_id, block_id, date, start_minutes, end_minutes, status, is_fixed)
  select
    sb.user_id,
    sb.id,
    target_date,
    sb.start_minutes,
    sb.end_minutes,
    'pending',
    sb.is_fixed
  from public.schedule_blocks sb
  join public.schedule_templates st on st.id = sb.template_id
  where st.is_active = true
    and extract(dow from target_date)::int = any(sb.days_of_week)
  on conflict (block_id, date) do nothing;
end;
$$ language plpgsql security definer;
