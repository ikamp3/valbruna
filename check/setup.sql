-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Lets a signed-in person delete their own account (the "Delete my account" button). Nobody can delete
-- anyone else: it only ever deletes the caller (auth.uid()).
create or replace function public.delete_me()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated;
