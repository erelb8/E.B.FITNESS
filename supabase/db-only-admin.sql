-- E.B FIT — database-only admin sessions
-- Run after portal-login.sql and admin-access.sql.
-- Admin passwords are validated only against admins.pass_hash.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.admin_sessions (
  token_hash text primary key,
  admin_id uuid not null references public.admins(user_id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.admin_sessions enable row level security;
revoke all on public.admin_sessions from anon, authenticated;

create index if not exists admin_sessions_expiry_idx
  on public.admin_sessions(expires_at);

grant select, insert, update, delete on
  public.trainees, public.sessions, public.measures,
  public.payments, public.trainer_prefs
  to anon;
grant select on public.workout_logs to anon;

create or replace function public.admin_request_id()
returns uuid
language sql
security definer
set search_path = public, extensions
stable
as $$
  select s.admin_id
  from public.admin_sessions s
  join public.admins a on a.user_id = s.admin_id
  where a.active
    and s.expires_at > now()
    and extensions.crypt(
      coalesce((current_setting('request.headers', true)::json ->> 'x-admin-token'), ''),
      s.token_hash
    ) = s.token_hash
  limit 1;
$$;

create or replace function public.admin_login(
  p_email text,
  p_password text
)
returns table (token text, admin_id uuid, email text, display_name text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r public.admins%rowtype;
  v_token text;
begin
  select a.* into r
  from public.admins a
  where lower(a.email) = lower(btrim(coalesce(p_email, '')))
    and a.active;

  if r.user_id is null
     or r.pass_hash is null
     or extensions.crypt(coalesce(p_password, ''), r.pass_hash) <> r.pass_hash then
    perform pg_sleep(0.35);
    raise exception 'פרטי מנהל שגויים';
  end if;

  delete from public.admin_sessions where expires_at <= now();
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.admin_sessions(token_hash, admin_id, expires_at)
  values (
    extensions.crypt(v_token, extensions.gen_salt('bf', 10)),
    r.user_id,
    now() + interval '12 hours'
  );

  return query select v_token, r.user_id, r.email, r.display_name;
end;
$$;

create or replace function public.admin_session()
returns table (admin_id uuid, email text, display_name text)
language sql
security definer
set search_path = public, extensions
stable
as $$
  select a.user_id, a.email, a.display_name
  from public.admins a
  where a.user_id = public.admin_request_id();
$$;

create or replace function public.admin_logout()
returns void
language sql
security definer
set search_path = public, extensions
as $$
  delete from public.admin_sessions
  where admin_id = public.admin_request_id();
$$;

revoke all on function public.admin_request_id() from public, anon, authenticated;
revoke all on function public.admin_login(text, text) from public, anon, authenticated;
revoke all on function public.admin_session() from public, anon, authenticated;
revoke all on function public.admin_logout() from public, anon, authenticated;
grant execute on function public.admin_login(text, text) to anon, authenticated;
grant execute on function public.admin_session() to anon, authenticated;
grant execute on function public.admin_logout() to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['trainees','sessions','measures','payments'] loop
    execute format('drop policy if exists trainer_all on public.%I', t);
    execute format($f$
      create policy trainer_all on public.%I
        for all to anon, authenticated
        using (trainer_id = public.admin_request_id())
        with check (trainer_id = public.admin_request_id())
    $f$, t);
  end loop;
end $$;

drop policy if exists prefs_own on public.trainer_prefs;
create policy prefs_own on public.trainer_prefs
  for all to anon, authenticated
  using (trainer_id = public.admin_request_id())
  with check (trainer_id = public.admin_request_id());

drop policy if exists trainer_read_logs on public.workout_logs;
create policy trainer_read_logs on public.workout_logs
  for select to anon, authenticated
  using (exists (
    select 1 from public.trainees tr
    where tr.id = workout_logs.trainee_id
      and tr.trainer_id = public.admin_request_id()
  ));

drop function if exists public.set_trainee_login(text, text, text);
create or replace function public.set_trainee_login(
  p_trainee_id text,
  p_username text,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_owner uuid; v_user text; v_admin uuid;
begin
  v_admin := public.admin_request_id();
  if v_admin is null then raise exception 'not authenticated'; end if;
  select trainer_id into v_owner from public.trainees where id = p_trainee_id;
  if v_owner is null or v_owner <> v_admin then raise exception 'not your trainee'; end if;
  if p_username is null or btrim(p_username) = '' then
    update public.trainees set username = null, pass_hash = null,
      login_fails = 0, locked_until = null where id = p_trainee_id;
    return;
  end if;
  v_user := lower(btrim(p_username));
  if length(v_user) < 3 or v_user !~ '^[a-z0-9._-]+$' then
    raise exception 'invalid username';
  end if;
  if p_password is not null and p_password <> '' then
    update public.trainees set username = v_user,
      pass_hash = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
      login_fails = 0, locked_until = null where id = p_trainee_id;
  else
    update public.trainees set username = v_user where id = p_trainee_id;
  end if;
exception when unique_violation then raise exception 'username already taken';
end;
$$;

revoke all on function public.set_trainee_login(text, text, text) from public, anon, authenticated;
grant execute on function public.set_trainee_login(text, text, text) to anon;

notify pgrst, 'reload schema';
