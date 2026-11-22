-- =====================================================================
-- trainee_log: a report may carry the day the workout was done (Nov 2026)
-- Paste into Supabase -> SQL Editor -> Run. Safe to run more than once.
--
-- Until now every report got current_date. A trainee who marked a workout
-- on Thursday and sent it on Sunday (after the weekly reset) showed up in
-- the coach's feed as a Sunday workout.
--
-- p_date is optional. It is accepted only for the last 14 days and never
-- for the future; anything else falls back to current_date. Old pages that
-- do not send it keep working unchanged (default null).
--
-- The flood guard now counts reports by arrival time (created_at, last 24
-- hours) instead of by date, so back-dated reports cannot bypass it.
--
-- The old 6-argument function is dropped first: keeping both would make a
-- call with 6 named arguments ambiguous for PostgREST.
-- =====================================================================

drop function if exists public.trainee_log(text, integer, text, jsonb, text, text);

create or replace function public.trainee_log(
  p_token     text,
  p_day_index integer,
  p_day_name  text,
  p_entries   jsonb,
  p_feel      text default null,
  p_note      text default null,
  p_date      date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_trainee text; v_date date := current_date;
begin
  select id into v_trainee from public.trainees
   where access_token = p_token and access_active
     and not deleted and status <> 'archived';

  if v_trainee is null then
    raise exception 'invalid token';
  end if;

  -- flood guard: by arrival time, not by the (possibly earlier) workout date
  if (select count(*) from public.workout_logs
       where trainee_id = v_trainee and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many logs today';
  end if;

  if jsonb_array_length(coalesce(p_entries,'[]'::jsonb)) > 60 then
    raise exception 'payload too large';
  end if;

  -- the day it was done: last 14 days only, never the future
  if p_date is not null and p_date <= current_date and p_date >= current_date - 14 then
    v_date := p_date;
  end if;

  insert into public.workout_logs (trainee_id, date, day_index, day_name, entries, feel, note)
  values (v_trainee, v_date, p_day_index, left(p_day_name,80), p_entries,
          left(p_feel,40), left(p_note,500))
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.trainee_log(text,integer,text,jsonb,text,text,date) from public, anon, authenticated;
grant execute on function public.trainee_log(text,integer,text,jsonb,text,text,date) to anon, authenticated;

notify pgrst, 'reload schema';
