-- v157 — App Store readiness: in-app account-deletion requests (Apple guideline 5.1.1(v)).
-- Nothing is deleted automatically: the request is recorded, the person is signed out, and
-- super admins / the People team are notified to deactivate the account and purge what the law
-- does not require BloomingBox to keep (see /legal/privacy.html §7 and §9).
create table if not exists public.account_deletion_requests(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text,
  reason text,
  requested_at timestamptz not null default now(),
  status text not null default 'pending',        -- pending | done | rejected
  handled_by uuid references public.profiles(id),
  handled_at timestamptz,
  note text
);
create index if not exists account_deletion_requests_status on public.account_deletion_requests(status, requested_at desc);
alter table public.account_deletion_requests enable row level security;
drop policy if exists adr_insert_own on public.account_deletion_requests;
create policy adr_insert_own on public.account_deletion_requests for insert to authenticated with check (user_id = auth.uid());
drop policy if exists adr_select on public.account_deletion_requests;
create policy adr_select on public.account_deletion_requests for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role in ('Admin','SubAdmin') or (p.hrm->>'roleProfileId') in ('superadmin','admin'))));
drop policy if exists adr_update_admin on public.account_deletion_requests;
create policy adr_update_admin on public.account_deletion_requests for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role in ('Admin','SubAdmin') or (p.hrm->>'roleProfileId') in ('superadmin','admin'))));
