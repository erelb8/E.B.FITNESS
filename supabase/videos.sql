-- Exercise videos: a public "videos" bucket and an RPC for the trainee page.
--
-- Why copy the policies instead of writing them: the live "programs" bucket
-- works for the coach, whose session is anon + x-admin-token (auth.uid() is
-- NULL), while storage.sql in the repo describes an older auth model. Copying
-- whatever policies are live on "programs" gives "videos" the exact same
-- access, whatever it is today.
--
-- Read access: the bucket is public, so a video plays from its URL. Paths
-- carry a random part and are not listed anywhere a trainee can see, the same
-- rule as program files.
--
-- Safe to run more than once.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos', 'videos', true,
  52428800,
  array['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  r record;
  nm text;
  sql text;
begin
  for r in
    select * from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'programs%'
  loop
    nm := replace(r.policyname, 'programs', 'videos');
    execute format('drop policy if exists %I on storage.objects', nm);
    sql := format('create policy %I on storage.objects as %s for %s to %s',
                  nm, r.permissive, r.cmd, array_to_string(r.roles, ', '));
    if r.qual is not null then
      sql := sql || ' using (' || replace(r.qual, '''programs''', '''videos''') || ')';
    end if;
    if r.with_check is not null then
      sql := sql || ' with check (' || replace(r.with_check, '''programs''', '''videos''') || ')';
    end if;
    execute sql;
  end loop;
end $$;

-- The general video list lives in the coach settings (trainer_prefs).
-- The trainee page reads only that list, nothing else from the settings.
create or replace function public.trainee_videos(p_token text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(p.data->'settings'->'exVideos', '{}'::jsonb)
    from public.trainees t
    left join public.trainer_prefs p on p.trainer_id = t.trainer_id
   where t.access_token = p_token
     and t.access_active
     and not t.deleted
     and t.status <> 'archived'
   limit 1;
$$;

revoke all on function public.trainee_videos(text) from public;
grant execute on function public.trainee_videos(text) to anon, authenticated;

-- Check: the bucket, and one "videos" policy for every "programs" policy
select 'bucket' as what, id as name, (file_size_limit / 1048576)::text || ' MB' as detail
  from storage.buckets where id = 'videos'
union all
select 'policy', policyname, cmd
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and (policyname like 'videos%' or policyname like 'programs%')
order by 1, 2;
