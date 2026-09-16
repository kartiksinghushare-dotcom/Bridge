-- v155 — forgot-password: a reset link is only honoured for 10 minutes after it was sent.
-- Supabase stamps auth.users.recovery_sent_at when the reset email goes out; the reset
-- screen calls this before letting the person choose a new password.
create or replace function public.pw_reset_window_ok()
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select coalesce(
    (select u.recovery_sent_at is not null
            and u.recovery_sent_at > now() - interval '10 minutes'
       from auth.users u where u.id = auth.uid()),
    false);
$$;
revoke all on function public.pw_reset_window_ok() from public;
grant execute on function public.pw_reset_window_ok() to authenticated;
