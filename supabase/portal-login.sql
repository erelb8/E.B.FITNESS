-- E.B FIT — unified portal login and admin allow-list
-- Run once in Supabase SQL Editor.
-- Admin passwords stay in Supabase Auth. The admins table is an allow-list.

alter table public.trainees
  add column if not exists email text;

create unique index if not exists trainees_email_uniq
  on public.trainees (lower(email)) where email is not null;

create table if not exists public.admins (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  pass_hash    text,
  display_name text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
alter table public.admins
  add column if not exists pass_hash text;

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select active from public.admins
                   where user_id = auth.uid()), false);
$$;

revoke all on function public.current_user_is_admin() from public, anon, authenticated;
grant execute on function public.current_user_is_admin() to authenticated;

create or replace function public.check_admin_password(
  p_email text,
  p_password text
)
returns boolean
language sql
security definer
set search_path = public, extensions
stable
as $$
  select exists (
    select 1
    from public.admins a
    where lower(a.email) = lower(btrim(coalesce(p_email, '')))
      and a.active
      and a.pass_hash is not null
      and extensions.crypt(coalesce(p_password, ''), a.pass_hash) = a.pass_hash
  );
$$;

revoke all on function public.check_admin_password(text, text) from public, anon, authenticated;
grant execute on function public.check_admin_password(text, text) to anon, authenticated;

-- Bootstrap the owner. Add the other approved admin emails explicitly here.
insert into public.admins (user_id, email, display_name, active)
select id, lower(email), 'אראל באואר', true
from auth.users
where lower(email) = lower('erelbauer7@gmail.com')
on conflict (user_id) do update
  set email = excluded.email, active = true;

-- Trainee login accepts either username or email and returns only private-dashboard data.
drop function if exists public.trainee_login(text, text);
create or replace function public.trainee_login(
  p_username text,
  p_password text
)
returns table (
  name text, goal text, program jsonb, files jsonb,
  trainer_name text, goal2 text, success3m text, meals jsonb, token text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare r record; v_user text;
begin
  v_user := lower(btrim(coalesce(p_username, '')));

  select t.* into r
    from public.trainees t
   where (lower(t.username) = v_user or lower(t.email) = v_user)
     and t.access_active and not t.deleted and t.status <> 'archived';

  if r.id is null then
    perform pg_sleep(0.4);
    raise exception 'שם משתמש, אימייל או סיסמה שגויים';
  end if;

  if r.locked_until is not null and r.locked_until > now() then
    raise exception 'החשבון נעול זמנית. נסה שוב בעוד כמה דקות.';
  end if;

  if r.pass_hash is null
     or extensions.crypt(coalesce(p_password, ''), r.pass_hash) <> r.pass_hash then
    update public.trainees
       set login_fails = login_fails + 1,
           locked_until = case when login_fails + 1 >= 3
                               then now() + ((login_fails + 1 - 2) * interval '1 minute')
                               else null end
     where id = r.id;
    perform pg_sleep(0.4);
    raise exception 'שם משתמש, אימייל או סיסמה שגויים';
  end if;

  update public.trainees
     set login_fails = 0, locked_until = null, last_login = now()
   where id = r.id;

  return query
    select r.name, r.goal, r.program, coalesce(r.files, '[]'::jsonb),
           coalesce((select p.data->>'trainer' from public.trainer_prefs p
                     where p.trainer_id = r.trainer_id), 'המאמן שלך'),
           r.private->'intake'->'answers'->>'goal2',
           r.private->'intake'->'answers'->>'success3m',
           coalesce(r.meals, '[]'::jsonb), r.access_token;
end;
$$;

revoke all on function public.trainee_login(text, text) from public, anon, authenticated;
grant execute on function public.trainee_login(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
