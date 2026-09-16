-- E.B FIT - fix: the stale-write guard must apply to the trainer's sync only.
-- Supabase -> SQL Editor -> Run. Safe to re-run.
--
-- Regression introduced by guard-stale-writes.sql: two trainee RPCs write
-- to trainees.program - trainee_update_program (adding to the program)
-- and trainee_update_note (the trainee's own note). The guard saw the
-- program change without a revision bump and rejected them, so trainees
-- could no longer add to their program from the trainee page.
--
-- The distinction is who is writing. The trainer's sync writes through
-- PostgREST as anon (or authenticated, with a stale auth session). Trainee
-- RPCs are SECURITY DEFINER, so inside them current_user is the function
-- owner. Manual fixes in the SQL editor also run as the owner.
--
-- So the guard now applies only when current_user is anon or
-- authenticated - exactly the path a stale device writes through - and
-- stays out of everything else.

create or replace function public.guard_stale_trainee()
returns trigger
language plpgsql
as $$
declare
  old_rev int;
  new_rev int;
begin
  -- only the trainer's sync is guarded; trainee RPCs and admin fixes pass
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.private  is not distinct from old.private
 and new.program  is not distinct from old.program
 and new.name     is not distinct from old.name
 and new.goal     is not distinct from old.goal
 and new.files    is not distinct from old.files
 and new.meals    is not distinct from old.meals
 and new.status   is not distinct from old.status then
    return new;
  end if;

  old_rev := coalesce(nullif(old.private->>'rev','')::int, 0);
  new_rev := coalesce(nullif(new.private->>'rev','')::int, 0);

  if new_rev <= old_rev then
    raise exception
      'המכשיר הזה מחזיק עותק ישן של %. השמירה נדחתה כדי לא למחוק נתונים חדשים יותר. רענן את האפליקציה ונסה שוב.',
      coalesce(old.name, 'המתאמן')
      using errcode = 'P0001';
  end if;

  return new;
end $$;

create or replace function public.guard_stale_child()
returns trigger
language plpgsql
as $$
declare
  old_rev int;
  new_rev int;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.data is not distinct from old.data
 and new.date is not distinct from old.date then
    return new;
  end if;

  old_rev := coalesce(nullif(old.data->>'rev','')::int, 0);
  new_rev := coalesce(nullif(new.data->>'rev','')::int, 0);

  if new_rev <= old_rev then
    raise exception
      'המכשיר הזה מחזיק עותק ישן של רשומה. השמירה נדחתה כדי לא למחוק נתונים חדשים יותר. רענן את האפליקציה.'
      using errcode = 'P0001';
  end if;

  return new;
end $$;

notify pgrst, 'reload schema';

-- verification: which role owns the trainee RPCs, and that it is not guarded
select p.proname as function,
       pg_get_userbyid(p.proowner) as owner,
       case when p.prosecdef then 'security definer' else 'invoker' end as runs_as,
       case when pg_get_userbyid(p.proowner) in ('anon','authenticated')
            then 'GUARDED - PROBLEM' else 'exempt - ok' end as guard
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('trainee_update_program','trainee_update_note',
                     'trainee_add_exercise','trainee_add_meal','trainee_save_state')
 order by 1;
