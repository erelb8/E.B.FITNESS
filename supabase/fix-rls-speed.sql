-- fix-rls-speed.sql  (17.11.2026)
--
-- Problem: every RLS policy called public.admin_request_id() once PER ROW.
-- That function checks the x-admin-token header with bcrypt (cost 10, ~75 ms
-- per admin session row). With 122 workout_logs rows the read needs ~10 s,
-- and the anon role has statement_timeout = 3s -> HTTP 500.
-- Seen in the logs: workout_logs 11x 500 (the full backup silently came out
-- without trainee reports), payments 6x 500, trainees 3x 500.
--
-- Fix: wrap the call in a scalar sub-select. Postgres then runs it once per
-- statement (an InitPlan) instead of once per row. Same rule, same access,
-- same roles - only the evaluation count changes. This is the pattern
-- Supabase recommends for functions inside RLS policies.
--
-- ALTER POLICY keeps the policy's command and roles as they are.

begin;

alter policy trainer_all on public.trainees
  using      (trainer_id = (select public.admin_request_id()))
  with check (trainer_id = (select public.admin_request_id()));

alter policy trainer_all on public.sessions
  using      (trainer_id = (select public.admin_request_id()))
  with check (trainer_id = (select public.admin_request_id()));

alter policy trainer_all on public.measures
  using      (trainer_id = (select public.admin_request_id()))
  with check (trainer_id = (select public.admin_request_id()));

alter policy trainer_all on public.payments
  using      (trainer_id = (select public.admin_request_id()))
  with check (trainer_id = (select public.admin_request_id()));

alter policy prefs_own on public.trainer_prefs
  using      (trainer_id = (select public.admin_request_id()))
  with check (trainer_id = (select public.admin_request_id()));

alter policy trainer_read_logs on public.workout_logs
  using (exists (
    select 1 from public.trainees tr
    where tr.id = workout_logs.trainee_id
      and tr.trainer_id = (select public.admin_request_id())
  ));

commit;

-- Check: every row below must contain "SELECT public.admin_request_id()"
-- inside parentheses, i.e. "( SELECT admin_request_id() AS admin_request_id)".
select tablename, policyname, qual
from pg_policies
where schemaname = 'public' and qual ilike '%admin_request_id%'
order by 1;
