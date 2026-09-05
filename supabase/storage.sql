-- =====================================================================
--  E.B FIT — אחסון קבצי תוכניות
--  להרצה ב-Supabase: SQL Editor -> New query -> הדבק הכל -> Run
--  ניתן להריץ שוב ושוב בבטחה.
--
--  מודל האבטחה:
--    הדלי ציבורי לקריאה, אבל הנתיב מכיל מזהה אקראי שאי אפשר לנחש —
--    אותו עיקרון כמו הטוקן של המתאמן. מתאים לתוכניות אימון.
--    אל תעלו לכאן מסמכים רפואיים או מזהים.
--
--    כתיבה ומחיקה: רק המאמן המחובר, ורק בתיקייה שלו.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. הדלי
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'programs', 'programs', true,
  10485760,                                  -- 10MB לקובץ
  array[
    'application/pdf',
    'image/png','image/jpeg','image/webp','image/heic',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 2. הרשאות
--    מבנה הנתיב:  <trainer_id>/<trainee_id>/<אקראי>-<שם הקובץ>
--    התיקייה הראשונה חייבת להיות מזהה המאמן — כך מאמן לא יכול
--    לכתוב או למחוק בתיקייה של מאמן אחר.
-- ---------------------------------------------------------------------
drop policy if exists programs_read   on storage.objects;
drop policy if exists programs_insert on storage.objects;
drop policy if exists programs_update on storage.objects;
drop policy if exists programs_delete on storage.objects;

-- קריאה ורשימה: למאמן המחובר בלבד.
-- הגרסה הראשונה כאן התירה select ל-anon בהנחה שהנתיב האקראי מגן.
-- ההנחה שגויה: select על storage.objects הוא הרשאת *רשימה*, ומי
-- שמקבל את הרשימה לא צריך לנחש דבר. הדלי נשאר public ולכן קישורי
-- ההורדה הישירים של המתאמנים ממשיכים לעבוד.
create policy programs_read on storage.objects
  for select to authenticated
  using (bucket_id = 'programs');

create policy programs_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'programs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy programs_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'programs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy programs_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'programs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------
-- 3. רשימת הקבצים על המתאמן
--    נשמרת בעמודה גלויה (ולא ב-private), כי המתאמן צריך לראות אותה.
-- ---------------------------------------------------------------------
alter table public.trainees
  add column if not exists files jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------
-- 4. הפונקציה של המתאמן מחזירה גם את הקבצים
--    שאר השדות הפרטיים ממשיכים לא להיחשף.
-- ---------------------------------------------------------------------
drop function if exists public.trainee_program(text);

create or replace function public.trainee_program(p_token text)
returns table (name text, goal text, program jsonb, files jsonb, trainer_name text)
language sql
security definer
set search_path = public
stable
as $$
  select t.name,
         t.goal,
         t.program,
         coalesce(t.files, '[]'::jsonb),
         coalesce(p.data->>'trainer', 'המאמן שלך')
  from public.trainees t
  left join public.trainer_prefs p on p.trainer_id = t.trainer_id
  where t.access_token = p_token
    and t.access_active
    and not t.deleted
    and t.status <> 'archived';
$$;

revoke all on function public.trainee_program(text) from public, anon, authenticated;
grant execute on function public.trainee_program(text) to anon, authenticated;
