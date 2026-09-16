-- E.B FIT - reject writes from a device holding a stale copy.
-- Supabase -> SQL Editor -> Run. Safe to re-run.
--
-- Why: the trainer works from two devices. "last write wins" was
-- implemented by push order, not by version, so whichever device held
-- an old copy overwrote fresher data. On 15-16.9.2026 a whole training
-- program was wiped four times and the gender field of eleven trainees
-- three times, each time reverting to the exact same old state.
--
-- The client-side guard (v137) is correct but insufficient: a device
-- still running an older build simply skips it. This guard lives in the
-- database, so no client version can bypass it.
--
-- Rule: every row carries a revision counter. An update that changes
-- content must carry a HIGHER counter than the server's. Lower or
-- missing means the device is behind, and the write is rejected.
--
-- NOTE: after this runs, a device older than v137 can no longer save
-- and will get an error. That is intended - such a device is exactly
-- what has been deleting the data. Refresh it to v137.

-- 1. seed a counter on every existing row
update public.trainees
   set private = coalesce(private, '{}'::jsonb) || jsonb_build_object('rev', 1)
 where private is null or private->>'rev' is null;

update public.sessions
   set data = coalesce(data, '{}'::jsonb) || jsonb_build_object('rev', 1)
 where data is null or data->>'rev' is null;

update public.measures
   set data = coalesce(data, '{}'::jsonb) || jsonb_build_object('rev', 1)
 where data is null or data->>'rev' is null;

update public.payments
   set data = coalesce(data, '{}'::jsonb) || jsonb_build_object('rev', 1)
 where data is null or data->>'rev' is null;

-- 2. guard for the trainees table
create or replace function public.guard_stale_trainee()
returns trigger
language plpgsql
as $$
declare
  old_rev int;
  new_rev int;
begin
  -- Updates that do not touch trainer-written content pass through:
  -- soft delete, access token, lockout, and everything the trainee
  -- writes through their own RPC (meals_self, health, weighins,
  -- session_state). None of those caused the losses, and blocking
  -- them would break the trainee page.
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

drop trigger if exists trg_guard_stale_trainee on public.trainees;
create trigger trg_guard_stale_trainee
  before update on public.trainees
  for each row execute function public.guard_stale_trainee();

-- 3. same guard for the child tables
create or replace function public.guard_stale_child()
returns trigger
language plpgsql
as $$
declare
  old_rev int;
  new_rev int;
begin
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

drop trigger if exists trg_guard_stale_sessions on public.sessions;
create trigger trg_guard_stale_sessions
  before update on public.sessions
  for each row execute function public.guard_stale_child();

drop trigger if exists trg_guard_stale_measures on public.measures;
create trigger trg_guard_stale_measures
  before update on public.measures
  for each row execute function public.guard_stale_child();

drop trigger if exists trg_guard_stale_payments on public.payments;
create trigger trg_guard_stale_payments
  before update on public.payments
  for each row execute function public.guard_stale_child();

notify pgrst, 'reload schema';

-- verification
select 'trainees with counter' as check,
       count(*) filter (where private->>'rev' is not null) || ' / ' || count(*) as result
  from public.trainees where not deleted
union all
select 'active guards',
       string_agg(tgname, ', ')
  from pg_trigger
 where tgname like 'trg_guard_stale%' and not tgisinternal;
