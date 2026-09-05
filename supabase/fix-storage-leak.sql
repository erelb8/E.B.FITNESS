-- =====================================================================
--  E.B FIT — סגירת חשיפה בדלי הקבצים
--  Supabase -> SQL Editor -> New query -> הדבק הכל -> Run
--  בטוח להרצה חוזרת.
--
--  מה היה:
--    create policy programs_read ... for select to anon, authenticated
--
--  ההנחה שעמדה מאחורי זה הייתה שהנתיב האקראי מגן על הקבצים.
--  היא שגויה: הרשאת select על storage.objects היא הרשאת *רשימה*.
--  מי שיכול לבקש את הרשימה לא צריך לנחש כלום — הוא מקבל את מזהה
--  המאמן, אחר כך את מזהי המתאמנים, אחר כך את שמות הקבצים, ומוריד.
--  המפתח הפומבי נמצא ב-config.js וגלוי לכל מי שפותח את הדף.
--
--  מה משתנה:
--    רשימת הקבצים נסגרת בפני anon.
--
--  מה לא משתנה:
--    הדלי נשאר public, ולכן קישורי ההורדה הישירים שכבר נשלחו
--    למתאמנים ממשיכים לעבוד. הגישה הישירה לקובץ אינה עוברת דרך
--    המדיניות הזאת.
-- =====================================================================

drop policy if exists programs_read on storage.objects;

-- קריאה ורשימה — למאמן המחובר בלבד
create policy programs_read on storage.objects
  for select to authenticated
  using (bucket_id = 'programs');

-- ---------------------------------------------------------------------
--  אימות: השאילתה צריכה להחזיר authenticated בלבד, בלי anon
-- ---------------------------------------------------------------------
select policyname, roles::text, cmd
  from pg_policies
 where schemaname = 'storage'
   and tablename  = 'objects'
   and policyname like 'programs%'
 order by policyname;
