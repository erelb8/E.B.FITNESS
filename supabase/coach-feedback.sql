-- =====================================================================
-- Coach feedback on a workout report (Nov 2026)
-- Paste into Supabase -> SQL Editor -> Run. Safe to run more than once.
-- Run AFTER push-reminders.sql: this file replaces push_due and
-- trainee_push_subscribe from that file with versions that also know the
-- "coach replied" notification. If push-reminders.sql is ever re-run,
-- re-run this file after it.
--
-- What it adds:
--   workout_logs.coach_note / coach_note_at / coach_seen_at / coach_pushed_at
--   coach_log_reply        the coach writes (or clears) a reply to a report
--   trainee_extras         now also returns id, note, and the coach reply
--   trainee_feedback_seen  the trainee page marks the replies as read
--   trainee_coach          coach first name + phone, for "write to coach"
--   push_due               also returns a notification per new coach reply
--   trainee_push_subscribe also keeps the "coach" on/off preference
--
-- Who can do what:
--   The coach reaches workout_logs only through the existing SELECT policy
--   (trainer_read_logs). There is still no UPDATE grant: the reply goes
--   through coach_log_reply, which checks admin_request_id() and that the
--   report belongs to one of this coach's trainees.
--   The trainee functions are guarded by the access token, like the rest.
--   No service_role key anywhere.
--
-- The notification text never contains the reply itself (it may mention an
-- injury, and a lock screen is public): only who replied and to which workout.
-- =====================================================================

alter table public.workout_logs
  add column if not exists coach_note      text,
  add column if not exists coach_note_at   timestamptz,
  add column if not exists coach_seen_at   timestamptz,
  add column if not exists coach_pushed_at timestamptz;

