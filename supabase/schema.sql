-- =====================================================================
--  E.B FIT — סכימת בסיס נתונים
--  להרצה ב-Supabase: SQL Editor -> New query -> הדבק הכל -> Run
--  ניתן להריץ שוב ושוב בבטחה (idempotent).
--
--  עקרון התכנון:
--    עמודה נפרדת רק למה שהשרת צריך — לתשאל, לאנדקס, או להגן עליו.
--    כל שאר שדות האפליקציה יושבים ב-jsonb, כדי ששינוי באפליקציה
--    לא יחייב מיגרציה.
--
--  הפרדת המידע הרגיש:
--    name / goal / program  = משותף עם המתאמן
--    private (jsonb)        = טלפון, בריאות, כרטיסייה, מחירים, הערות
--                             — לא נחשף דרך טוקן המתאמן בשום מסלול
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. טבלאות
--    id הוא text ולא uuid — כדי שמזהה שנוצר במכשיר במצב אופליין
--    יישאר זהה אחרי הסנכרון.
-- ---------------------------------------------------------------------

create table if not exists public.trainees (
  id            text primary key,
  trainer_id    uuid not null references auth.users(id) on delete cascade,

  -- משותף עם המתאמן
  name          text not null,
  goal          text,
  program       jsonb not null default '{"days":[]}'::jsonb,

  -- פרטי בלבד
  private       jsonb not null default '{}'::jsonb,

  status        text not null default 'active',

  -- הטוקן שנשלח בווטסאפ. 64 תווי hex — לא ניתן לניחוש.
  access_token  text not null unique
                default replace(gen_random_uuid()::text,'-','')
                     || replace(gen_random_uuid()::text,'-',''),
  -- ביטול גישה בלי למחוק היסטוריה
  access_active boolean not null default true,

  updated_at    timestamptz not null default now(),
  deleted       boolean not null default false
);

-- טבלאות הנתונים: תאריך בעמודה (לאינדוקס), השאר ב-jsonb
create table if not exists public.sessions (
  id          text primary key,
  trainer_id  uuid not null references auth.users(id) on delete cascade,
  trainee_id  text not null references public.trainees(id) on delete cascade,
  date        date not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false
);

create table if not exists public.measures (
  id          text primary key,
  trainer_id  uuid not null references auth.users(id) on delete cascade,
  trainee_id  text not null references public.trainees(id) on delete cascade,
  date        date not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false
);

create table if not exists public.payments (
  id          text primary key,
  trainer_id  uuid not null references auth.users(id) on delete cascade,
  trainee_id  text not null references public.trainees(id) on delete cascade,
  date        date not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false
);

