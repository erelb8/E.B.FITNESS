-- =====================================================================
--  E.B FIT — ארוחות עם תמונות
--  להרצה ב-Supabase: SQL Editor -> New query -> הדבק הכל -> Run
--  ניתן להריץ שוב ושוב בבטחה.
--
--  התפריט הוא עמודה גלויה ולא חלק מ-private, כי המתאמן צריך לראות
--  אותו. הוא מוחזר בשתי דרכי הכניסה — קישור אישי ושם משתמש.
-- =====================================================================

alter table public.trainees
  add column if not exists meals jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------
-- שליפה בקישור אישי
-- ---------------------------------------------------------------------
drop function if exists public.trainee_program(text);

create or replace function public.trainee_program(p_token text)
returns table (
  name text, goal text, program jsonb, files jsonb,
  trainer_name text, goal2 text, success3m text, meals jsonb
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
         coalesce(p.data->>'trainer', 'המאמן שלך'),
         t.private->'intake'->'answers'->>'goal2',
         t.private->'intake'->'answers'->>'success3m',
         coalesce(t.meals, '[]'::jsonb)
  from public.trainees t
  left join public.trainer_prefs p on p.trainer_id = t.trainer_id
  where t.access_token = p_token
    and t.access_active
    and not t.deleted
    and t.status <> 'archived';
$$;

-- ---------------------------------------------------------------------
-- שליפה בכניסה עם שם משתמש
-- ---------------------------------------------------------------------
create or replace function public.trainee_login(
  p_username text,
  p_password text
)
returns table (
  name text, goal text, program jsonb, files jsonb,
  trainer_name text, goal2 text, success3m text, meals jsonb, token text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare r record; v_user text;
begin
  v_user := lower(btrim(coalesce(p_username, '')));

  select t.* into r
    from public.trainees t
   where lower(t.username) = v_user
     and t.access_active and not t.deleted and t.status <> 'archived';

  -- הודעה אחידה: לא מסגירים אם שם המשתמש קיים
  if r.id is null then
    perform pg_sleep(0.4);
    raise exception 'שם משתמש או סיסמה שגויים';
  end if;

  if r.locked_until is not null and r.locked_until > now() then
    raise exception 'החשבון נעול זמנית. נסה שוב בעוד כמה דקות.';
  end if;

  if r.pass_hash is null
     or extensions.crypt(coalesce(p_password, ''), r.pass_hash) <> r.pass_hash then
    update public.trainees
       set login_fails  = login_fails + 1,
           locked_until = case when login_fails + 1 >= 3
                               then now() + ((login_fails + 1 - 2) * interval '1 minute')
                               else null end
     where id = r.id;
    perform pg_sleep(0.4);
    raise exception 'שם משתמש או סיסמה שגויים';
  end if;

  update public.trainees
     set login_fails = 0, locked_until = null, last_login = now()
   where id = r.id;

  return query
    select r.name,
           r.goal,
           r.program,
           coalesce(r.files, '[]'::jsonb),
           coalesce((select p.data->>'trainer'
                       from public.trainer_prefs p
                      where p.trainer_id = r.trainer_id), 'המאמן שלך'),
           r.private->'intake'->'answers'->>'goal2',
           r.private->'intake'->'answers'->>'success3m',
           coalesce(r.meals, '[]'::jsonb),
           r.access_token;
end $$;

-- ---------------------------------------------------------------------
-- הרשאות
-- ---------------------------------------------------------------------
revoke all on function public.trainee_program(text)    from public, anon, authenticated;
revoke all on function public.trainee_login(text,text)  from public, anon, authenticated;
grant execute on function public.trainee_program(text)   to anon, authenticated;
grant execute on function public.trainee_login(text,text) to anon, authenticated;

-- בדיקה
select 'meals column' as check, count(*) as ok
  from information_schema.columns
 where table_name='trainees' and column_name='meals';