-- ---------- the coach ----------
create or replace function public.coach_log_reply(p_log_id uuid, p_note text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_admin uuid; v_owner uuid; v_old text; v_at timestamptz;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  v_admin := public.admin_request_id();
  if v_admin is null then raise exception 'not authenticated'; end if;

  select t.trainer_id, l.coach_note into v_owner, v_old
    from public.workout_logs l
    join public.trainees t on t.id = l.trainee_id
   where l.id = p_log_id;
  if v_owner is null or v_owner <> v_admin then raise exception 'not your trainee'; end if;

  v_note := left(v_note, 600);
  -- the same text again: nothing to do, and no second notification
  if v_note is not distinct from v_old then
    return jsonb_build_object('ok', true, 'same', true);
  end if;

  update public.workout_logs
     set coach_note      = v_note,
         coach_note_at   = case when v_note is null then null else now() end,
         coach_seen_at   = null,
         coach_pushed_at = null
   where id = p_log_id
  returning coach_note_at into v_at;

  -- send the notification now instead of waiting for the hourly run.
  -- pg_net sends after this transaction commits. Any failure here is
  -- ignored: the hourly run picks the reply up.
  if v_note is not null then
    begin
      perform net.http_post(
        url     := 'https://yidvzlarrcxeonwkuygo.supabase.co/functions/v1/push-reminders',
        headers := jsonb_build_object('Content-Type', 'application/json',
                                      'x-cron-key', (select cron_key from public.push_config where id = 1)),
        body    := '{}'::jsonb,
        timeout_milliseconds := 20000);
    exception when others then null;
    end;
  end if;

  return jsonb_build_object('ok', true, 'at', v_at);
end $$;

-- ---------- the trainee page ----------
-- Same signature and return type as before; each log object gains
-- id, note, coach, coachAt, coachSeen. Old pages ignore the extra keys.
create or replace function public.trainee_extras(
  p_token text,
  p_limit integer default 120
)
returns table (
  logs          jsonb,
  session_state jsonb,
  weighins      jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  with me as (
    select id, coalesce(session_state, '{}'::jsonb) as st,
           coalesce(weighins, '[]'::jsonb) as w
      from public.trainees
     where access_token = p_token and access_active
       and not deleted and status <> 'archived'
     limit 1
  )
  select
    coalesce((
      select jsonb_agg(x order by x->>'date')
        from (
          select jsonb_build_object(
                   'date',      l.date,
                   'dayName',   l.day_name,
                   'entries',   l.entries,
                   'feel',      l.feel,
                   'id',        l.id,
                   'note',      l.note,
                   'coach',     l.coach_note,
                   'coachAt',   l.coach_note_at,
                   'coachSeen', (l.coach_seen_at is not null)
                 ) as x
            from public.workout_logs l
           where l.trainee_id = (select id from me)
           order by l.date desc
           limit greatest(1, least(coalesce(p_limit, 120), 500))
        ) s
    ), '[]'::jsonb),
    (select st from me),
    (select w  from me)
  from me;
$$;

create or replace function public.trainee_feedback_seen(p_token text)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_id text; n integer;
begin
  select id into v_id from public.trainees
   where access_token = p_token and access_active and not deleted and status <> 'archived';
  if v_id is null then raise exception 'invalid token'; end if;
  update public.workout_logs
     set coach_seen_at = now()
   where trainee_id = v_id and coach_note is not null and coach_seen_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- First name, business name and phone of the trainee's coach, from the
-- coach's own settings. Digits only for the phone.
create or replace function public.trainee_coach(p_token text)
returns jsonb
language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
           'name',     nullif(btrim(coalesce(p.data->'settings'->>'trainer', '')), ''),
           'business', nullif(btrim(coalesce(p.data->'settings'->>'business', '')), ''),
           'phone',    nullif(regexp_replace(coalesce(p.data->'settings'->>'phone', ''), '[^0-9]', '', 'g'), ''))
    from public.trainees t
    left join public.trainer_prefs p on p.trainer_id = t.trainer_id
   where t.access_token = p_token and t.access_active
     and not t.deleted and t.status <> 'archived'
   limit 1;
$$;

-- ---------- notifications ----------
-- As in push-reminders.sql, plus the "coach" preference (default on).
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
    'coach',   coalesce((p_prefs->>'coach')::boolean, true),
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

-- As in push-reminders.sql, plus one item per phone for every coach reply
-- that was not announced yet (last 3 days only).
create or replace function public.push_due(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_hour  int  := extract(hour from (now() at time zone 'Asia/Jerusalem'))::int;
  v_dow   int  := extract(dow  from (now() at time zone 'Asia/Jerusalem'))::int;   -- 0 = Sunday
  v_dom   int  := extract(day  from (now() at time zone 'Asia/Jerusalem'))::int;
  v_month text := to_char(now() at time zone 'Asia/Jerusalem', 'YYYY-MM');
  v_cfg   public.push_config;
  v_items jsonb := '[]'::jsonb;
  v_ids   uuid[];
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

  -- the coach replied to a workout. The ids are fixed first, so a reply
  -- saved while this runs is not marked as announced without being sent.
  select array_agg(id) into v_ids from public.workout_logs
   where coach_note is not null and coach_pushed_at is null;
  if v_ids is not null then
    for r in
      select s.id, s.endpoint, s.p256dh, s.auth, t.access_token, l.day_name,
             nullif(split_part(btrim(coalesce(p.data->'settings'->>'trainer', '')), ' ', 1), '') as coach
        from public.workout_logs l
        join public.trainees t on t.id = l.trainee_id
        join public.push_subs s on s.trainee_id = l.trainee_id
        left join public.trainer_prefs p on p.trainer_id = t.trainer_id
       where l.id = any(v_ids)
         and l.coach_note_at > now() - interval '3 days'
         and t.access_active and not t.deleted and t.status <> 'archived'
         and coalesce((s.prefs->>'coach')::boolean, true)
    loop
      v_items := v_items || jsonb_build_object(
        'id', r.id, 'endpoint', r.endpoint, 'p256dh', r.p256dh, 'auth', r.auth,
        'payload', jsonb_build_object(
          'title', 'תגובה מ' || coalesce(r.coach, 'המאמן') || ' על האימון שלך',
          'body', case when coalesce(r.day_name, '') <> '' then r.day_name || ' · ' else '' end || 'נגיעה כדי לקרוא',
          'tag', 'bp-coach', 'url', 't.html?go=coach#' || r.access_token, 'kind', 'coach'));
    end loop;
    update public.workout_logs set coach_pushed_at = now() where id = any(v_ids);
  end if;

  return jsonb_build_object('public', v_cfg.vapid_public, 'private', v_cfg.vapid_private, 'items', v_items);
end $$;

-- ---------- grants ----------
revoke all on function public.coach_log_reply(uuid, text)                        from public, anon, authenticated;
revoke all on function public.trainee_extras(text, integer)                      from public, anon, authenticated;
revoke all on function public.trainee_feedback_seen(text)                        from public, anon, authenticated;
revoke all on function public.trainee_coach(text)                                from public, anon, authenticated;
revoke all on function public.trainee_push_subscribe(text,text,text,text,jsonb)  from public, anon, authenticated;
revoke all on function public.push_due(text)                                     from public, anon, authenticated;
grant execute on function public.coach_log_reply(uuid, text)                       to anon, authenticated;
grant execute on function public.trainee_extras(text, integer)                     to anon, authenticated;
grant execute on function public.trainee_feedback_seen(text)                       to anon, authenticated;
grant execute on function public.trainee_coach(text)                               to anon, authenticated;
grant execute on function public.trainee_push_subscribe(text,text,text,text,jsonb) to anon, authenticated;
grant execute on function public.push_due(text)                                    to anon;

notify pgrst, 'reload schema';
