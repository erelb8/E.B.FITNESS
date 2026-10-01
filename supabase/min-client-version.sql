-- E.B FIT - reject writes from old app versions.
-- Supabase -> SQL Editor -> paste all -> Run. Safe to re-run.
--
-- Why: on 30.9-1.10.2026 a device left open with an old version kept
-- writing old copies of trainees over newer data - birth dates erased
-- again and again, a program rolled back twice - after every fix had
-- already shipped. The fixes simply were not running on that device.
--
-- From v201 every row the app pushes carries its version (private.appVer
-- for trainees, data.appVer for sessions/measures/payments). Here a
-- trainer write (anon/authenticated - the sync path) is rejected unless
-- the version is at least v201. The old device gets an error asking to
-- reopen the app; it cannot overwrite anything.
--
-- Trainee RPCs and the SQL editor run as the function owner and are not
-- affected (same rule as guard-stale-writes-fix.sql).
-- To raise the minimum later: change the number in app_ver_ok() and re-run.
-- 202: v201 let a stale device that had just updated win over newer server rows.
-- 203: v202 let a second window on the same device push its stale rows,
--      because the sync snapshot is shared across windows. Rows now carry their own rev.

create or replace function public.app_ver_ok(v text)
returns boolean
language sql
immutable
as $$
  select coalesce(substring(coalesce(v, '') from '^v(\d+)$')::int, 0) >= 203
$$;

create or replace function public.guard_min_version_trainee()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  -- an update that changes no content (e.g. only "deleted") is not a stale copy
  if tg_op = 'UPDATE'
     and new.private is not distinct from old.private
     and new.program is not distinct from old.program
     and new.name    is not distinct from old.name
     and new.goal    is not distinct from old.goal
     and new.files   is not distinct from old.files
     and new.meals   is not distinct from old.meals then
    return new;
  end if;
  if not public.app_ver_ok(new.private->>'appVer') then
    raise exception
      'גרסה ישנה של האפליקציה במכשיר הזה. השמירה נדחתה כדי לא לדרוס נתונים חדשים. סגור את האפליקציה לגמרי ופתח אותה מחדש.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.guard_min_version_child()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.data is not distinct from old.data
     and new.date is not distinct from old.date then
    return new;
  end if;
  if not public.app_ver_ok(new.data->>'appVer') then
    raise exception
      'גרסה ישנה של האפליקציה במכשיר הזה. השמירה נדחתה. סגור את האפליקציה לגמרי ופתח אותה מחדש.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_min_version_trainee on public.trainees;
create trigger trg_min_version_trainee
  before insert or update on public.trainees
  for each row execute function public.guard_min_version_trainee();

drop trigger if exists trg_min_version_sessions on public.sessions;
create trigger trg_min_version_sessions
  before insert or update on public.sessions
  for each row execute function public.guard_min_version_child();

drop trigger if exists trg_min_version_measures on public.measures;
create trigger trg_min_version_measures
  before insert or update on public.measures
  for each row execute function public.guard_min_version_child();

drop trigger if exists trg_min_version_payments on public.payments;
create trigger trg_min_version_payments
  before insert or update on public.payments
  for each row execute function public.guard_min_version_child();

notify pgrst, 'reload schema';

-- verification: should list 4 triggers
select tgname as trigger, tgrelid::regclass as on_table
  from pg_trigger
 where tgname like 'trg_min_version_%'
 order by 1;
