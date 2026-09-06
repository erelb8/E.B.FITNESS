-- =====================================================================
-- E.B FIT — המתאמן עורך את תוכנית האימון שלו
-- ---------------------------------------------------------------------
-- שתי פונקציות חדשות לדף המתאמן:
--   trainee_update_program   — שומר את ימי התוכנית אחרי עריכה/מחיקה
--   trainee_update_exercises — שומר דריסות (סטים/חזרות/הערה) לתרגילים
--                              שהמתאמן הוסיף בעצמו
--
-- שתיהן security definer ומזהות את המתאמן דרך הטוקן האישי בלבד,
-- בדיוק כמו trainee_log. הערכים מנוקים ונחתכים בשרת, והכתיבה היא
-- רק לשורה של בעל הטוקן.
--
-- jsonb_set על העמודה הקיימת (ולא החלפה מלאה) שומר את שאר שדות
-- התוכנית — למשל program.targets שהמאמן קבע — בלי שהמתאמן יכול
-- לשנות אותם.
--
-- הרצה: Supabase -> SQL Editor -> New query -> הדבק הכל -> Run
-- בטוח להרצה חוזרת.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. שמירת תוכנית האימון (ימים + תרגילים) מהמתאמן
-- ---------------------------------------------------------------------
create or replace function public.trainee_update_program(
  p_token   text,
  p_program jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    text;
  v_days  jsonb;
  v_clean jsonb := '[]'::jsonb;
  v_ex    jsonb;
  d       jsonb;
  e       jsonb;
begin
  select id into v_id from public.trainees
   where access_token = p_token and access_active
     and not deleted and status <> 'archived';
  if v_id is null then
    raise exception 'invalid token';
  end if;

  v_days := coalesce(p_program->'days', '[]'::jsonb);
  if jsonb_typeof(v_days) <> 'array' or jsonb_array_length(v_days) > 14 then
    raise exception 'תוכנית לא תקינה';
  end if;

  -- בונים עותק נקי: רק השדות שהעורך מכיר, באורכים מוגבלים
  for d in select value from jsonb_array_elements(v_days) loop
    v_ex := '[]'::jsonb;
    if jsonb_typeof(d->'exercises') = 'array' then
      for e in select value from jsonb_array_elements(d->'exercises') loop
        if jsonb_array_length(v_ex) >= 40 then exit; end if;
        v_ex := v_ex || jsonb_build_array(jsonb_build_object(
          'name',   left(coalesce(e->>'name',   ''), 120),
          'sets',   left(coalesce(e->>'sets',   ''), 10),
          'reps',   left(coalesce(e->>'reps',   ''), 10),
          'rest',   left(coalesce(e->>'rest',   ''), 10),
          'weight', left(coalesce(e->>'weight', ''), 20),
          'note',   left(coalesce(e->>'note',   ''), 300)
        ));
      end loop;
    end if;
    v_clean := v_clean || jsonb_build_array(jsonb_build_object(
      'name',      left(coalesce(d->>'name', ''), 80),
      'exercises', v_ex
    ));
  end loop;

  -- רק הימים מוחלפים; targets ושדות אחרים של המאמן נשמרים
  update public.trainees
     set program = jsonb_set(coalesce(program, '{}'::jsonb), '{days}', v_clean)
   where id = v_id
   returning program into p_program;

  return p_program;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. שמירת התרגילים האישיים (כולל דריסת סטים/חזרות/הערה)
-- ---------------------------------------------------------------------
create or replace function public.trainee_update_exercises(
  p_token     text,
  p_exercises jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    text;
  v_clean jsonb := '[]'::jsonb;
  v_row   jsonb;
  e       jsonb;
begin
  select id into v_id from public.trainees
   where access_token = p_token and access_active
     and not deleted and status <> 'archived';
  if v_id is null then
    raise exception 'invalid token';
  end if;

  if jsonb_typeof(p_exercises) is distinct from 'array'
     or jsonb_array_length(coalesce(p_exercises, '[]'::jsonb)) > 40 then
    raise exception 'רשימת תרגילים לא תקינה';
  end if;

  for e in select value from jsonb_array_elements(p_exercises) loop
    if coalesce(e->>'exId', '') = '' then continue; end if;
    v_row := jsonb_build_object(
      'exId', left(e->>'exId', 60),
      'name', left(coalesce(e->>'name', ''), 120),
      'at',   left(coalesce(e->>'at',   ''), 10)
    );
    -- דריסות אופציונליות: נשמרות רק אם המתאמן מילא אותן
    if coalesce(e->>'s', '') <> '' then
      v_row := v_row || jsonb_build_object('s', left(e->>'s', 10));
    end if;
    if coalesce(e->>'r', '') <> '' then
      v_row := v_row || jsonb_build_object('r', left(e->>'r', 10));
    end if;
    if coalesce(e->>'note', '') <> '' then
      v_row := v_row || jsonb_build_object('note', left(e->>'note', 300));
    end if;
    v_clean := v_clean || jsonb_build_array(v_row);
  end loop;

  update public.trainees
     set exercises_self = v_clean
   where id = v_id
   returning exercises_self into v_clean;

  return v_clean;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. הרשאות — anon, כמו שאר פונקציות המתאמן
-- ---------------------------------------------------------------------
revoke all on function public.trainee_update_program(text, jsonb)   from public, anon, authenticated;
revoke all on function public.trainee_update_exercises(text, jsonb) from public, anon, authenticated;
grant execute on function public.trainee_update_program(text, jsonb)   to anon, authenticated;
grant execute on function public.trainee_update_exercises(text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
