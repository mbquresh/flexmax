-- Applied manually via Supabase SQL Editor.
-- Atomic replace for behavioral_insights. The edge function previously ran
-- supersede-then-insert as two separate calls; a failed insert left the user
-- with no visible insights for a week. plpgsql runs in a single implicit
-- transaction. Also refuses to supersede with an empty set.

create or replace function public.replace_behavioral_insights(
  p_user_id uuid,
  p_insights jsonb
)
returns setof public.behavioral_insights
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(jsonb_array_length(p_insights), 0) = 0 then
    raise exception 'refusing to replace with empty insight set';
  end if;

  update public.behavioral_insights
  set superseded = true
  where user_id = p_user_id
    and not superseded;

  return query
  with inserted as (
    insert into public.behavioral_insights (
      user_id,
      kind,
      belief,
      evidence,
      suggestion,
      related_blocks,
      nudge_line,
      rank
    )
    select
      p_user_id,
      elem->>'kind',
      elem->>'belief',
      elem->>'evidence',
      elem->>'suggestion',
      coalesce(
        (
          select array_agg(block_name)
          from jsonb_array_elements_text(coalesce(elem->'related_blocks', '[]'::jsonb)) as block_name
        ),
        '{}'::text[]
      ),
      elem->>'nudge_line',
      row_number() over ()::integer
    from jsonb_array_elements(p_insights) as elem
    returning *
  )
  select * from inserted order by rank;
end;
$$;

grant execute on function public.replace_behavioral_insights(uuid, jsonb) to service_role;
