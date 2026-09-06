-- =====================================================================
-- E.B FIT — תיקון: שגיאות 500 / statement timeout בסנכרון
-- ---------------------------------------------------------------------
-- שורת מתאמן יכולה להכיל תוכנית, קבצים ותפריט שלמים (jsonb גדולים).
-- ה-upsert ההמוני שלהם חצה את מגבלת statement_timeout של ה-anon role
-- והשרת החזיר 500 עם 'canceling statement due to statement timeout'.
--
-- כאן מגדילים את המגבלה רק ל-anon (הלקוח). 60s מספיק גם לתוכנית כבדה,
-- ובשילוב עם התיקון בצד הלקוח (שורה-שורה + backoff) הסנכרון שקט.
--
-- הרצה: Supabase -> SQL Editor -> New query -> הדבק הכל -> Run
-- בטוח להרצה חוזרת.
-- =====================================================================

alter role anon set statement_timeout = '60s';

-- אינדקס על העמודה שה-RLS של ה-upsert בודק שוב ושוב לכל שורה,
-- כדי שהבדיקה לא תהיה סריקה מלאה.
create index if not exists trainees_trainer_idx on public.trainees(trainer_id);

notify pgrst, 'reload schema';
