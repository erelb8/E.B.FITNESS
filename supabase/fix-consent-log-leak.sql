-- =====================================================================
-- Close two holes found in the security check of 12.11.2026
-- Paste into Supabase -> SQL Editor -> Run. Safe to run more than once.
--
-- 1. consent_log was a SECURITY DEFINER view with SELECT granted to anon.
--    Anyone holding the public key (it is in config.js, by design) could
--    read the name of every trainee and when they signed the health
--    declaration. The app never reads this view; it is for manual checks
--    in the SQL editor only, where it keeps working.
--
-- 2. check_admin_password(email, password) was callable by anon and
--    answers true/false with no delay and no lockout - a free oracle for
--    guessing the admin password. The app does not call it (login goes
--    through admin_login, which sleeps on failure).
-- =====================================================================

alter view public.consent_log set (security_invoker = true);
revoke all on public.consent_log from anon, authenticated;

revoke all on function public.check_admin_password(text, text) from public, anon, authenticated;

-- check: both rows must say false
select 'consent_log readable by anon' as what,
       has_table_privilege('anon', 'public.consent_log', 'select') as open
union all
select 'check_admin_password callable by anon',
       has_function_privilege('anon', 'public.check_admin_password(text,text)', 'execute');
