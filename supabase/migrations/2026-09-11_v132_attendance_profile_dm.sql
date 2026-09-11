-- ═══ Bridge v132 — geofenced attendance · rich profiles · profile documents · direct messages ═══
-- ALREADY APPLIED to the live project (bxuhmyxfzoqvmukausjd) on 2026-09-11 via the Supabase MCP.
-- Kept here as the record of what changed. Everything is ADDITIVE; nothing existing was dropped.

-- Locations: geofence
alter table public.locations
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists radius_m integer default 150,
  add column if not exists geofence_enabled boolean default false,
  add column if not exists timezone text default 'Asia/Dubai';

-- Profiles: HR / profile fields
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists employee_id text,
  add column if not exists joining_date date,
  add column if not exists birth_date date,
  add column if not exists wfh_allowed boolean default false,
  add column if not exists attendance_required boolean default true,
  add column if not exists location_id text,
  add column if not exists work_schedule jsonb default '{"in":"09:00","out":"18:00","offDays":["Sun"]}'::jsonb,
  add column if not exists details jsonb default '{}'::jsonb;

-- Attendance sessions (several per day allowed; open session = clock_out_at is null)
create table if not exists public.attendance (
  id text primary key default ('att_'||substr(gen_random_uuid()::text,1,12)),
  user_id uuid not null, date date not null,
  clock_in_at timestamptz, clock_out_at timestamptz,
  in_lat double precision, in_lng double precision, in_acc integer,
  out_lat double precision, out_lng double precision, out_acc integer,
  in_location_id text, out_location_id text, in_distance_m integer, out_distance_m integer,
  mode text not null default 'office', auto_out boolean not null default false, source text default 'web',
  note text default '', edited_by uuid, edited_at timestamptz, edit_reason text,
  created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.wfh_days (user_id uuid not null, date date not null, note text default '', created_at timestamptz default now(), primary key (user_id,date));
create table if not exists public.profile_documents (
  id text primary key default ('pdoc_'||substr(gen_random_uuid()::text,1,12)),
  user_id uuid not null, name text not null, category text default 'Other', storage_path text not null,
  file_type text, file_size bigint, expiry_date date, notes text default '', uploaded_by uuid, uploaded_at timestamptz default now());
-- RLS: same permissive "all authenticated" model every other Bridge table uses; the app enforces Access Control.
-- Storage buckets: 'avatars' (public, 5 MB, images) and 'profile-docs' (private, 25 MB, signed URLs).
-- Direct messages: crm_conversations.kind ('chat'|'dm') + dm_members text[]; trigger crm_messages_fan_out_dm → notifications kind 'dm'.
-- Server job: bridge_attendance_tick() every 5 min (pg_cron 'bridge-attendance-tick') — auto clock-out at
--   attendance_settings.auto_out_time, clock-in / clock-out reminders (in-app + push + email), birthdays,
--   work anniversaries and document-expiry notes (kind 'people'). Settings row: workspace_settings.attendance_settings.
-- Realtime publication: + attendance, wfh_days, profiles.  Edge function send-push redeployed (v4) with the new kinds.