-- הגדרות ופיצ'רים של המאמן — שורה אחת למאמן
create table if not exists public.trainer_prefs (
  trainer_id  uuid primary key references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- יומן ביצוע — מה שהמתאמן מסמן מהטלפון שלו
create table if not exists public.workout_logs (
  id          uuid primary key default gen_random_uuid(),
  trainee_id  text not null references public.trainees(id) on delete cascade,
  date        date not null default current_date,
  day_index   integer not null,
  day_name    text,
  entries     jsonb not null default '[]'::jsonb,  -- [{ex, sets, reps, weight, done}]
  feel        text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists trainees_trainer_idx on public.trainees(trainer_id);
create index if not exists trainees_token_idx   on public.trainees(access_token);
create index if not exists sessions_trainer_idx on public.sessions(trainer_id, date desc);
create index if not exists measures_trainer_idx on public.measures(trainer_id, date desc);
create index if not exists payments_trainer_idx on public.payments(trainer_id, date desc);
create index if not exists logs_trainee_idx     on public.workout_logs(trainee_id, date desc);

-- עדכון אוטומטי של updated_at בכל שינוי
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['trainees','sessions','measures','payments','trainer_prefs'] loop
    execute format('drop trigger if exists touch_%I on public.%I', t, t);
    execute format('create trigger touch_%I before update on public.%I
                    for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 2. RLS — הכל סגור כברירת מחדל
-- ---------------------------------------------------------------------
alter table public.trainees      enable row level security;
alter table public.sessions      enable row level security;
alter table public.measures      enable row level security;
alter table public.payments      enable row level security;
alter table public.trainer_prefs enable row level security;
alter table public.workout_logs  enable row level security;

-- המאמן ניגש אך ורק לשורות שלו. אין שום policy ל-anon —
-- כלומר בלי התחברות אי אפשר לקרוא מהטבלאות כלום.
do $$
declare t text;
begin
  foreach t in array array['trainees','sessions','measures','payments'] loop
    execute format('drop policy if exists trainer_all on public.%I', t);
    execute format($f$
      create policy trainer_all on public.%I
        for all to authenticated
        using (trainer_id = auth.uid())
        with check (trainer_id = auth.uid())
    $f$, t);
  end loop;
end $$;

drop policy if exists prefs_own on public.trainer_prefs;
create policy prefs_own on public.trainer_prefs
  for all to authenticated
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());

-- יומני ביצוע: נכתבים ע"י המתאמן דרך פונקציה, נקראים ע"י המאמן בלבד
drop policy if exists trainer_read_logs on public.workout_logs;
create policy trainer_read_logs on public.workout_logs
  for select to authenticated
  using (exists (
    select 1 from public.trainees tr
    where tr.id = workout_logs.trainee_id and tr.trainer_id = auth.uid()
  ));


-- ---------------------------------------------------------------------
-- 3. גישת המתאמן — דרך פונקציות בלבד, לא דרך הטבלאות.
--    SECURITY DEFINER עוקף RLS, ולכן הפונקציה מחזירה אך ורק
--    את העמודות הכתובות בה במפורש. private לא מופיע כאן.
-- ---------------------------------------------------------------------

create or replace function public.trainee_program(p_token text)
returns table (name text, goal text, program jsonb, trainer_name text)
language sql
security definer
set search_path = public
stable
as $$
  select t.name,
         t.goal,
         t.program,
         coalesce(p.data->>'trainer', 'המאמן שלך')
  from public.trainees t
  left join public.trainer_prefs p on p.trainer_id = t.trainer_id
  where t.access_token = p_token
    and t.access_active
    and not t.deleted
    and t.status <> 'archived';
$$;

create or replace function public.trainee_log(
  p_token     text,
  p_day_index integer,
  p_day_name  text,
  p_entries   jsonb,
  p_feel      text default null,
  p_note      text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_trainee text;
begin
  select id into v_trainee from public.trainees
   where access_token = p_token and access_active
     and not deleted and status <> 'archived';

  if v_trainee is null then
    raise exception 'invalid token';
  end if;

  -- הגנה מפני הצפה
  if (select count(*) from public.workout_logs
       where trainee_id = v_trainee and date = current_date) >= 20 then
    raise exception 'too many logs today';
  end if;

  if jsonb_array_length(coalesce(p_entries,'[]'::jsonb)) > 60 then
    raise exception 'payload too large';
  end if;

  insert into public.workout_logs (trainee_id, day_index, day_name, entries, feel, note)
  values (v_trainee, p_day_index, left(p_day_name,80), p_entries,
          left(p_feel,40), left(p_note,500))
  returning id into v_id;

  return v_id;
end $$;

-- הרשאות: anon מורשה לקרוא לשתי הפונקציות האלה בלבד
revoke all on function public.trainee_program(text) from public, anon, authenticated;
revoke all on function public.trainee_log(text,integer,text,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.trainee_program(text) to anon, authenticated;
grant execute on function public.trainee_log(text,integer,text,jsonb,text,text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. הרשאות
--    ב-anon מבטלים גישה ישירה לטבלאות לגמרי — הוא מגיע רק דרך
--    שתי הפונקציות שלמעלה.
--    ל-authenticated נותנים גישה במפורש; ה-RLS הוא זה שמגביל
--    אותו לשורות שלו בלבד. כותבים את זה כאן ולא מסתמכים על
--    ברירות המחדל של Supabase, כדי שהסכימה תעמוד בפני עצמה.
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

revoke all on all tables in schema public from anon;

grant select, insert, update, delete on
  public.trainees, public.sessions, public.measures,
  public.payments, public.trainer_prefs
  to authenticated;

grant select on public.workout_logs to authenticated;
