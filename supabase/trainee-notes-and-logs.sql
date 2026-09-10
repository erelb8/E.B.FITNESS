-- =====================================================================
--  E.B FIT — הערת המתאמן, שמירת אימון בעבודה, והיסטוריה לגרף
--  Supabase -> SQL Editor -> New query -> הדבק הכל -> Run
--  בטוח להרצה חוזרת.
-- ---------------------------------------------------------------------
--  שלוש יכולות חדשות לדף המתאמן:
--
--    trainee_update_note   — המתאמן כותב הערה משלו, והמאמן רואה אותה
--    trainee_save_state    — המשקלים שהוקלדו תוך כדי אימון נשמרים
--    trainee_extras        — יומן הביצוע וההיסטוריה, לגרף ולמאמן החכם
--
--  למה פונקציה נפרדת ולא הרחבה של trainee_program:
--  trainee_program הוגדרה מחדש כבר ארבע פעמים בקבצים שונים, וכל
--  הגדרה מחדש דרסה עמודות שהקודמת החזירה — כך נעלמו weighins ו-health
--  לזמן מה. פונקציה נפרדת לא נכנסת למרוץ הזה, ואם מישהו יגדיר את
--  trainee_program מחדש בעתיד — הגרף והמאמן החכם ימשיכו לעבוד.
--
--  הערת המתאמן נשמרת ב-program->'traineeNote'. jsonb_set על המפתח
--  הזה בלבד: המתאמן אינו יכול לגעת ב-days, ב-targets, או בהערות
--  שהמאמן כתב, גם אם ישלח מטען אחר.
-- =====================================================================

alter table public.trainees
  add column if not exists session_state jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------
-- 1. הערת המתאמן
-- ---------------------------------------------------------------------
create or replace function public.trainee_update_note(
  p_token text,
  p_note  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id text; v_note text; v_prog jsonb;
begin
  select id into v_id
    from public.trainees
   where access_token = p_token and access_active
     and not deleted and status <> 'archived';

  if v_id is null then raise exception 'invalid token'; end if;

  -- נחתך בשרת ולא בדפדפן: המתאמן שולט על מה שנשלח
  v_note := left(btrim(coalesce(p_note, '')), 2000);

  update public.trainees
     set program = jsonb_set(coalesce(program, '{}'::jsonb),
                             '{traineeNote}', to_jsonb(v_note), true)
   where id = v_id
   returning program into v_prog;

  return v_prog;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. שמירת האימון שבעבודה
--
--    המשקלים שהמתאמן מקליד תוך כדי אימון היו עד היום במשתנה בזיכרון
--    בלבד. נעילת מסך, רענון או מעבר לאפליקציה אחרת מחקו את הכל, והוא
--    היה מקליד מחדש. כאן זה נשמר, ולכן גם שורד מעבר למכשיר אחר.
--
--    זו טיוטה ולא דיווח: הדיווח הרשמי נשאר trainee_log, והוא מה
--    שנכנס ל-workout_logs ומזין את הגרף.
-- ---------------------------------------------------------------------
create or replace function public.trainee_save_state(
  p_token text,
  p_state jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_id text;
begin
  select id into v_id
    from public.trainees
   where access_token = p_token and access_active
     and not deleted and status <> 'archived';

  if v_id is null then raise exception 'invalid token'; end if;

  -- תקרת גודל: טיוטה סבירה היא כמה מאות בתים. בלי תקרה, לקוח תקול
  -- יכול לנפח את השורה עד שהשליפה של המתאמן תיתקע.
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'bad state';
  end if;
  if length(p_state::text) > 60000 then
    raise exception 'state too large';
  end if;

  update public.trainees set session_state = p_state where id = v_id;
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. ההיסטוריה — לגרף ולמאמן החכם
--
--    מוחזר רק מה ששייך לבעל הטוקן. security definer עוקף RLS, ולכן
--    הסינון לפי trainee_id כאן הוא ההגנה עצמה ולא נוחות.
-- ---------------------------------------------------------------------
create or replace function public.trainee_extras(
  p_token text,
  p_limit integer default 120
)
returns table (
  logs          jsonb,
  session_state jsonb,
  weighins      jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  with me as (
    select id, coalesce(session_state, '{}'::jsonb) as st,
           coalesce(weighins, '[]'::jsonb) as w
      from public.trainees
     where access_token = p_token and access_active
       and not deleted and status <> 'archived'
     limit 1
  )
  select
    coalesce((
      select jsonb_agg(x order by x->>'date')
        from (
          select jsonb_build_object(
                   'date',    l.date,
                   'dayName', l.day_name,
                   'entries', l.entries,
                   'feel',    l.feel
                 ) as x
            from public.workout_logs l
           where l.trainee_id = (select id from me)
           order by l.date desc
           limit greatest(1, least(coalesce(p_limit, 120), 500))
        ) s
    ), '[]'::jsonb),
    (select st from me),
    (select w  from me)
  from me;
$$;

-- ---------------------------------------------------------------------
-- 4. הרשאות
-- ---------------------------------------------------------------------
revoke all on function public.trainee_update_note(text, text)    from public, anon, authenticated;
revoke all on function public.trainee_save_state(text, jsonb)    from public, anon, authenticated;
revoke all on function public.trainee_extras(text, integer)      from public, anon, authenticated;

grant execute on function public.trainee_update_note(text, text) to anon, authenticated;
grant execute on function public.trainee_save_state(text, jsonb) to anon, authenticated;
grant execute on function public.trainee_extras(text, integer)   to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. אימות
-- ---------------------------------------------------------------------
select 'trainee_update_note' as fn, to_regprocedure('public.trainee_update_note(text,text)')  is not null as קיימת
union all
select 'trainee_save_state',        to_regprocedure('public.trainee_save_state(text,jsonb)')  is not null
union all
select 'trainee_extras',            to_regprocedure('public.trainee_extras(text,integer)')    is not null;
