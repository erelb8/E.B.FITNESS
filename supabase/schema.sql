-- =====================================================================
--  E.B FIT — סכימת בסיס נתונים
--  להרצה ב-Supabase: SQL Editor -> New query -> הדבק הכל -> Run
--  ניתן להריץ שוב ושוב בבטחה (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. טבלאות
-- ---------------------------------------------------------------------

-- מתאמנים. trainer_id הוא המאמן הבעלים (מזהה מ-Supabase Auth).
create table if not exists public.trainees (
  id            uuid primary key default gen_random_uuid(),
  trainer_id    uuid not null references auth.users(id) on delete cascade,

  -- פרטים גלויים למתאמן
  name          text not null,
  goal          text,
  program       jsonb not null default '{"days":[]}'::jsonb,

  -- פרטים פרטיים — לעולם לא נחשפים דרך טוקן המתאמן
  phone         text,
  birthdate     date,
  notes         text,
  health        text,
  health_ok     boolean not null default false,
  pkg_total     integer not null default 0,
  pkg_used      integer not null default 0,
  status        text    not null default 'active',

  -- הטוקן שנשלח בווטסאפ. 64 תווי hex — לא ניתן לניחוש.
  access_token  text not null unique
                default replace(gen_random_uuid()::text,'-','')
                     || replace(gen_random_uuid()::text,'-',''),
  -- מאפשר לבטל גישה למתאמן בלי למחוק אותו
  access_active boolean not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- אימונים ביומן
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null references auth.users(id) on delete cascade,
  trainee_id  uuid not null references public.trainees(id) on delete cascade,
  date        date not null,
  time        text,
  type        text,
  status      text not null default 'scheduled',
  note        text,
  created_at  timestamptz not null default now()
);

-- מדידות
create table if not exists public.measures (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null references auth.users(id) on delete cascade,
  trainee_id  uuid not null references public.trainees(id) on delete cascade,
  date        date not null,
  weight      numeric,
  fat         numeric,
  waist       numeric,
  note        text,
  created_at  timestamptz not null default now()
);

-- תשלומים — פרטי לחלוטין
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null references auth.users(id) on delete cascade,
  trainee_id  uuid not null references public.trainees(id) on delete cascade,
  date        date not null,
  amount      numeric not null default 0,
  method      text,
  sessions    integer not null default 0,
  note        text,
  created_at  timestamptz not null default now()
);

-- יומן ביצוע — מה שהמתאמן מסמן מהטלפון שלו
create table if not exists public.workout_logs (
  id          uuid primary key default gen_random_uuid(),
  trainee_id  uuid not null references public.trainees(id) on delete cascade,
  date        date not null default current_date,
  day_index   integer not null,
  day_name    text,
  entries     jsonb not null default '[]'::jsonb,  -- [{ex, sets, reps, weight, done}]
  feel        text,      -- איך הרגיש: קל / בסדר / קשה
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists trainees_trainer_idx   on public.trainees(trainer_id);
create index if not exists trainees_token_idx     on public.trainees(access_token);
create index if not exists sessions_trainee_idx   on public.sessions(trainee_id, date desc);
create index if not exists measures_trainee_idx   on public.measures(trainee_id, date desc);
create index if not exists payments_trainee_idx   on public.payments(trainee_id, date desc);
create index if not exists logs_trainee_idx       on public.workout_logs(trainee_id, date desc);

-- עדכון אוטומטי של updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trainees_touch on public.trainees;
create trigger trainees_touch before update on public.trainees
  for each row execute function public.touch_updated_at();


-- ---------------------------------------------------------------------
-- 2. RLS — הכל סגור כברירת מחדל
-- ---------------------------------------------------------------------
alter table public.trainees     enable row level security;
alter table public.sessions     enable row level security;
alter table public.measures     enable row level security;
alter table public.payments     enable row level security;
alter table public.workout_logs enable row level security;

-- המאמן רואה ועורך אך ורק את השורות שלו.
-- אין שום policy ל-anon — כלומר בלי התחברות אי אפשר לקרוא כלום ישירות.
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

-- יומני הביצוע נכתבים ע"י המתאמן (דרך פונקציה) ונקראים ע"י המאמן
drop policy if exists trainer_read_logs on public.workout_logs;
create policy trainer_read_logs on public.workout_logs
  for select to authenticated
  using (exists (
    select 1 from public.trainees tr
    where tr.id = workout_logs.trainee_id and tr.trainer_id = auth.uid()
  ));


-- ---------------------------------------------------------------------
-- 3. גישת המתאמן — דרך פונקציות בלבד, לא דרך הטבלאות
--    SECURITY DEFINER = הפונקציה רצה בהרשאות הבעלים ועוקפת RLS,
--    אבל היא מחזירה רק את מה שכתוב בה במפורש.
-- ---------------------------------------------------------------------

-- שליפת התוכנית של המתאמן לפי הטוקן.
-- מחזירה שם, מטרה ותוכנית בלבד. לא בריאות, לא טלפון, לא תשלומים.
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
         coalesce(u.raw_user_meta_data->>'display_name', 'המאמן שלך')
  from public.trainees t
  join auth.users u on u.id = t.trainer_id
  where t.access_token = p_token
    and t.access_active
    and t.status <> 'archived';
$$;

-- רישום ביצוע אימון ע"י המתאמן.
create or replace function public.trainee_log(
  p_token text,
  p_day_index integer,
  p_day_name text,
  p_entries jsonb,
  p_feel text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_trainee uuid;
begin
  select id into v_trainee from public.trainees
   where access_token = p_token and access_active and status <> 'archived';

  if v_trainee is null then
    raise exception 'invalid token';
  end if;

  -- הגנה מפני הצפה: מקסימום 20 רישומים ליום למתאמן
  if (select count(*) from public.workout_logs
       where trainee_id = v_trainee and date = current_date) >= 20 then
    raise exception 'too many logs today';
  end if;

  insert into public.workout_logs (trainee_id, day_index, day_name, entries, feel, note)
  values (v_trainee, p_day_index, p_day_name, p_entries, left(p_feel,40), left(p_note,500))
  returning id into v_id;

  return v_id;
end $$;

-- הרשאות: anon יכול לקרוא לשתי הפונקציות האלה בלבד.
revoke all on function public.trainee_program(text) from public, anon, authenticated;
revoke all on function public.trainee_log(text,integer,text,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.trainee_program(text) to anon, authenticated;
grant execute on function public.trainee_log(text,integer,text,jsonb,text,text) to anon, authenticated;

-- וידוא שאין גישה ישירה לטבלאות מ-anon
revoke all on all tables in schema public from anon;
grant  usage on schema public to anon;
