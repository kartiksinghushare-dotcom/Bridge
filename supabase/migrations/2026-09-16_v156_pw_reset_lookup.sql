-- v156 — forgot-password: tell the person plainly whether the email has a Bridge account,
-- but only through a rate-limited, security-definer lookup (no table access for anon).
create table if not exists public.pw_reset_attempts(
  id bigserial primary key,
  email text not null,
  at timestamptz not null default now()
);
create index if not exists pw_reset_attempts_email_at on public.pw_reset_attempts(email, at desc);
alter table public.pw_reset_attempts enable row level security;   -- no policies: only the function below touches it

create or replace function public.pw_reset_lookup(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  e text := lower(trim(coalesce(p_email,'')));
  n_recent int;
  st text;
begin
  if e = '' or e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return 'invalid'; end if;
  delete from public.pw_reset_attempts where at < now() - interval '1 day';
  select count(*) into n_recent from public.pw_reset_attempts where email = e and at > now() - interval '15 minutes';
  if n_recent >= 5 then return 'too_many'; end if;
  insert into public.pw_reset_attempts(email) values (e);
  select p.status into st from public.profiles p where lower(p.email) = e limit 1;
  if st is null then return 'not_found'; end if;
  if st <> 'Active' then return 'inactive'; end if;
  return 'ok';
end;
$$;
revoke all on function public.pw_reset_lookup(text) from public;
grant execute on function public.pw_reset_lookup(text) to anon, authenticated;
