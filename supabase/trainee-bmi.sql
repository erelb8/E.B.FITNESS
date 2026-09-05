-- E.B FIT — BMI data for the trainee personal page
-- Run after health.sql and trainee-exercises.sql.
-- Exposes only the trainee's own height and latest weight.

alter table public.trainees
  add column if not exists health jsonb not null default '{}'::jsonb,
  add column if not exists weighins jsonb not null default '[]'::jsonb;

drop function if exists public.trainee_program(text);

create or replace function public.trainee_program(p_token text)
returns table (
  name text, goal text, program jsonb, files jsonb,
  trainer_name text, goal2 text, success3m text,
  meals jsonb, meals_self jsonb, exercises_self jsonb,
  health jsonb, weighins jsonb, height numeric, weight numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select t.name,
         t.goal,
         t.program,
         coalesce(t.files, '[]'::jsonb),
         coalesce(
           nullif(btrim(coalesce(p.data->'settings'->>'trainer', '')), ''),
           nullif(btrim(coalesce(p.data->>'trainer', '')), ''),
           'המאמן שלך'
         ),
         t.private->'intake'->'answers'->>'goal2',
         t.private->'intake'->'answers'->>'success3m',
         coalesce(t.meals, '[]'::jsonb),
         coalesce(t.meals_self, '[]'::jsonb),
         coalesce(t.exercises_self, '[]'::jsonb),
         coalesce(t.health, '{}'::jsonb),
         coalesce(t.weighins, '[]'::jsonb),
         case when coalesce(t.private->>'height','') ~ '^[0-9]+(\.[0-9]+)?$'
              then (t.private->>'height')::numeric end,
         (select case when coalesce(m.data->>'weight','') ~ '^[0-9]+(\.[0-9]+)?$'
                      then (m.data->>'weight')::numeric end
            from public.measures m
           where m.trainee_id = t.id
             and not m.deleted
             and coalesce(m.data->>'weight','') <> ''
           order by m.date desc, m.updated_at desc
           limit 1)
    from public.trainees t
    left join public.trainer_prefs p on p.trainer_id = t.trainer_id
   where t.access_token = p_token
     and t.access_active
     and not t.deleted
     and t.status <> 'archived'
   limit 1;
$$;

revoke all on function public.trainee_program(text) from public, anon, authenticated;
grant execute on function public.trainee_program(text) to anon, authenticated;

notify pgrst, 'reload schema';
