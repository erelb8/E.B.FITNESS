-- =====================================================================
--  E.B FIT — הרשאת קבצי HTML באחסון
--  להרצה ב-Supabase: SQL Editor -> New query -> הדבק -> Run
--  ניתן להריץ שוב ושוב בבטחה.
--
--  למה זה נפרד: קובץ HTML הוא היחיד ברשימה שהדפדפן מריץ, ולא רק
--  מציג. הוא נפתח על הדומיין של Supabase — לא של האפליקציה — ולכן
--  אין לו גישה לנתוני המתאמנים או להתחברות של המאמן. בנוסף, רק
--  המאמן המחובר יכול להעלות. מכאן שהסיכון מצומצם, אבל הכלל פשוט:
--  להעלות רק קבצים שאתה עצמך יצרת.
-- =====================================================================

update storage.buckets
   set allowed_mime_types = array[
     'application/pdf',
     'image/png','image/jpeg','image/webp','image/heic',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'text/plain',
     'text/html'
   ]
 where id = 'programs';

-- בדיקה: אמור להחזיר שורה אחת עם text/html ברשימה
select id, public, file_size_limit, allowed_mime_types
  from storage.buckets
 where id = 'programs';
