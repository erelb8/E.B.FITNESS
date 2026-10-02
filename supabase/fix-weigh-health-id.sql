-- Fix: trainee_weigh and trainee_health never worked.
-- Both declared v_id as uuid, but trainees.id is text (e.g. "mu2j88ao37u96").
-- Every call failed with "invalid input syntax for type uuid", the trainee
-- page swallowed the error, and no weigh-in or health declaration ever
-- reached the server. Found 2.10.2026. Safe to run more than once.

create or replace function public.trainee_health(
  p_token  text,
  p_health jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id text; v_out jsonb;
begin
  select id into v_id from public.trainees
   where access_token = p_token and access_active
     and not deleted and status <> 'archived'
   limit 1;
  if v_id is null then raise exception 'bad_token'; end if;

  v_out := coalesce(p_health, '{}'::jsonb)
           || jsonb_build_object('signedAt', to_char(now(), 'YYYY-MM-DD'),
                                 'receivedAt', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'));

  update public.trainees set health = v_out where id = v_id;
  return v_out;
end;
$$;
grant execute on function public.trainee_health(text, jsonb)              to anon, authenticated;

create or replace function public.trainee_weigh(
  p_token  text,
  p_date   text,
  p_weight numeric,
  p_fat    numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id text; v_rows jsonb; v_day text;
begin
  select id into v_id from public.trainees
   where access_token = p_token and access_active
     and not deleted and status <> 'archived'
   limit 1;
  if v_id is null then raise exception 'bad_token'; end if;

  if p_weight is null or p_weight <= 20 or p_weight > 400 then
    raise exception 'bad_weight';
  end if;

  v_day := coalesce(nullif(btrim(p_date), ''), to_char(now(), 'YYYY-MM-DD'));

  select coalesce(weighins, '[]'::jsonb) into v_rows from public.trainees where id = v_id;

  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_rows
    from jsonb_array_elements(v_rows) e
   where e->>'date' is distinct from v_day;

  v_rows := v_rows || jsonb_build_array(
    jsonb_build_object('date', v_day, 'weight', p_weight, 'fat', p_fat,
                       'at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'))
  );

  update public.trainees set weighins = v_rows where id = v_id;
  return v_rows;
end;
$$;
grant execute on function public.trainee_weigh(text, text, numeric, numeric) to anon, authenticated;

-- Check: both should show "text"
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       (regexp_match(pg_get_functiondef(p.oid), 'declare v_id (\w+)'))[1] as v_id_type
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('trainee_weigh', 'trainee_health');
