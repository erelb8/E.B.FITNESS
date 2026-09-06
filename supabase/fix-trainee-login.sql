-- =====================================================================
-- E.B FIT — תיקון: שינוי סיסמה למתאמן מלוח הניהול
-- ---------------------------------------------------------------------
-- הבעיה: set_trainee_login זיהתה את המאמן דרך auth.uid(), אבל
-- האפליקציה מתחברת עם מפתח anon בלבד, והמאמן מזוהה דרך כותרת
-- x-admin-token (הפונקציה admin_request_id מ-db-only-admin.sql).
-- לכן כל קריאה נכשלה ב-'not authenticated' ושינוי הסיסמה לא עבד.
-- בנוסף, ההרשאה ניתנה ל-authenticated בלבד בעוד הלקוח הוא anon.
--
-- תנאי מקדים: db-only-admin.sql הורץ (הוא מגדיר admin_request_id).
-- הרצה: Supabase -> SQL Editor -> New query -> הדבק הכל -> Run
-- בטוח להרצה חוזרת.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

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
  -- המאמן מזוהה דרך כותרת x-admin-token ולא דרך auth.uid
  if public.admin_request_id() is null then
    raise exception 'not authenticated';
  end if;

  select trainer_id into v_owner from public.trainees where id = p_trainee_id;
  if v_owner is null or v_owner <> public.admin_request_id() then
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

revoke all on function public.set_trainee_login(text, text, text) from public, anon, authenticated;
-- הלקוח הוא anon; המאמן מזוהה בתוך הפונקציה דרך admin_request_id
grant execute on function public.set_trainee_login(text, text, text) to anon;

notify pgrst, 'reload schema';
