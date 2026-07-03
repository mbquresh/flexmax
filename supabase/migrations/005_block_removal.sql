-- Block removal from today: optional reason, status 'removed' (text column, no enum change)

alter table public.daily_schedule_instances
  add column if not exists removed_reason text;
