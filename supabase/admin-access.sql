-- E.B FIT — Admin-only trainer dashboard
-- Run this once in Supabase SQL Editor.
-- Change the email below if the dashboard owner uses another Auth account.

alter table public.trainer_prefs
  add column if not exists is_admin boolean not null default false;

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

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trainer_prefs (trainer_id)
  values (new.id)
  on conflict (trainer_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

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
    select 1 from public.admins a
    where lower(a.email) = lower(btrim(coalesce(p_email, '')))
      and a.active
      and a.pass_hash is not null
      and extensions.crypt(coalesce(p_password, ''), a.pass_hash) = a.pass_hash
  );
$$;

revoke all on function public.check_admin_password(text, text) from public, anon, authenticated;
grant execute on function public.check_admin_password(text, text) to anon, authenticated;

-- Bootstrap the owner account as the only admin.
insert into public.admins (user_id, email, display_name, active)
select id, lower(email), 'אראל באואר', true
from auth.users
where lower(email) = lower('erelbauer7@gmail.com')
on conflict (user_id) do update set email = excluded.email, active = true;

-- Remove admin status from every other trainer preference row.
update public.admins
set active = false
where user_id <> (
  select id from auth.users where lower(email) = lower('erelbauer7@gmail.com')
);

alter table public.trainees      enable row level security;
alter table public.sessions      enable row level security;
alter table public.measures      enable row level security;
alter table public.payments      enable row level security;
alter table public.trainer_prefs enable row level security;
alter table public.workout_logs  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['trainees','sessions','measures','payments'] loop
    execute format('drop policy if exists trainer_all on public.%I', t);
    execute format($f$
      create policy trainer_all on public.%I
        for all to authenticated
        using (trainer_id = auth.uid() and public.current_user_is_admin())
        with check (trainer_id = auth.uid() and public.current_user_is_admin())
    $f$, t);
  end loop;
end $$;

drop policy if exists prefs_own on public.trainer_prefs;
create policy prefs_own on public.trainer_prefs
  for all to authenticated
  using (trainer_id = auth.uid() and public.current_user_is_admin())
  with check (trainer_id = auth.uid() and public.current_user_is_admin());

drop policy if exists trainer_read_logs on public.workout_logs;
create policy trainer_read_logs on public.workout_logs
  for select to authenticated
  using (exists (
    select 1 from public.trainees tr
    where tr.id = workout_logs.trainee_id
      and tr.trainer_id = auth.uid()
      and public.current_user_is_admin()
  ));

-- The customer RPCs remain available to anon and do not expose trainer data.

-- Refresh PostgREST's function catalog immediately after this migration.
notify pgrst, 'reload schema';
