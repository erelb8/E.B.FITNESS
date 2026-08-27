-- =====================================================================
--  E.B FIT — שם משתמש וסיסמה למתאמן
--  להרצה ב-Supabase: SQL Editor -> New query -> הדבק הכל -> Run
--  ניתן להריץ שוב ושוב בבטחה.
--
--  למה לא חשבונות Supabase רגילים למתאמנים:
--    זה היה מחייב אימייל לכל מתאמן ואימות במייל — חיכוך שמונע כניסה.
--    כאן המאמן קובע את הפרטים, והמתאמן פשוט נכנס.
--
--  אבטחה:
--    * הסיסמה נשמרת כ-hash של bcrypt (pgcrypto). הטקסט המקורי לא
--      נשמר בשום מקום ואי אפשר לשחזר אותו.
--    * ההשוואה נעשית בתוך פונקציה בשרת; ה-hash לא נחשף ללקוח לעולם.
--    * נעילה מתגברת אחרי ניסיונות כושלים, נגד ניחוש סיסמאות.
--    * הודעת שגיאה אחידה, כדי לא להסגיר אילו שמות משתמש קיימים.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. עמודות ההתחברות
-- ---------------------------------------------------------------------
alter table public.trainees
  add column if not exists username     text,
  add column if not exists pass_hash    text,
  add column if not exists login_fails  integer     not null default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists last_login   timestamptz;

-- שם משתמש ייחודי בכל המערכת (רק כשהוא קיים)
create unique index if not exists trainees_username_uniq
  on public.trainees (lower(username)) where username is not null;

-- ---------------------------------------------------------------------
-- 2. המאמן קובע שם משתמש וסיסמה
--    נקרא ע"י המאמן המחובר בלבד, ורק על מתאמן שלו.
-- ---------------------------------------------------------------------
create or replace function public.set_trainee_login(
  p_trainee_id text,
  p_username   text,
  p_password   text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_owner uuid; v_user text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select trainer_id into v_owner from public.trainees where id = p_trainee_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'not your trainee';
  end if;

  -- ביטול ההתחברות
  if p_username is null or btrim(p_username) = '' then
    update public.trainees
       set username = null, pass_hash = null, login_fails = 0, locked_until = null
     where id = p_trainee_id;
    return;
  end if;

  v_user := lower(btrim(p_username));

  if length(v_user) < 3 then
    raise exception 'שם המשתמש קצר מדי';
  end if;
  if v_user !~ '^[a-z0-9._-]+$' then
    raise exception 'שם המשתמש יכול להכיל אותיות באנגלית, ספרות, נקודה, מקף וקו תחתון בלבד';
  end if;

  -- סיסמה חדשה היא אופציונלית: אפשר לשנות רק את שם המשתמש
  if p_password is not null and p_password <> '' then
    if length(p_password) < 6 then
      raise exception 'הסיסמה חייבת להיות לפחות 6 תווים';
    end if;
    update public.trainees
       set username     = v_user,
           pass_hash    = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
           login_fails  = 0,
           locked_until = null
     where id = p_trainee_id;
  else
    if (select pass_hash from public.trainees where id = p_trainee_id) is null then
      raise exception 'צריך להגדיר סיסמה';
    end if;
    update public.trainees set username = v_user where id = p_trainee_id;
  end if;

exception
  when unique_violation then
    raise exception 'שם המשתמש כבר תפוס';
end $$;

-- ---------------------------------------------------------------------
-- 3. המתאמן מתחבר
--    מחזיר את אותם נתונים כמו הקישור האישי, בתוספת הטוקן —
--    כדי שהמכשיר שלו יזכור אותו ולא יצטרך להתחבר בכל פעם.
-- ---------------------------------------------------------------------
create or replace function public.trainee_login(
  p_username text,
  p_password text
)
returns table (
  name text, goal text, program jsonb, files jsonb,
  trainer_name text, goal2 text, success3m text, token text
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
    -- נעילה מתגברת: מ-3 כשלונות ואילך, דקה לכל כשלון נוסף
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
           r.access_token;
end $$;

-- ---------------------------------------------------------------------
-- 4. היעדים של המתאמן נחשפים לו
--    שליפה מפורשת של שני שדות בלבד מתוך private. שאר התוכן שם —
--    טלפון, בריאות, תשלומים — ממשיך לא להיחשף בשום מסלול.
-- ---------------------------------------------------------------------
drop function if exists public.trainee_program(text);

create or replace function public.trainee_program(p_token text)
returns table (
  name text, goal text, program jsonb, files jsonb,
  trainer_name text, goal2 text, success3m text
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
         t.private->'intake'->'answers'->>'success3m'
  from public.trainees t
  left join public.trainer_prefs p on p.trainer_id = t.trainer_id
  where t.access_token = p_token
    and t.access_active
    and not t.deleted
    and t.status <> 'archived';
$$;

-- ---------------------------------------------------------------------
-- 5. הרשאות
-- ---------------------------------------------------------------------
revoke all on function public.trainee_program(text)          from public, anon, authenticated;
revoke all on function public.trainee_login(text, text)       from public, anon, authenticated;
revoke all on function public.set_trainee_login(text,text,text) from public, anon, authenticated;

grant execute on function public.trainee_program(text)          to anon, authenticated;
grant execute on function public.trainee_login(text, text)       to anon, authenticated;
grant execute on function public.set_trainee_login(text,text,text) to authenticated;  -- המאמן בלבד
