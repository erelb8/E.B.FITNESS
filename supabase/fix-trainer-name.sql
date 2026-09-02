-- =====================================================================
--  E.B FIT — תיקון שם המאמן והודעות בעברית
--  Supabase -> SQL Editor -> New query -> הדבק הכל -> Run
--  בטוח להרצה חוזרת.
--
--  שני תיקונים:
--   1. הנתיב אל שם המאמן היה data->>'trainer', אבל ההגדרות נדחפות
--      כ-{settings:{trainer:...}} ולכן הוא תמיד החזיר NULL ונפל
--      לברירת המחדל.
--   2. הטקסטים בעברית נכתבו למסד דרך העתקה שהרסה את הקידוד, ולכן
--      הוצגו כג׳יבריש. כאן הם נכתבים מחדש.
-- =====================================================================

drop function if exists public.trainee_program(text);

create or replace function public.trainee_program(p_token text)
returns table (
  name text, goal text, program jsonb, files jsonb,
  trainer_name text, goal2 text, success3m text, meals jsonb, meals_self jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select t.name,
         t.goal,
         t.program,
         coalesce(t.files, '[]'::jsonb),
         coalesce(
           nullif(btrim(coalesce(p.data->'settings'->>'trainer', '')), ''),
           nullif(btrim(coalesce(p.data->>'trainer', '')), ''),
           'המאמן שלך'
         ),
         t.private->'intake'->'answers'->>'goal2',
         t.private->'intake'->'answers'->>'success3m',
         coalesce(t.meals, '[]'::jsonb),
         coalesce(t.meals_self, '[]'::jsonb)
  from public.trainees t
  left join public.trainer_prefs p on p.trainer_id = t.trainer_id
  where t.access_token = p_token
    and t.access_active
    and not t.deleted
    and t.status <> 'archived'
  limit 1;
$$;

drop function if exists public.trainee_login(text, text);

create or replace function public.trainee_login(
  p_username text,
  p_password text
)
returns table (
  name text, goal text, program jsonb, files jsonb,
  trainer_name text, goal2 text, success3m text, meals jsonb,
  meals_self jsonb, token text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare r record;
begin
  select * into r from public.trainees
   where lower(username) = lower(btrim(coalesce(p_username,'')))
     and not deleted and status <> 'archived'
   limit 1;

  -- הודעה אחידה בכל מקרה של כישלון, כדי שלא ניתן יהיה לגלות
  -- אילו שמות משתמש קיימים על ידי השוואת התשובות
  if r.id is null
     or r.pass_hash is null
     or not coalesce(r.access_active, false)
     or (r.locked_until is not null and r.locked_until > now())
     or extensions.crypt(coalesce(p_password,''), r.pass_hash) <> r.pass_hash then

    if r.id is not null then
      update public.trainees
         set login_fails  = coalesce(login_fails,0) + 1,
             locked_until = case
               when coalesce(login_fails,0) + 1 >= 5
                 then now() + (least(coalesce(login_fails,0) - 3, 6) * interval '5 minutes')
               else locked_until end
       where id = r.id;
    end if;
    raise exception 'שם משתמש או סיסמה שגויים';
  end if;

  update public.trainees
     set login_fails = 0, locked_until = null, last_login = now()
   where id = r.id;

  return query
    select r.name, r.goal, r.program,
           coalesce(r.files, '[]'::jsonb),
           coalesce(
             nullif(btrim(coalesce((select p.data->'settings'->>'trainer'
                                      from public.trainer_prefs p
                                     where p.trainer_id = r.trainer_id), '')), ''),
             'המאמן שלך'
           ),
           r.private->'intake'->'answers'->>'goal2',
           r.private->'intake'->'answers'->>'success3m',
           coalesce(r.meals, '[]'::jsonb),
           coalesce(r.meals_self, '[]'::jsonb),
           r.access_token;
end;
$$;

-- ---------------------------------------------------------------------
-- הודעות ההוספה, גם הן נכתבות מחדש
-- ---------------------------------------------------------------------
create or replace function public.trainee_add_meal(
  p_token   text,
  p_lib_id  text,
  p_name    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id text; v_cur jsonb; v_row jsonb;
begin
  if p_lib_id is null or btrim(p_lib_id) = '' or length(p_lib_id) > 60 then
    raise exception 'מזהה ארוחה לא תקין';
  end if;

  select id, coalesce(meals_self,'[]'::jsonb) into v_id, v_cur
    from public.trainees
   where access_token = p_token and access_active
     and not deleted and status <> 'archived';

  if v_id is null then
    raise exception 'invalid token';
  end if;

  if jsonb_array_length(v_cur) >= 40 then
    raise exception 'הגעת למקסימום הארוחות שאפשר להוסיף';
  end if;

  if exists (select 1 from jsonb_array_elements(v_cur) e
              where e->>'libId' = p_lib_id) then
    return v_cur;
  end if;

  v_row := jsonb_build_object(
    'libId', p_lib_id,
    'name',  left(coalesce(p_name,''), 120),
    'at',    to_char(now() at time zone 'Asia/Jerusalem', 'YYYY-MM-DD')
  );

  update public.trainees
     set meals_self = v_cur || jsonb_build_array(v_row)
   where id = v_id
   returning meals_self into v_cur;

  return v_cur;
end;
$$;

revoke all on function public.trainee_program(text)               from public, anon, authenticated;
revoke all on function public.trainee_login(text,text)            from public, anon, authenticated;
revoke all on function public.trainee_add_meal(text,text,text)    from public, anon, authenticated;

grant execute on function public.trainee_program(text)            to anon, authenticated;
grant execute on function public.trainee_login(text,text)         to anon, authenticated;
grant execute on function public.trainee_add_meal(text,text,text) to anon, authenticated;
