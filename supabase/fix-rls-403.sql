-- =====================================================================
--  E.B FIT — תיקון 403 בשמירה  (Supabase -> SQL Editor -> Run)
--  בטוח להרצה חוזרת. אינו נוגע בנתונים — רק במדיניות ההרשאה.
-- ---------------------------------------------------------------------
--  התסמין: "שגיאת סנכרון" באפליקציה, ובקונסול 403 על
--  POST /rest/v1/trainees.
--
--  הסיבה: אותה מדיניות בשם trainer_all מוגדרת בשני קבצים, בשתי
--  צורות שאינן מתיישבות:
--
--    schema.sql         using (trainer_id = auth.uid() and ...)
--    db-only-admin.sql  using (trainer_id = public.admin_request_id())
--
--  האפליקציה אינה משתמשת ב-Supabase Auth למאמן. היא מתחברת דרך
--  admin_login, מקבלת טוקן, ושולחת אותו בכותרת x-admin-token — ומשם
--  admin_request_id() מזהה מי המאמן. בארכיטקטורה הזאת auth.uid() הוא
--  תמיד NULL, ולכן ברגע ש-schema.sql רץ אחרון, כל כתיבה נדחית וכל
--  קריאה מחזירה אפס שורות.
--
--  הקובץ הזה מחזיר את המדיניות לגרסת הטוקן, וזו בלבד. הוא אינו יוצר
--  טבלאות ואינו נוגע ב-admins — ולכן אפשר להריץ אותו גם באמצע עבודה.
--
--  אחרי ההרצה: לרענן את האפליקציה. שורת הסנכרון אמורה לחזור ל"מסונכרן".
-- =====================================================================

-- בדיקת שפיות: בלי הפונקציה הזאת אין בכלל זיהוי מאמן, ואז הבעיה
-- אחרת לגמרי — db-only-admin.sql לא רץ מעולם.
do $$
begin
  if to_regprocedure('public.admin_request_id()') is null then
    raise exception
      'הפונקציה admin_request_id() אינה קיימת. צריך להריץ קודם את db-only-admin.sql במלואו.';
  end if;
end $$;

-- ארבע הטבלאות של המאמן
do $$
declare t text;
begin
  foreach t in array array['trainees','sessions','measures','payments'] loop
    execute format('drop policy if exists trainer_all on public.%I', t);
    execute format($f$
      create policy trainer_all on public.%I
        for all to anon, authenticated
        using (trainer_id = public.admin_request_id())
        with check (trainer_id = public.admin_request_id())
    $f$, t);
  end loop;
end $$;

-- העדפות המאמן
drop policy if exists prefs_own on public.trainer_prefs;
create policy prefs_own on public.trainer_prefs
  for all to anon, authenticated
  using (trainer_id = public.admin_request_id())
  with check (trainer_id = public.admin_request_id());

-- יומני האימון: המתאמן כותב דרך פונקציה, המאמן קורא בלבד
drop policy if exists trainer_read_logs on public.workout_logs;
create policy trainer_read_logs on public.workout_logs
  for select to anon, authenticated
  using (exists (
    select 1 from public.trainees tr
    where tr.id = workout_logs.trainee_id
      and tr.trainer_id = public.admin_request_id()
  ));


-- ---------------------------------------------------------------------
--  שכבה שנייה: הרשאות טבלה.
--
--  מדיניות RLS נכונה אינה מספיקה. 403 נובע גם מהיעדר GRANT, וזו
--  שכבה נפרדת לגמרי. schema.sql עושה
--      revoke all on all tables in schema public from anon
--  ואז מעניק ל-authenticated, בעוד שהאפליקציה מתחברת כ-anon —
--  ולכן הרצת schema.sql מנתקת את המאמן מהנתונים של עצמו.
--
--  זה בטוח: מיד אחרי ההרשאה ה-RLS שלמעלה מסנן כל שורה לפי טוקן
--  המנהל. בלי טוקן תקף, anon אינו רואה ואינו כותב דבר.
-- ---------------------------------------------------------------------
grant usage on schema public to anon;

grant select, insert, update, delete on
  public.trainees, public.sessions, public.measures,
  public.payments, public.trainer_prefs
  to anon;

grant select on public.workout_logs to anon;

-- ואלה נשארות חסומות תמיד: שם יושבים גיבובי הסיסמאות
revoke all on public.admins         from anon, authenticated;
revoke all on public.admin_sessions from anon, authenticated;

-- ---------------------------------------------------------------------
-- אימות: מה פעיל עכשיו. כל שורה חייבת להראות admin_request_id.
-- אם מופיע כאן auth.uid — משהו הריץ את schema.sql שוב אחרי הקובץ הזה.
-- ---------------------------------------------------------------------
select tablename,
       policyname,
       qual as "תנאי קריאה",
       with_check as "תנאי כתיבה"
  from pg_policies
 where schemaname = 'public'
   and policyname in ('trainer_all', 'prefs_own', 'trainer_read_logs')
 order by tablename;

-- הרשאות בפועל. admins ו-admin_sessions לא אמורות להופיע כאן כלל.
select table_name as "טבלה",
       string_agg(distinct privilege_type, ', ' order by privilege_type) as "הרשאות ל-anon"
  from information_schema.role_table_grants
 where grantee = 'anon' and table_schema = 'public'
 group by table_name
 order by table_name;
