-- =====================================================================
--  E.B FIT — הצהרת בריאות ושקילה שבועית מהמתאמן
--  Supabase -> SQL Editor -> New query -> הדבק הכל -> Run
--  בטוח להרצה חוזרת.
--
--  שתי עמודות נפרדות, מאותה סיבה שבגללה meals_self נפרדת:
--  המאמן דוחף את רשומת המתאמן בשלמותה בכל סנכרון, ולכן כל דבר
--  שהמתאמן כותב לתוך אותה רשומה היה נמחק בסנכרון הבא.
--  health ו-weighins נכתבות אך ורק דרך הפונקציות כאן.
--
--  הצהרת בריאות היא מידע רפואי. היא לא יוצאת מהטבלה הזאת:
--  לא למייל, לא לריפו, ולא לתוכן שיווקי.
-- =====================================================================

alter table public.trainees
  add column if not exists health   jsonb not null default '{}'::jsonb,
  add column if not exists weighins jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------
-- 1. שתי דרכי הכניסה מחזירות גם את ההצהרה
-- ---------------------------------------------------------------------
drop function if exists public.trainee_program(text);

create or replace function public.trainee_program(p_token text)
returns table (
  name text, goal text, program jsonb, files jsonb,
  trainer_name text, goal2 text, success3m text,
  meals jsonb, meals_self jsonb, exercises_self jsonb,
  health jsonb, weighins jsonb
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
         coalesce(t.weighins, '[]'::jsonb)
  from public.trainees t
  left join public.trainer_prefs p on p.trainer_id = t.trainer_id
  where t.access_token = p_token
    and t.access_active
    and not t.deleted
    and t.status <> 'archived'
  limit 1;
$$;

drop function if exists public.trainee_login(text, text);

create or replace function public.trainee_login(
  p_username text,
  p_password text
)
returns table (
  name text, goal text, program jsonb, files jsonb,
  trainer_name text, goal2 text, success3m text,
  meals jsonb, meals_self jsonb, exercises_self jsonb,
  health jsonb, weighins jsonb, token text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare r record;
begin
  select * into r from public.trainees
   where lower(username) = lower(btrim(coalesce(p_username,'')))
     and not deleted and status <> 'archived'
   limit 1;

  -- הודעה אחידה בכל מקרה של כישלון, כדי שלא ניתן יהיה לגלות
  -- אילו שמות משתמש קיימים על ידי השוואת התשובות
  if r.id is null
     or r.pass_hash is null
     or not coalesce(r.access_active, false)
     or (r.locked_until is not null and r.locked_until > now())
     or r.pass_hash <> extensions.crypt(coalesce(p_password,''), r.pass_hash)
  then
    if r.id is not null then
      update public.trainees
         set fails = coalesce(fails,0) + 1,
             locked_until = case when coalesce(fails,0) + 1 >= 5
                                 then now() + interval '15 minutes' else locked_until end
       where id = r.id;
    end if;
    raise exception 'bad_credentials';
  end if;

  update public.trainees set fails = 0, locked_until = null where id = r.id;

  return query
    select r.name, r.goal, r.program,
           coalesce(r.files, '[]'::jsonb),
           coalesce(
             nullif(btrim(coalesce(p.data->'settings'->>'trainer', '')), ''),
             nullif(btrim(coalesce(p.data->>'trainer', '')), ''),
             'המאמן שלך'
           ),
           r.private->'intake'->'answers'->>'goal2',
           r.private->'intake'->'answers'->>'success3m',
           coalesce(r.meals, '[]'::jsonb),
           coalesce(r.meals_self, '[]'::jsonb),
           coalesce(r.exercises_self, '[]'::jsonb),
           coalesce(r.health, '{}'::jsonb),
           coalesce(r.weighins, '[]'::jsonb),
           r.access_token
    from public.trainer_prefs p
    where p.trainer_id = r.trainer_id
    union all
    select r.name, r.goal, r.program,
           coalesce(r.files, '[]'::jsonb), 'המאמן שלך',
           r.private->'intake'->'answers'->>'goal2',
           r.private->'intake'->'answers'->>'success3m',
           coalesce(r.meals, '[]'::jsonb),
           coalesce(r.meals_self, '[]'::jsonb),
           coalesce(r.exercises_self, '[]'::jsonb),
           coalesce(r.health, '{}'::jsonb),
           coalesce(r.weighins, '[]'::jsonb),
           r.access_token
    where not exists (select 1 from public.trainer_prefs p2 where p2.trainer_id = r.trainer_id)
    limit 1;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. המתאמן שולח הצהרת בריאות
-- ---------------------------------------------------------------------
create or replace function public.trainee_health(
  p_token  text,
  p_health jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_out jsonb;
begin
  select id into v_id from public.trainees
   where access_token = p_token and access_active
     and not deleted and status <> 'archived'
   limit 1;
  if v_id is null then raise exception 'bad_token'; end if;

  -- חותמת הזמן נקבעת בשרת ולא נלקחת מהלקוח, כדי שלא ניתן יהיה
  -- לרשום תאריך חתימה שגוי מהמכשיר
  v_out := coalesce(p_health, '{}'::jsonb)
           || jsonb_build_object('signedAt', to_char(now(), 'YYYY-MM-DD'),
                                 'receivedAt', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'));

  update public.trainees set health = v_out where id = v_id;
  return v_out;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. המתאמן מזין שקילה שבועית
-- ---------------------------------------------------------------------
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
declare v_id uuid; v_rows jsonb; v_day text;
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

  -- שקילה חוזרת באותו יום מחליפה את הקודמת ולא מצטברת לצידה
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

-- ---------------------------------------------------------------------
-- 4. הרשאות — אנונימי רשאי לקרוא לפונקציות בלבד, לא לטבלה
-- ---------------------------------------------------------------------
grant execute on function public.trainee_program(text)                    to anon, authenticated;
grant execute on function public.trainee_login(text, text)                to anon, authenticated;
grant execute on function public.trainee_health(text, jsonb)              to anon, authenticated;
grant execute on function public.trainee_weigh(text, text, numeric, numeric) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. תיעוד ההסכמה לעיבוד מידע רפואי
--    ההסכמה נשמרת בתוך health כאובייקט consent, ולכן אין צורך בעמודה
--    חדשה. השאילתה כאן היא לבדיקה: מי הסכים, מתי, ולאיזה נוסח.
-- ---------------------------------------------------------------------
create or replace view public.consent_log as
  select id,
         name,
         health->'consent'->>'at'       as consented_at,
         health->'consent'->>'version'  as notice_version,
         health->>'signedAt'            as declared_at,
         (health->'consent') is not null as has_consent
    from public.trainees
   where not deleted;

comment on view public.consent_log is
  'מי מסר הסכמה לעיבוד מידע רפואי, מתי, ולאיזו גרסת נוסח. לצורכי הוכחת עמידה בחוק.';
