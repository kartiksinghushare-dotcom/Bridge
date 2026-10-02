-- ═══ Bridge v4.0 — OKR "One scoreboard" (Road to 1,000 proposal, v1.2) ═══
-- Everything here is ADDITIVE. No table, column, policy, function or row is dropped, renamed or
-- re-typed. Every new column is nullable or has a default, so the 316 live objectives behave
-- exactly as before until someone edits them. Safe to run more than once (IF NOT EXISTS everywhere).
--
-- What this enables (see CHANGES.md v4.0):
--   · Objective vs Key Result   okrs.kind = 'objective' | 'kr'     (default 'objective' — today's rows)
--   · KR kinds                   okrs.kr_kind = null (metric, today's behaviour) | 'milestone' | 'count' | 'range'
--   · Milestone KRs              due_date + done_at / done_by
--   · Counted-items KRs          items jsonb  [{id,name,due,doneAt,doneBy}]   → "4 / 6 areas", items visible
--   · Floor + target KRs         floor_value  (breach = Not achieved; target drives %)
--   · Approved ramp (Appendix A) pacing jsonb [{date,value}] + pace_tolerance — "on track" vs the real plan
--   · North Star                 is_north_star (any root can carry it — UAE and KSA can each have one)
--   · Engine contribution        contributes_to = id of the objective this one's target counts toward
--   · Proposed vs confirmed      target_confirmed (default true) + target_basis (Appendix B note)
--   · Leading / lagging          lead_lag
--   · Owner TBD / needs decision owner_tbd, needs_decision + decision_note
--   · Draft objectives           state = 'draft' | 'active'   (closed stays its own flag)
--   · Baseline date              baseline_as_of
--   · Weekly owner flag          okr_checkins.flag = 'on_track' | 'at_risk' | 'blocked'
--   · Review log                 okr_reviews (weekly / monthly review sign-offs + notes)

-- ───────────────────────────── 1. okrs — new columns ─────────────────────────────
alter table public.okrs add column if not exists kind              text        not null default 'objective';
alter table public.okrs add column if not exists kr_kind           text;                       -- null = metric (existing start→target)
alter table public.okrs add column if not exists is_north_star     boolean     not null default false;
alter table public.okrs add column if not exists due_date          date;                       -- milestone KRs
alter table public.okrs add column if not exists done_at           timestamptz;                -- milestone KRs
alter table public.okrs add column if not exists done_by           text;
alter table public.okrs add column if not exists floor_value       numeric;                    -- range KRs
alter table public.okrs add column if not exists items             jsonb       not null default '[]'::jsonb;  -- count KRs
alter table public.okrs add column if not exists pacing            jsonb       not null default '[]'::jsonb;  -- [{date,value}]
alter table public.okrs add column if not exists pace_tolerance    numeric;                    -- null = app default (15 pts)
alter table public.okrs add column if not exists contributes_to    text;                       -- okrs.id this target counts toward
alter table public.okrs add column if not exists target_confirmed  boolean     not null default true;
alter table public.okrs add column if not exists target_basis      text        not null default '';
alter table public.okrs add column if not exists lead_lag          text;                       -- 'leading' | 'lagging' | null
alter table public.okrs add column if not exists owner_tbd         boolean     not null default false;
alter table public.okrs add column if not exists needs_decision    boolean     not null default false;
alter table public.okrs add column if not exists decision_note     text        not null default '';
alter table public.okrs add column if not exists state             text        not null default 'active';     -- 'draft' | 'active'
alter table public.okrs add column if not exists baseline_as_of    date;

-- Guard rails (NOT VALID so existing rows are never re-checked; new writes are).
do $$ begin
  if not exists (select 1 from pg_constraint where conname='okrs_kind_chk') then
    alter table public.okrs add constraint okrs_kind_chk check (kind in ('objective','kr')) not valid; end if;
  if not exists (select 1 from pg_constraint where conname='okrs_kr_kind_chk') then
    alter table public.okrs add constraint okrs_kr_kind_chk check (kr_kind is null or kr_kind in ('milestone','count','range')) not valid; end if;
  if not exists (select 1 from pg_constraint where conname='okrs_state_chk') then
    alter table public.okrs add constraint okrs_state_chk check (state in ('draft','active')) not valid; end if;
  if not exists (select 1 from pg_constraint where conname='okrs_lead_lag_chk') then
    alter table public.okrs add constraint okrs_lead_lag_chk check (lead_lag is null or lead_lag in ('leading','lagging')) not valid; end if;
end $$;

create index if not exists okrs_kind_idx          on public.okrs(kind) where deleted_at is null;

-- "Owner to be decided": the row has no owner yet, so the owner-based select policy would hide it from
-- its own creator after a reload. While owner_tbd is set, the CREATOR counts as the owner for visibility
-- (same scope rules — a team-scoped manager sees it, "only their own" sees their own). Additive policy;
-- permissive policies OR together with okrs_select.
do $$ begin
  if not exists (select 1 from pg_policy where polname='okrs_select_owner_tbd' and polrelid='public.okrs'::regclass) then
    create policy okrs_select_owner_tbd on public.okrs for select to authenticated
      using (owner_tbd and created_by is not null and bridge_can_see_okr(created_by, to_jsonb(array[created_by]))); end if;
end $$;
create index if not exists okrs_north_star_idx    on public.okrs(is_north_star) where is_north_star and deleted_at is null;
create index if not exists okrs_contributes_idx   on public.okrs(contributes_to) where contributes_to is not null;

-- ───────────────────────────── 2. okr_checkins — the owner's weekly flag ─────────────────────────────
alter table public.okr_checkins add column if not exists flag text;   -- 'on_track' | 'at_risk' | 'blocked' | null
do $$ begin
  if not exists (select 1 from pg_constraint where conname='okr_checkins_flag_chk') then
    alter table public.okr_checkins add constraint okr_checkins_flag_chk check (flag is null or flag in ('on_track','at_risk','blocked')) not valid; end if;
end $$;

-- ───────────────────────────── 3. okr_reviews — weekly / monthly review sign-offs ─────────────────────────────
-- One row per review actually held. period_key: weekly 'YYYY-Www' (ISO week) · monthly 'YYYY-MM'.
-- notes: free text per L0 / per item, decisions taken — [{okrId, note, decision}].
create table if not exists public.okr_reviews (
  id          text primary key default ('okrv_'||substr(gen_random_uuid()::text,1,12)),
  kind        text not null,                         -- 'weekly' | 'monthly'
  period_key  text not null,
  scope_id    text,                                  -- null = whole company; else a root okrs.id (e.g. the KSA tree)
  notes       jsonb not null default '[]'::jsonb,
  summary     text not null default '',
  held_by     text,                                  -- profiles.id (text, same as okrs.owner_id)
  held_at     timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint okr_reviews_kind_chk check (kind in ('weekly','monthly')));
create unique index if not exists okr_reviews_period_idx on public.okr_reviews(kind, period_key, coalesce(scope_id,''));
alter table public.okr_reviews enable row level security;
-- Same posture as okr_logs: anyone signed in can read; writes are open to the app (the app gates
-- them with the 'okr' permission area — run_review).
do $$ begin
  if not exists (select 1 from pg_policy where polname='okr_reviews_select' and polrelid='public.okr_reviews'::regclass) then
    create policy okr_reviews_select on public.okr_reviews for select to authenticated using (true); end if;
  if not exists (select 1 from pg_policy where polname='okr_reviews_insert' and polrelid='public.okr_reviews'::regclass) then
    create policy okr_reviews_insert on public.okr_reviews for insert to authenticated with check (true); end if;
  if not exists (select 1 from pg_policy where polname='okr_reviews_update' and polrelid='public.okr_reviews'::regclass) then
    create policy okr_reviews_update on public.okr_reviews for update to authenticated using (true) with check (true); end if;
  if not exists (select 1 from pg_policy where polname='okr_reviews_delete' and polrelid='public.okr_reviews'::regclass) then
    create policy okr_reviews_delete on public.okr_reviews for delete to authenticated using (true); end if;
end $$;

-- ───────────────────────────── 4. okr_alerts — what the daily job already told people ─────────────────────────────
-- Dedup + history for variance / stale / blocked alerts, so a person is not nagged about the same
-- condition every morning. One row per (okr, kind, condition fingerprint).
create table if not exists public.okr_alerts (
  id          text primary key default ('okra_'||substr(gen_random_uuid()::text,1,12)),
  okr_id      text not null,
  kind        text not null,                         -- 'variance' | 'stale' | 'blocked'
  fingerprint text not null,
  constraint okr_alerts_kind_chk check (kind in ('variance','stale','blocked')),                         -- e.g. variance:2026-10-31 · stale:2026-10-15 · blocked:<checkin id>
  sent_to     jsonb not null default '[]'::jsonb,    -- user ids notified
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz);
create unique index if not exists okr_alerts_fp_idx on public.okr_alerts(okr_id, kind, fingerprint);
create index if not exists okr_alerts_open_idx on public.okr_alerts(okr_id) where resolved_at is null;
alter table public.okr_alerts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policy where polname='okr_alerts_select' and polrelid='public.okr_alerts'::regclass) then
    create policy okr_alerts_select on public.okr_alerts for select to authenticated using (bridge_can_see_okr_id(okr_id)); end if;
  -- inserts/updates come from the service-role job only; no authenticated write policy on purpose.
end $$;

-- Done. Nothing above changes how the current app reads or writes — select('*') simply gains columns.
