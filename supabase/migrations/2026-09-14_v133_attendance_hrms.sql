-- ═══ Bridge v133 — Attendance (HRMS Phase 1 spec §7, §9, §11, §12) ═══
-- Applied to the live project (bxuhmyxfzoqvmukausjd) on 2026-09-14 via the Supabase MCP.
-- Everything is ADDITIVE; nothing existing is dropped or deleted.

-- Public holidays (per location; location_id NULL = every location)
create table if not exists public.public_holidays (
  id text primary key default ('ph_'||substr(gen_random_uuid()::text,1,12)),
  date date not null,
  name text not null,
  location_id text,                       -- null = all locations
  created_by uuid, created_at timestamptz default now());
create index if not exists public_holidays_date_idx on public.public_holidays(date);
alter table public.public_holidays enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='public_holidays' and policyname='public_holidays_auth_all') then
    create policy public_holidays_auth_all on public.public_holidays for all to authenticated using (true) with check (true);
  end if; end $$;

-- Attendance requests: regularisation · partial_day · on_duty · comp_off (auto from a rest-day clock-in)
create table if not exists public.attendance_requests (
  id text primary key default ('areq_'||substr(gen_random_uuid()::text,1,12)),
  user_id uuid not null,
  type text not null,                     -- regularisation | partial_day | on_duty | comp_off
  date date not null,
  date_to date,                           -- on_duty may span days
  payload jsonb not null default '{}'::jsonb,  -- {in,out,attendance_id,kind,minutes,...}
  reason text default '',
  status text not null default 'Pending', -- Pending | Approved | Rejected | Cancelled
  decided_by uuid, decided_at timestamptz, decision_note text default '',
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now());
create index if not exists attendance_requests_user_idx on public.attendance_requests(user_id,date);
create index if not exists attendance_requests_status_idx on public.attendance_requests(status);
alter table public.attendance_requests enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='attendance_requests' and policyname='attendance_requests_auth_all') then
    create policy attendance_requests_auth_all on public.attendance_requests for all to authenticated using (true) with check (true);
  end if; end $$;

-- Attendance: keep the ORIGINAL punch when a row is corrected (spec §9.6 / §15.1) + offline-queued punches (§15.5)
alter table public.attendance
  add column if not exists history jsonb not null default '[]'::jsonb,   -- [{at,by,reason,before:{in,out,mode}}]
  add column if not exists queued boolean not null default false,        -- punch captured offline, synced later
  add column if not exists rm_notified_at timestamptz;                   -- open-shift flag sent to the manager

-- Realtime for the new tables
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='attendance_requests') then
    alter publication supabase_realtime add table public.attendance_requests; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='public_holidays') then
    alter publication supabase_realtime add table public.public_holidays; end if;
end $$;
