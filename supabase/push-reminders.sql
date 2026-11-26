-- =====================================================================
-- Automatic reminders with push notifications for trainees (Nov 2026)
-- Paste into Supabase -> SQL Editor -> Run. Safe to run more than once.
--
-- What it adds:
--   push_subs    one row per phone that agreed to notifications
--   push_config  one row: the cron key and the VAPID key pair
--   trainee_push_subscribe / trainee_push_unsubscribe   called by t.html
--   push_public_key                                     called by t.html
--   push_due / push_init / push_gone   called only by the edge function
--                                      "push-reminders", guarded by the key
--   a cron job that calls the edge function once an hour
--
-- No service_role key anywhere. The edge function holds no secret: the
-- cron job sends the key in a header, the function passes it back to
-- push_due, and only then gets the list and the VAPID keys. Both tables
-- are closed to anon and authenticated (RLS on, no policies, no grants).
--
-- The three reminders (Israel time, each can be turned off by the trainee):
--   workout  no report for 3+ days, at the hour the trainee chose
--            (default 18:00), at most once every 3 days
--   weigh    Thursday 08:00
--   checkin  1st-3rd of the month at the chosen hour, if this month's
--            check-in was not sent yet
-- =====================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.push_subs (
  id          uuid primary key default gen_random_uuid(),
  trainee_id  text not null references public.trainees(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  prefs       jsonb not null default '{}'::jsonb,
  last_sent   jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists push_subs_trainee on public.push_subs (trainee_id);
alter table public.push_subs enable row level security;
revoke all on public.push_subs from public, anon, authenticated;

create table if not exists public.push_config (
  id            int primary key default 1 check (id = 1),
  cron_key      text not null,
  vapid_public  text,
  vapid_private text
);
alter table public.push_config enable row level security;
revoke all on public.push_config from public, anon, authenticated;
insert into public.push_config (id, cron_key)
values (1, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

-- ---------- called by the trainee page ----------
create or replace function public.push_public_key()
returns text language sql security definer set search_path = public as $$
  select vapid_public from public.push_config where id = 1;
$$;

create or replace function public.trainee_push_subscribe(
  p_token text, p_endpoint text, p_p256dh text, p_auth text, p_prefs jsonb default '{}'::jsonb
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_id text; v_prefs jsonb;
begin
  select id into v_id from public.trainees
   where access_token = p_token and access_active and not deleted and status <> 'archived';
  if v_id is null then raise exception 'invalid token'; end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 1000
     or length(coalesce(p_p256dh,'')) not between 20 and 200
     or length(coalesce(p_auth,'')) not between 8 and 100 then
    raise exception 'bad subscription';
  end if;
  -- only the known keys, with sane values
  v_prefs := jsonb_build_object(
    'workout', coalesce((p_prefs->>'workout')::boolean, true),
    'weigh',   coalesce((p_prefs->>'weigh')::boolean, true),
    'checkin', coalesce((p_prefs->>'checkin')::boolean, true),
    'hour',    least(22, greatest(5, coalesce((p_prefs->>'hour')::int, 18))));
  insert into public.push_subs (trainee_id, endpoint, p256dh, auth, prefs)
  values (v_id, p_endpoint, p_p256dh, p_auth, v_prefs)
  on conflict (endpoint) do update
     set trainee_id = excluded.trainee_id, p256dh = excluded.p256dh, auth = excluded.auth,
         prefs = excluded.prefs, updated_at = now();
  -- at most 5 phones per trainee: the oldest go
  delete from public.push_subs s
   where s.trainee_id = v_id
     and s.id not in (select id from public.push_subs where trainee_id = v_id order by updated_at desc limit 5);
  return true;
end $$;

create or replace function public.trainee_push_unsubscribe(p_token text, p_endpoint text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_id text;
begin
  select id into v_id from public.trainees where access_token = p_token;
  if v_id is null then raise exception 'invalid token'; end if;
  delete from public.push_subs where trainee_id = v_id and endpoint = p_endpoint;
  return true;
end $$;

-- ---------- called by the edge function only (guarded by the cron key) ----------
create or replace function public.push_key_ok(p_key text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_key is null or length(p_key) < 40
     or not exists (select 1 from public.push_config where id = 1 and cron_key = p_key) then
    perform pg_sleep(0.5);
    return false;
  end if;
  return true;
end $$;

create or replace function public.push_init(p_key text, p_pub text, p_priv text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.push_key_ok(p_key) then raise exception 'forbidden'; end if;
  update public.push_config set vapid_public = p_pub, vapid_private = p_priv
   where id = 1 and vapid_public is null;
  return true;
end $$;

create or replace function public.push_due(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_now   timestamp := now() at time zone 'Asia/Jerusalem';
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_hour  int  := extract(hour from (now() at time zone 'Asia/Jerusalem'))::int;
  v_dow   int  := extract(dow  from (now() at time zone 'Asia/Jerusalem'))::int;   -- 0 = Sunday
  v_dom   int  := extract(day  from (now() at time zone 'Asia/Jerusalem'))::int;
  v_month text := to_char(now() at time zone 'Asia/Jerusalem', 'YYYY-MM');
  v_cfg   public.push_config;
  v_items jsonb := '[]'::jsonb;
  r record; v_kind text; v_title text; v_body text; v_last date; v_gap int; v_h int;
begin
  if not public.push_key_ok(p_key) then raise exception 'forbidden'; end if;
  select * into v_cfg from public.push_config where id = 1;
  if v_cfg.vapid_public is null then return jsonb_build_object('need_init', true); end if;

  for r in
    select s.*, t.access_token, t.program, t.session_state,
           split_part(btrim(coalesce(t.name, '')), ' ', 1) as first_name
      from public.push_subs s
      join public.trainees t on t.id = s.trainee_id
     where t.access_active and not t.deleted and t.status <> 'archived'
  loop
    v_kind := null;
    v_h := coalesce((r.prefs->>'hour')::int, 18);

    -- monthly check-in
    if coalesce((r.prefs->>'checkin')::boolean, true) and v_dom <= 3 and v_hour = v_h
       and coalesce(r.last_sent->>'checkin', '') <> v_month
       and not exists (select 1 from jsonb_array_elements(
             case when jsonb_typeof(r.session_state->'checkins') = 'array' then r.session_state->'checkins' else '[]'::jsonb end) c
             where c->>'month' = v_month) then
      v_kind := 'checkin';
      v_title := 'צ׳ק-אין חודשי';
      v_body := 'חצי דקה: איך היה החודש? ככה המאמן יודע מה לשנות בתוכנית.';

    -- weekly weigh-in, Thursday morning
    elsif coalesce((r.prefs->>'weigh')::boolean, true) and v_dow = 4 and v_hour = 8
       and coalesce(r.last_sent->>'weigh', '') <> v_today::text then
      v_kind := 'weigh';
      v_title := 'יום שקילה';
      v_body := 'בוקר טוב' || case when r.first_name <> '' then ', ' || r.first_name else '' end || '. שקילה על הבוקר, לפני אוכל — ולרשום באפליקציה.';

    -- no workout for 3+ days
    elsif coalesce((r.prefs->>'workout')::boolean, true) and v_hour = v_h
       and jsonb_array_length(case when jsonb_typeof(r.program->'days') = 'array' then r.program->'days' else '[]'::jsonb end) > 0
       and (r.last_sent->>'workout' is null or (r.last_sent->>'workout')::date <= v_today - 3) then
      select max(date) into v_last from public.workout_logs where trainee_id = r.trainee_id;
      v_gap := case when v_last is null then (v_today - r.created_at::date) else (v_today - v_last) end;
      if v_gap >= 3 then
        v_kind := 'workout';
        v_title := case when v_last is null then 'האימון הראשון מחכה' else v_gap || ' ימים בלי אימון' end;
        v_body := case when r.first_name <> '' then r.first_name || ', ' else '' end || 'האימון הבא שלך מחכה באפליקציה. נכנסים, מסמנים, וזהו.';
      end if;
    end if;

    if v_kind is not null then
      v_items := v_items || jsonb_build_object(
        'id', r.id, 'endpoint', r.endpoint, 'p256dh', r.p256dh, 'auth', r.auth,
        'payload', jsonb_build_object('title', v_title, 'body', v_body, 'tag', 'bp-' || v_kind,
                                      'url', 't.html?go=' || v_kind || '#' || r.access_token, 'kind', v_kind));
      update public.push_subs
         set last_sent = last_sent || jsonb_build_object(v_kind, case when v_kind = 'checkin' then v_month else v_today::text end)
       where id = r.id;
    end if;
  end loop;

  return jsonb_build_object('public', v_cfg.vapid_public, 'private', v_cfg.vapid_private, 'items', v_items);
end $$;

-- phones that unsubscribed (the push service answered 404/410)
create or replace function public.push_gone(p_key text, p_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.push_key_ok(p_key) then raise exception 'forbidden'; end if;
  delete from public.push_subs where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.push_public_key()                                  from public, anon, authenticated;
revoke all on function public.trainee_push_subscribe(text,text,text,text,jsonb)  from public, anon, authenticated;
revoke all on function public.trainee_push_unsubscribe(text,text)                from public, anon, authenticated;
revoke all on function public.push_key_ok(text)                                  from public, anon, authenticated;
revoke all on function public.push_init(text,text,text)                          from public, anon, authenticated;
revoke all on function public.push_due(text)                                     from public, anon, authenticated;
revoke all on function public.push_gone(text,uuid[])                             from public, anon, authenticated;
grant execute on function public.push_public_key()                                 to anon, authenticated;
grant execute on function public.trainee_push_subscribe(text,text,text,text,jsonb) to anon, authenticated;
grant execute on function public.trainee_push_unsubscribe(text,text)               to anon, authenticated;
grant execute on function public.push_init(text,text,text)                         to anon;
grant execute on function public.push_due(text)                                    to anon;
grant execute on function public.push_gone(text,uuid[])                            to anon;

-- ---------- once an hour, five minutes past ----------
do $$
begin
  perform cron.unschedule('push-reminders');
exception when others then null;
end $$;

select cron.schedule('push-reminders', '5 * * * *', $cron$
  select net.http_post(
    url     := 'https://yidvzlarrcxeonwkuygo.supabase.co/functions/v1/push-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-key', (select cron_key from public.push_config where id = 1)),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000);
$cron$);

notify pgrst, 'reload schema';
