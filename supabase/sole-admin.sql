-- =====================================================================
--  E.B FIT — אראל הוא האדמין היחיד
--  Supabase -> SQL Editor -> New query -> הדבק הכל -> Run
--  בטוח להרצה חוזרת.
-- ---------------------------------------------------------------------
--  למה הקובץ הזה קיים:
--
--  admin-access.sql ו-portal-login.sql קיבעו את הכתובת
--  erelbauer@gmail.com, בעוד החשבון בפועל הוא erelbauer7@gmail.com.
--  שתי הפקודות שם נכשלו בשקט מוחלט:
--
--    insert ... select ... where lower(email) = 'erelbauer@gmail.com'
--        לא מצא שורה, ולכן לא הכניס אדמין כלל.
--
--    update ... where user_id <> (select id from auth.users where ...)
--        תת-השאילתה החזירה NULL, ובהשוואה ל-NULL התוצאה היא NULL
--        ולא TRUE — ולכן אף רשומת אדמין אחרת לא כובתה.
--
--  זה מסוכן ולא רק לא-יעיל: current_user_is_admin() שולט על מדיניות
--  ה-RLS של trainees, sessions, measures, payments ו-trainer_prefs.
--  אם ה-RLS הופעל והבעלים לא נכנס לטבלה — הבעלים ננעל מחוץ לנתונים
--  של עצמו, בלי שום הודעת שגיאה שתסביר למה.
--
--  לכן כאן: כתובת נכונה, השוואות שעמידות ל-NULL, ו-raise exception
--  אם המשתמש לא נמצא. עדיף להיכשל ברעש מלהצליח למראית עין.
-- =====================================================================

do $$
declare
  v_email  text := 'erelbauer7@gmail.com';   -- החשבון של הבעלים
  v_name   text := 'אראל באואר';
  v_id     uuid;
  v_off    integer;
begin
  select id into v_id
    from auth.users
   where lower(email) = lower(btrim(v_email));

  if v_id is null then
    raise exception
      'לא קיים משתמש Auth עם הכתובת %. צריך להתחבר לאפליקציה פעם אחת עם החשבון הזה לפני הרצת הקובץ, או לתקן את v_email למעלה.',
      v_email;
  end if;

  -- רשומה ישנה עם אותו מייל אך משתמש אחר תחסום את ההוספה,
  -- כי email מוגדר unique. מסירים אותה לפני.
  delete from public.admins
   where lower(email) = lower(btrim(v_email))
     and user_id is distinct from v_id;

  insert into public.admins (user_id, email, display_name, active)
  values (v_id, lower(btrim(v_email)), v_name, true)
  on conflict (user_id) do update
    set email        = excluded.email,
        display_name = coalesce(public.admins.display_name, excluded.display_name),
        active       = true;

  -- is distinct from ולא <> — כדי ששורה עם user_id ריק לא תחמוק
  update public.admins
     set active = false
   where user_id is distinct from v_id
     and active;
  get diagnostics v_off = row_count;

  -- העמודה הזו נוספה ב-admin-access.sql ואינה בשימוש בשום מדיניות,
  -- אבל משאירים אותה עקבית כדי שלא תטעה את מי שיקרא את הטבלה.
  update public.trainer_prefs set is_admin = (trainer_id = v_id)
   where is_admin is distinct from (trainer_id = v_id);

  raise notice 'האדמין היחיד הוא % (%). בוטלו % רשומות אדמין אחרות.',
    v_email, v_id, v_off;
end $$;

-- ---------------------------------------------------------------------
--  אימות — מה שרואים כאן הוא מה שקיים בפועל
-- ---------------------------------------------------------------------
select a.email,
       a.display_name,
       a.active,
       (a.pass_hash is not null) as יש_סיסמה,
       u.email as auth_email
  from public.admins a
  left join auth.users u on u.id = a.user_id
 order by a.active desc, a.email;
