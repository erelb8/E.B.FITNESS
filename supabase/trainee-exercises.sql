-- =====================================================================
--  E.B FIT — המתאמן מוסיף לעצמו תרגילים מהספרייה
--  Supabase -> SQL Editor -> New query -> הדבק הכל -> Run
--  בטוח להרצה חוזרת.
--
--  עמודה נפרדת מ-program, בדיוק כמו meals_self: המאמן דוחף את
--  program בשלמותה בכל סנכרון, ולכן תרגיל שהמתאמן היה מוסיף לשם
--  נמחק בסנכרון הבא. exercises_self נכתבת רק מכאן.
-- =====================================================================

alter table public.trainees
  add column if not exists exercises_self jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------
-- 1. שתי דרכי הכניסה מחזירות גם את מה שהמתאמן הוסיף
-- ---------------------------------------------------------------------
drop function if exists public.trainee_program(text);

create or replace function public.trainee_program(p_token text)
returns table (
  name text, goal text, program jsonb, files jsonb,
  trainer_name text, goal2 text, success3m text,
  meals jsonb, meals_self jsonb, exercises_self jsonb
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
         coalesce(t.exercises_self, '[]'::jsonb)
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
  meals jsonb, meals_self jsonb, exercises_self jsonb, token text
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
     or extensions.crypt(coalesce(p_password,''), r.pass_hash) <> r.pass_hash then

    if r.id is not null then
      update public.trainees
         set login_fails  = coalesce(login_fails,0) + 1,
             locked_until = case
               when coalesce(login_fails,0) + 1 >= 5
                 then now() + (least(coalesce(login_fails,0) - 3, 6) * interval '5 minutes')
               else locked_until end
       where id = r.id;
    end if;
    raise exception 'שם משתמש או סיסמה שגויים';
  end if;

  update public.trainees
     set login_fails = 0, locked_until = null, last_login = now()
   where id = r.id;

  return query
    select r.name, r.goal, r.program,
           coalesce(r.files, '[]'::jsonb),
           coalesce(
             nullif(btrim(coalesce((select p.data->'settings'->>'trainer'
                                      from public.trainer_prefs p
                                     where p.trainer_id = r.trainer_id), '')), ''),
             'המאמן שלך'
           ),
           r.private->'intake'->'answers'->>'goal2',
           r.private->'intake'->'answers'->>'success3m',
           coalesce(r.meals, '[]'::jsonb),
           coalesce(r.meals_self, '[]'::jsonb),
           coalesce(r.exercises_self, '[]'::jsonb),
           r.access_token;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. הוספה
--    נשמר רק מזהה התרגיל בספרייה ולא התוכן: הספרייה נשלחת עם
--    האפליקציה, ואם הערכים של תרגיל יתוקנו בעתיד, עותק שנשמר במלואו
--    היה נשאר שגוי לנצח.
-- ---------------------------------------------------------------------
create or replace function public.trainee_add_exercise(
  p_token  text,
  p_ex_id  text,
  p_name   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id text; v_cur jsonb; v_row jsonb;
begin
  if p_ex_id is null or btrim(p_ex_id) = '' or length(p_ex_id) > 60 then
    raise exception 'מזהה תרגיל לא תקין';
  end if;

  select id, coalesce(exercises_self,'[]'::jsonb) into v_id, v_cur
    from public.trainees
   where access_token = p_token and access_active
     and not deleted and status <> 'archived';

  if v_id is null then
    raise exception 'invalid token';
  end if;

  if jsonb_array_length(v_cur) >= 40 then
    raise exception 'הגעת למקסימום התרגילים שאפשר להוסיף';
  end if;

  if exists (select 1 from jsonb_array_elements(v_cur) e
              where e->>'exId' = p_ex_id) then
    return v_cur;
  end if;

  v_row := jsonb_build_object(
    'exId', p_ex_id,
    'name', left(coalesce(p_name,''), 120),
    'at',   to_char(now() at time zone 'Asia/Jerusalem', 'YYYY-MM-DD')
  );

  update public.trainees
     set exercises_self = v_cur || jsonb_build_array(v_row)
   where id = v_id
   returning exercises_self into v_cur;

  return v_cur;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. הסרה
-- ---------------------------------------------------------------------
create or replace function public.trainee_remove_exercise(
  p_token text,
  p_ex_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id text; v_new jsonb;
begin
  select id into v_id from public.trainees
   where access_token = p_token and access_active
     and not deleted and status <> 'archived';

  if v_id is null then
    raise exception 'invalid token';
  end if;

  update public.trainees
     set exercises_self = coalesce((
           select jsonb_agg(e)
             from jsonb_array_elements(coalesce(exercises_self,'[]'::jsonb)) e
            where e->>'exId' <> p_ex_id
         ), '[]'::jsonb)
   where id = v_id
   returning exercises_self into v_new;

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. הרשאות
-- ---------------------------------------------------------------------
revoke all on function public.trainee_program(text)                  from public, anon, authenticated;
revoke all on function public.trainee_login(text,text)               from public, anon, authenticated;
revoke all on function public.trainee_add_exercise(text,text,text)   from public, anon, authenticated;
revoke all on function public.trainee_remove_exercise(text,text)     from public, anon, authenticated;

grant execute on function public.trainee_program(text)                to anon, authenticated;
grant execute on function public.trainee_login(text,text)             to anon, authenticated;
grant execute on function public.trainee_add_exercise(text,text,text) to anon, authenticated;
grant execute on function public.trainee_remove_exercise(text,text)   to anon, authenticated;
