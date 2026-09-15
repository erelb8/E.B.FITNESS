-- =====================================================================
--  E.B FIT — העלאת תקרת הארוחות של המתאמן
--  Supabase -> SQL Editor -> Run.  בטוח להרצה חוזרת.
-- ---------------------------------------------------------------------
--  trainee_add_meal חוסם מעל 40 ארוחות בתפריט האישי. התקרה נועדה
--  למנוע ניפוח של השורה, אבל 40 הוא מעט מדי: מתאמן שבונה תפריט
--  שבועי מגוון מגיע לשם תוך חודש, ואז אינו יכול להוסיף עוד.
--
--  200 עדיין מגן על השורה — כל פריט הוא מזהה ושם, כמה עשרות בתים —
--  ואינו מגביל שימוש אמיתי.
-- =====================================================================
do $$
begin
  if to_regprocedure('public.trainee_add_meal(text,text,text)') is null then
    raise exception
      'הפונקציה trainee_add_meal אינה קיימת. צריך להריץ קודם את fix-trainer-name.sql.';
  end if;
end $$;

create or replace function public.trainee_add_meal(
  p_token  text,
  p_lib_id text,
  p_name   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  text;
  v_cur jsonb;
begin
  if p_lib_id is null or btrim(p_lib_id) = '' or length(p_lib_id) > 60 then
    raise exception 'מזהה ארוחה לא תקין';
  end if;

  select id, coalesce(meals_self, '[]'::jsonb)
    into v_id, v_cur
    from public.trainees
   where access_token = p_token and access_active
     and not deleted and status <> 'archived';

  if v_id is null then raise exception 'invalid token'; end if;

  -- כבר קיימת — מחזירים את הרשימה כמו שהיא, בלי כפילות
  if exists (
    select 1 from jsonb_array_elements(v_cur) e
     where e->>'libId' = p_lib_id
  ) then
    return v_cur;
  end if;

  if jsonb_array_length(v_cur) >= 200 then
    raise exception 'הגעת ל-200 ארוחות בתפריט. כדי להוסיף עוד, הסר ארוחה שאינך משתמש בה.';
  end if;

  v_cur := v_cur || jsonb_build_object(
    'libId', p_lib_id,
    'name',  left(coalesce(p_name, ''), 120),
    'at',    to_char(now(), 'YYYY-MM-DD')
  );

  update public.trainees set meals_self = v_cur where id = v_id;
  return v_cur;
end;
$$;

revoke all on function public.trainee_add_meal(text,text,text) from public, anon, authenticated;
grant execute on function public.trainee_add_meal(text,text,text) to anon, authenticated;

notify pgrst, 'reload schema';

-- אימות: כמה ארוחות יש לכל מתאמן כרגע, ומי קרוב לתקרה
select name as "שם",
       jsonb_array_length(coalesce(meals_self, '[]'::jsonb)) as "ארוחות בתפריט"
  from public.trainees
 where not deleted
 order by 2 desc, 1;
