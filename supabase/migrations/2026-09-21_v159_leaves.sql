-- ═══ Bridge v159 — Leave module (HRMS Phase 1 §5–§8, §11, §12, §17) ═══
-- Applied to the live project (bxuhmyxfzoqvmukausjd) via the Supabase MCP. Everything is ADDITIVE: no existing
-- table, column, policy or row is dropped or changed. Decisions (Kartik, 16 + 21 Sep 2026):
--   · person = profiles (no separate employments table); band / probation / compensation hang off the profile
--   · defaults follow UAE Labour Law (Federal Decree-Law 33/2021 + Cabinet Resolution 1/2022); every rule is a switch
--   · the LEDGER is the only balance truth: append-only, 4 dp, one row per posting, UPDATE/DELETE blocked by trigger
--   · balances are consumed at TAKEN (posted by the server job once the leave has ended), not at Approved
--
-- Tables : leave_types · leave_requests · leave_ledger · leave_config_audit · compensation
-- Functions: bridge_leave_perm(action,target) · bridge_leave_entitlement(user) · bridge_leave_tick() (+_guarded)
-- Job    : pg_cron 'bridge-leave-tick' hourly → monthly accrual, taken postings, SLA nudges, "starts tomorrow" reminders

-- ───────────────────────────── 1. LEAVE TYPES (rules live in jsonb, editable in Administration → Leaves) ─────────────
create table if not exists public.leave_types (
  key text primary key,                       -- annual | sick | maternity | …
  name text not null,
  sort int not null default 100,
  active boolean not null default true,
  color text default '#54433C',
  icon text default 'calendar',
  rules jsonb not null default '{}'::jsonb,   -- the full per-type schema (spec §8.2) — see 28-leaves-admin.js LV_TYPE_DEFAULTS
  updated_by uuid, updated_at timestamptz default now(), created_at timestamptz default now());
alter table public.leave_types enable row level security;

-- ───────────────────────────── 2. LEAVE REQUESTS (state machine) ─────────────────────────────
create table if not exists public.leave_requests (
  id text primary key default ('lv_'||substr(gen_random_uuid()::text,1,12)),
  user_id uuid not null,
  type_key text not null references public.leave_types(key),
  date_from date not null,
  date_to date not null,
  half_day text,                              -- null | 'am' | 'pm'  (single-day requests only)
  days numeric(8,2) not null default 0,       -- working days (or calendar days for calendar-unit types) this request consumes
  day_list jsonb not null default '[]'::jsonb,-- ISO dates actually consumed (rest days / holidays excluded per sandwich rule)
  reason text default '',
  attachment_url text,                        -- storage path in bucket leave-docs
  status text not null default 'Pending',     -- Pending | Approved | Rejected | Cancelled | Withdrawn
  level int not null default 0,               -- index of the approval level currently waiting
  flow jsonb not null default '[]'::jsonb,    -- snapshot of the approval flow at submission [{approver,label,ids:[…]}]
  approvals jsonb not null default '[]'::jsonb,-- [{level,by,at,status,note}]
  applied_by uuid,                            -- null = self; otherwise the manager / People who applied on behalf
  override_reason text,                       -- notice-rule override by the RM / People
  decided_by uuid, decided_at timestamptz, decision_note text default '',
  balance_snapshot jsonb,                     -- {accrued,available,booked} at submission (shown in the inbox)
  meta jsonb not null default '{}'::jsonb,
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint leave_requests_dates check (date_to >= date_from),
  constraint leave_requests_status check (status in ('Pending','Approved','Rejected','Cancelled','Withdrawn')));
create index if not exists leave_requests_user_idx on public.leave_requests(user_id, date_from);
create index if not exists leave_requests_status_idx on public.leave_requests(status);
create index if not exists leave_requests_range_idx on public.leave_requests(date_from, date_to);
alter table public.leave_requests enable row level security;

-- ───────────────────────────── 3. LEDGER (append-only) ─────────────────────────────
create table if not exists public.leave_ledger (
  id text primary key default ('ll_'||substr(gen_random_uuid()::text,1,12)),
  user_id uuid not null,
  type_key text not null,
  entry_type text not null,                   -- opening_balance | accrual | taken | adjustment | carry_forward | forfeiture | encashment | correction | comp_off
  quantity numeric(10,4) not null,            -- + credit / − debit, 4 dp (spec §8.4)
  effective_date date not null,
  period text,                                -- 'YYYY-MM' for accruals (idempotency key)
  request_id text,                            -- leave_requests.id for taken / correction
  source_id text,                             -- e.g. attendance_requests.id for comp_off
  actor uuid,                                 -- who posted (null = server job)
  reason text default '',
  meta jsonb not null default '{}'::jsonb,    -- {rate,entitlement,band,prorate,…} snapshot of the policy used
  created_at timestamptz default now(),
  constraint leave_ledger_entry_type check (entry_type in ('opening_balance','accrual','taken','adjustment','carry_forward','forfeiture','encashment','correction','comp_off')));
create index if not exists leave_ledger_user_idx on public.leave_ledger(user_id, type_key, effective_date);
create unique index if not exists leave_ledger_accrual_uniq on public.leave_ledger(user_id, type_key, period) where entry_type = 'accrual';
create unique index if not exists leave_ledger_taken_uniq on public.leave_ledger(request_id) where entry_type = 'taken';
create unique index if not exists leave_ledger_compoff_uniq on public.leave_ledger(source_id) where entry_type = 'comp_off';
alter table public.leave_ledger enable row level security;

create or replace function public.bridge_leave_ledger_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'leave ledger is append-only — post a correction entry instead';
end $$;
drop trigger if exists leave_ledger_immutable on public.leave_ledger;
create trigger leave_ledger_immutable before update or delete on public.leave_ledger for each row execute function public.bridge_leave_ledger_guard();

-- ───────────────────────────── 4. CONFIG AUDIT (every change to a rule: actor, before, after) ─────────────────────────────
create table if not exists public.leave_config_audit (
  id text primary key default ('lca_'||substr(gen_random_uuid()::text,1,12)),
  actor uuid, at timestamptz default now(),
  area text not null,                         -- settings | type:<key> | holiday | role
  field text,
  before jsonb, after jsonb,
  note text default '');
create index if not exists leave_config_audit_at_idx on public.leave_config_audit(at desc);
alter table public.leave_config_audit enable row level security;

-- ───────────────────────────── 5. COMPENSATION (Head of People + super admin only — data-layer enforced) ─────────────────
create table if not exists public.compensation (
  user_id uuid primary key,
  basic numeric(12,2) not null default 0,
  housing numeric(12,2) not null default 0,
  transport numeric(12,2) not null default 0,
  other numeric(12,2) not null default 0,
  currency text not null default 'AED',
  effective_from date,
  history jsonb not null default '[]'::jsonb, -- [{effective_from,basic,housing,transport,other,currency,changed_by,changed_at}]
  updated_by uuid, updated_at timestamptz default now());
alter table public.compensation enable row level security;

-- ───────────────────────────── 6. PERMISSIONS — bridge_leave_perm mirrors can()/scopeFilter() for area 'leave' ───────────
-- actions: view · apply · applyFor · approve · adjust · manage · export · viewCompensation · editCompensation
create or replace function public.bridge_leave_perm(p_action text, p_target uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid(); mp record; area jsonb; rid text; sc text; ok boolean := false; is_mgr boolean; is_hr boolean;
  full_perm constant jsonb := '{"scope":"everyone","actions":{"view":true,"apply":true,"applyFor":true,"approve":true,"adjust":true,"manage":true,"export":true,"viewCompensation":true,"editCompensation":true}}';
begin
  if me is null or p_target is null then return false; end if;
  select id, role, hrm, status into mp from profiles where id = me;
  if mp.id is null or coalesce(mp.status,'Active') <> 'Active' then return false; end if;
  rid  := mp.hrm->>'roleProfileId';
  area := mp.hrm->'perms'->'leave';
  if area is null and rid is not null then
    select value->rid->'perms'->'leave' into area from workspace_settings where key = 'role_profiles';
    if area is null then
      area := case rid
        when 'superadmin'     then full_perm
        when 'admin'          then '{"scope":"everyone","actions":{"view":true,"apply":true,"applyFor":true,"approve":true,"adjust":true,"manage":true,"export":true}}'::jsonb
        when 'head_of_people' then full_perm
        when 'people_admin'   then '{"scope":"everyone","actions":{"view":true,"apply":true,"applyFor":true,"approve":true,"adjust":true,"manage":true,"export":true}}'::jsonb
        when 'finance'        then '{"scope":"everyone","actions":{"view":true,"apply":true,"export":true}}'::jsonb
        when 'hr'             then '{"scope":"everyone","actions":{"view":true,"apply":true,"applyFor":true,"approve":true,"adjust":true,"manage":true,"export":true}}'::jsonb
        when 'manager'        then '{"scope":"team","actions":{"view":true,"apply":true,"applyFor":true,"approve":true,"export":true}}'::jsonb
        when 'basic'          then '{"scope":"self","actions":{"view":true,"apply":true}}'::jsonb
        else null end;
    end if;
  end if;
  if area is not null then
    ok := coalesce((area->'actions'->>p_action)::boolean, false);
    if not ok then return false; end if;
    sc := coalesce(area->>'scope', 'none');
  else
    if mp.role in ('Admin','SubAdmin') then return p_action not in ('viewCompensation','editCompensation') or mp.role = 'Admin'; end if;
    is_hr  := coalesce((mp.hrm->>'isHR')::boolean, false);
    is_mgr := exists (select 1 from profiles x where x.manager_id = me and x.id <> me);
    ok := case
      when p_action in ('view','apply') then true
      when p_action in ('approve','applyFor') then is_hr or is_mgr
      when p_action in ('adjust','manage','export') then is_hr
      else false end;
    if not ok then return false; end if;
    sc := case when is_hr then 'everyone' when is_mgr then 'team' else 'self' end;
  end if;
  if p_action = 'manage' then return true; end if;
  if p_target = me then return p_action in ('view','apply','export'); end if;   -- never approve / adjust / see pay for yourself
  return case sc
    when 'everyone'   then true
    when 'team'       then p_target in (select bridge_att_subtree(me))
    when 'department' then exists (select 1 from profiles a, profiles b where a.id = me and b.id = p_target and a.department is not null and a.department = b.department)
    when 'location'   then exists (select 1 from profiles a, profiles b where a.id = me and b.id = p_target and a.location_id is not null and a.location_id = b.location_id)
    else false end;
end $$;
grant execute on function public.bridge_leave_perm(text, uuid) to authenticated;

-- ── policies ──
drop policy if exists lt_select on public.leave_types;  drop policy if exists lt_write on public.leave_types;
create policy lt_select on public.leave_types for select to authenticated using (true);
create policy lt_write  on public.leave_types for all to authenticated using (bridge_leave_perm('manage', auth.uid())) with check (bridge_leave_perm('manage', auth.uid()));

drop policy if exists lr_select on public.leave_requests; drop policy if exists lr_insert on public.leave_requests;
drop policy if exists lr_update on public.leave_requests; drop policy if exists lr_delete on public.leave_requests;
create policy lr_select on public.leave_requests for select to authenticated
  using (user_id = auth.uid() or bridge_leave_perm('view', user_id)
         or exists (select 1 from jsonb_array_elements(flow) f where f->'ids' ? auth.uid()::text));   -- an approver always sees what waits for them
create policy lr_insert on public.leave_requests for insert to authenticated
  with check (status = 'Pending' and decided_by is null and created_by = auth.uid()
              and ((user_id = auth.uid() and applied_by is null and bridge_leave_perm('apply', user_id))
                   or (user_id <> auth.uid() and applied_by = auth.uid() and bridge_leave_perm('applyFor', user_id))));
create policy lr_update on public.leave_requests for update to authenticated
  using (user_id = auth.uid() or bridge_leave_perm('approve', user_id) or bridge_leave_perm('adjust', user_id)
         or exists (select 1 from jsonb_array_elements(flow) f where f->'ids' ? auth.uid()::text))
  with check (true);
create policy lr_delete on public.leave_requests for delete to authenticated using (false);

-- The requester may only withdraw (Pending → Withdrawn) or cancel an approved leave that hasn't started; never decide.
create or replace function public.bridge_lr_guard_own() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.user_id <> old.user_id or new.type_key <> old.type_key then raise exception 'leave: type and person cannot change'; end if;
  if old.user_id = auth.uid() and not bridge_leave_perm('adjust', old.user_id) then
    if old.status = 'Pending' and new.status not in ('Pending','Withdrawn') then raise exception 'leave: you can only withdraw your own request'; end if;
    if old.status = 'Approved' and not (new.status = 'Cancelled' and old.date_from > current_date) then raise exception 'leave: approved leave can only be cancelled before it starts — ask People'; end if;
    if old.status in ('Rejected','Cancelled','Withdrawn') then raise exception 'leave: this request is closed'; end if;
    if new.decided_by is distinct from old.decided_by or new.approvals is distinct from old.approvals or new.level is distinct from old.level
       or new.date_from is distinct from old.date_from or new.date_to is distinct from old.date_to or new.days is distinct from old.days then
      raise exception 'leave: you cannot change a submitted request — withdraw it and apply again';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists leave_requests_guard_own on public.leave_requests;
create trigger leave_requests_guard_own before update on public.leave_requests for each row execute function public.bridge_lr_guard_own();

drop policy if exists ll_select on public.leave_ledger; drop policy if exists ll_insert on public.leave_ledger;
create policy ll_select on public.leave_ledger for select to authenticated using (user_id = auth.uid() or bridge_leave_perm('view', user_id));
create policy ll_insert on public.leave_ledger for insert to authenticated
  with check (actor = auth.uid() and user_id <> auth.uid() and entry_type in ('opening_balance','adjustment','carry_forward','forfeiture','encashment','correction','comp_off')
              and bridge_leave_perm('adjust', user_id));
-- (accrual and taken rows are only ever written by the server job — security definer, bypasses RLS)

drop policy if exists lca_select on public.leave_config_audit; drop policy if exists lca_insert on public.leave_config_audit;
create policy lca_select on public.leave_config_audit for select to authenticated using (bridge_leave_perm('manage', auth.uid()));
create policy lca_insert on public.leave_config_audit for insert to authenticated with check (actor = auth.uid() and bridge_leave_perm('manage', auth.uid()));

drop policy if exists comp_select on public.compensation; drop policy if exists comp_write on public.compensation;
create policy comp_select on public.compensation for select to authenticated using (bridge_leave_perm('viewCompensation', user_id));
create policy comp_write  on public.compensation for all to authenticated using (bridge_leave_perm('editCompensation', user_id)) with check (bridge_leave_perm('editCompensation', user_id));

-- ───────────────────────────── 7. STORAGE — private bucket for medical certificates etc. ─────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit) values ('leave-docs','leave-docs',false,10485760) on conflict (id) do nothing;
create or replace function public.bridge_try_uuid(p text) returns uuid language plpgsql immutable as $$
begin return p::uuid; exception when others then return null; end $$;
drop policy if exists leave_docs_read on storage.objects; drop policy if exists leave_docs_write on storage.objects;
create policy leave_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'leave-docs' and ((storage.foldername(name))[1] = auth.uid()::text or bridge_leave_perm('view', bridge_try_uuid((storage.foldername(name))[1]))));
create policy leave_docs_write on storage.objects for insert to authenticated
  with check (bucket_id = 'leave-docs' and ((storage.foldername(name))[1] = auth.uid()::text or bridge_leave_perm('applyFor', bridge_try_uuid((storage.foldername(name))[1]))));

-- ───────────────────────────── 8. REALTIME ─────────────────────────────
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='leave_requests') then
    alter publication supabase_realtime add table public.leave_requests; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='leave_ledger') then
    alter publication supabase_realtime add table public.leave_ledger; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='leave_types') then
    alter publication supabase_realtime add table public.leave_types; end if;
end $$;

-- ───────────────────────────── 9. ENTITLEMENT + ACCRUAL ENGINE (server side, mirrors 27-leaves.js) ─────────────────────
-- Annual entitlement in WORKING days for one person: band by working-days-per-week (26 for a 6-day week, 22 for a 5-day
-- week by BloomingBox policy), never below the statutory floor (30 calendar days → 30 × workdays/7) when the floor check
-- is on. Returns jsonb {entitlement, band, statutory, workdays, rate} so the ledger can snapshot what was used.
create or replace function public.bridge_leave_entitlement(p_user uuid, p_type text default 'annual') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare st jsonb; rules jsonb; ws jsonb; offn int; workdays int; band numeric; statutory numeric; ent numeric; floor_on boolean; stat_days numeric;
begin
  select value into st from workspace_settings where key='leave_settings';
  select r.rules into rules from leave_types r where r.key = p_type;
  select work_schedule into ws from profiles where id = p_user;
  offn := coalesce(jsonb_array_length(ws->'offDays'), 1);
  workdays := greatest(1, least(7, 7 - offn));
  band := coalesce((rules->'entitlement_by_week'->>(workdays::text))::numeric,
                   (rules->'entitlement_by_week'->>'6')::numeric, (rules->>'entitlement_days')::numeric, 0);
  floor_on := coalesce((st->>'statutory_floor_check')::boolean, true) and coalesce((rules->>'accrues')::boolean,false);
  stat_days := coalesce((rules->>'statutory_calendar_days')::numeric, (st->>'statutory_min_calendar_days')::numeric, 0);
  statutory := case when floor_on and stat_days > 0 then round(stat_days * workdays / 7.0, 4) else 0 end;
  ent := greatest(band, statutory);
  return jsonb_build_object('entitlement', ent, 'band', band, 'statutory', statutory, 'workdays', workdays, 'rate', round(ent/12.0, 4));
end $$;
grant execute on function public.bridge_leave_entitlement(uuid, text) to authenticated;

-- The tick: idempotent, safe to run every hour.
create or replace function public.bridge_leave_tick() returns void
language plpgsql security definer set search_path = public as $$
declare
  st jsonb; ns jsonb; tz text; today_local date; r record; t record; m date; last_done date; first_m date; accr_from date;
  ent jsonb; rate numeric; days_in int; svc_days int; unpaid_days int; qty numeric; prorate numeric; join_d date; accrue_unpaid boolean;
  lnk text; txt text; sla int; pend_days int; ids jsonb; i text; hop record; nm text; base_url text; anon text; pref jsonb; do_email boolean;
begin
  select value into st from workspace_settings where key='leave_settings';
  if st is null or coalesce((st->>'enabled')::boolean,false) = false then return; end if;
  select value into ns from workspace_settings where key='notification_settings';
  tz := coalesce(st->>'tz','Asia/Dubai');
  today_local := (now() at time zone tz)::date;
  accr_from := coalesce(nullif(st->>'accrual_from','')::date, date_trunc('year', today_local)::date);
  accrue_unpaid := coalesce((st->>'accrue_during_unpaid')::boolean, false);
  sla := coalesce((st->>'sla_days')::int, 3);
  base_url := coalesce(nullif(ns->>'app_url',''),'https://bridge-kartik.vercel.app');

  -- 1) MONTHLY ACCRUAL — one row per person × accruing type × completed month, from accrual_from (or joining) onwards.
  last_done := (date_trunc('month', today_local) - interval '1 day')::date;      -- last day of the previous month
  for t in select key, rules from leave_types where active and coalesce((rules->>'accrues')::boolean,false) loop
    for r in select p.id, p.joining_date, p.status, p.work_schedule from profiles p where p.status = 'Active'
              and coalesce(p.attendance_required, true) = true
              and coalesce(p.work_schedule->>'category','office') not in ('consultant')             -- consultants / contingent: attendance only (§17)
    loop
      join_d := r.joining_date;
      first_m := date_trunc('month', greatest(accr_from, coalesce(join_d, accr_from)))::date;
      ent := bridge_leave_entitlement(r.id, t.key);
      rate := (ent->>'rate')::numeric;
      if rate is null or rate <= 0 then continue; end if;
      m := first_m;
      while m <= date_trunc('month', last_done)::date loop
        if not exists (select 1 from leave_ledger l where l.user_id = r.id and l.type_key = t.key and l.entry_type='accrual' and l.period = to_char(m,'YYYY-MM')) then
          days_in := extract(day from (m + interval '1 month' - interval '1 day'))::int;
          svc_days := days_in;
          if join_d is not null and join_d > m and join_d <= (m + interval '1 month' - interval '1 day')::date then
            svc_days := ((m + interval '1 month' - interval '1 day')::date - join_d) + 1;             -- prorate joiners on calendar days
          end if;
          unpaid_days := 0;
          if not accrue_unpaid then
            select coalesce(sum(least(q.date_to,(m + interval '1 month' - interval '1 day')::date) - greatest(q.date_from,m) + 1),0) into unpaid_days
              from leave_requests q join leave_types lt on lt.key=q.type_key
             where q.user_id = r.id and q.status='Approved' and coalesce(lt.rules->>'paid','paid')='unpaid'
               and q.date_from <= (m + interval '1 month' - interval '1 day')::date and q.date_to >= m;
          end if;
          svc_days := greatest(0, svc_days - unpaid_days);
          prorate := round(svc_days::numeric / days_in, 4);
          qty := round(rate * prorate, 4);
          if qty > 0 then
            insert into leave_ledger (user_id, type_key, entry_type, quantity, effective_date, period, actor, reason, meta)
            values (r.id, t.key, 'accrual', qty, (m + interval '1 month' - interval '1 day')::date, to_char(m,'YYYY-MM'), null,
                    'Monthly accrual '||to_char(m,'Mon YYYY')||case when prorate<1 then ' (prorated '||svc_days||'/'||days_in||' days)' else '' end,
                    ent || jsonb_build_object('prorate', prorate, 'service_days', svc_days, 'days_in_month', days_in, 'unpaid_days', unpaid_days));
          end if;
        end if;
        m := (m + interval '1 month')::date;
      end loop;
    end loop;
  end loop;

  -- 2) TAKEN — post the debit once an approved leave has ended (balance consumed at Taken, §8.4)
  for r in select q.* from leave_requests q where q.status='Approved' and q.date_to < today_local
            and not exists (select 1 from leave_ledger l where l.request_id = q.id and l.entry_type='taken') loop
    insert into leave_ledger (user_id, type_key, entry_type, quantity, effective_date, request_id, actor, reason, meta)
    values (r.user_id, r.type_key, 'taken', -r.days, r.date_to, r.id, null,
            'Leave taken '||to_char(r.date_from,'DD Mon')||case when r.date_to<>r.date_from then ' – '||to_char(r.date_to,'DD Mon') else '' end,
            jsonb_build_object('half_day', r.half_day, 'day_list', r.day_list));
  end loop;

  -- 3) SLA — a request pending longer than sla_days working days nudges its current approvers + Head of People once.
  for r in select q.*, p.first_name, p.last_name from leave_requests q join profiles p on p.id=q.user_id
            where q.status='Pending' and q.created_at < now() - (sla * interval '1 day') loop
    lnk := 'leave:sla:'||r.id;
    if exists (select 1 from notifications n where n.link = lnk) then continue; end if;
    nm := trim(coalesce(r.first_name,'')||' '||coalesce(r.last_name,''));
    txt := chr(9203)||' '||nm||'''s leave request ('||to_char(r.date_from,'DD Mon')||') has been waiting '||(today_local - r.created_at::date)||' days — over the '||sla||'-day SLA.';
    ids := coalesce(r.flow->r.level->'ids','[]'::jsonb);
    for i in select jsonb_array_elements_text(ids) loop
      insert into notifications (id,user_id,text,read,created_at,link,kind,count,updated_at)
      values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), i, txt, false, now(), lnk, 'leave', 1, now());
    end loop;
    for hop in select id from profiles where status='Active' and hrm->>'roleProfileId' in ('head_of_people','superadmin') and not (ids ? id::text) loop
      insert into notifications (id,user_id,text,read,created_at,link,kind,count,updated_at)
      values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), hop.id::text, txt, false, now(), lnk, 'leave', 1, now());
    end loop;
  end loop;

  -- 4) "Starts tomorrow" reminder to the person and their manager (09:00–09:59 local)
  if (now() at time zone tz)::time >= time '09:00' and (now() at time zone tz)::time < time '10:00' then
    for r in select q.*, p.first_name, p.last_name, p.manager_id from leave_requests q join profiles p on p.id=q.user_id
              where q.status='Approved' and q.date_from = today_local + 1 loop
      lnk := 'leave:req:'||r.id;
      nm := trim(coalesce(r.first_name,'')||' '||coalesce(r.last_name,''));
      if not exists (select 1 from notifications n where n.user_id = r.user_id::text and n.link = lnk and n.created_at::date = today_local) then
        insert into notifications (id,user_id,text,read,created_at,link,kind,count,updated_at)
        values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), r.user_id::text, chr(127796)||' Your leave starts tomorrow ('||to_char(r.date_from,'DD Mon')||' – '||to_char(r.date_to,'DD Mon')||'). Enjoy!', false, now(), lnk, 'leave', 1, now());
        if r.manager_id is not null then
          insert into notifications (id,user_id,text,read,created_at,link,kind,count,updated_at)
          values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), r.manager_id::text, chr(128197)||' '||nm||' is on leave from tomorrow ('||to_char(r.date_from,'DD Mon')||' – '||to_char(r.date_to,'DD Mon')||').', false, now(), lnk, 'leave', 1, now());
        end if;
      end if;
    end loop;
  end if;

  -- 5) Carried-forward days expire (end of Q1 by default): forfeit whatever of the carry-forward credit is still unused.
  if to_char(today_local,'MM-DD') = coalesce(st->>'carried_expiry_mmdd','03-31') then
    for r in select l.user_id, l.type_key, l.quantity, l.id, l.effective_date from leave_ledger l
              where l.entry_type='carry_forward' and l.effective_date >= date_trunc('year', today_local)::date
                and not exists (select 1 from leave_ledger f where f.entry_type='forfeiture' and f.source_id = l.id) loop
      -- unused carried = carried − taken since 1 Jan (capped at carried)
      select greatest(0, r.quantity + coalesce((select sum(quantity) from leave_ledger x where x.user_id=r.user_id and x.type_key=r.type_key and x.entry_type='taken' and x.effective_date >= date_trunc('year', today_local)::date),0)) into qty;
      qty := least(qty, r.quantity);
      if qty > 0 then
        insert into leave_ledger (user_id, type_key, entry_type, quantity, effective_date, source_id, actor, reason, meta)
        values (r.user_id, r.type_key, 'forfeiture', -qty, today_local, r.id, null, 'Carried-forward days expired ('||to_char(today_local,'DD Mon YYYY')||')', jsonb_build_object('carried', r.quantity));
      end if;
    end loop;
  end if;
end $$;

create or replace function public.bridge_leave_tick_guarded() returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from workspace_settings where key='leave_settings' and coalesce((value->>'enabled')::boolean,false)) then perform bridge_leave_tick(); end if;
end $$;
grant execute on function public.bridge_leave_tick() to authenticated;   -- "Run accruals now" button (Administration → Leaves), RLS-safe: security definer

do $$ begin
  if not exists (select 1 from cron.job where jobname='bridge-leave-tick') then
    perform cron.schedule('bridge-leave-tick', '7 * * * *', 'select public.bridge_leave_tick_guarded();');
  end if;
end $$;

-- ───────────────────────────── 10. SEED — leave types (UAE Labour Law defaults; every value editable in the app) ────────
-- Only inserted when the table is empty so re-running never overwrites People's edits.
insert into public.leave_types (key, name, sort, active, color, icon, rules)
select * from (values
 ('annual','Annual leave',1,true,'#54433C','calendar', '{"paid":"paid","accrues":true,"unit":"working_days","entitlement_by_week":{"5":22,"6":26},"statutory_calendar_days":30,"year_basis":"leave_year","eligibility":{"min_service_months":0,"after_probation":false,"gender":null,"once_per_tenure":false,"instances_per_year":null},"half_day":true,"backdate_days":0,"future_only":true,"notice_tiers":[{"min_days":1,"notice_days":7},{"min_days":6,"notice_days":30}],"rm_override":true,"min_days":0.5,"max_days":null,"gap_days":0,"attachment_from_days":null,"comment_required":true,"count_rest_days":null,"during_notice_period":true,"carry_forward":true,"encashable":true,"advance_allowed":true,"approval":[{"approver":"manager"},{"approver":"hop","min_days":6,"or_advance":true}],"law":"Art. 29 — 30 calendar days after one year of service; 2 days per month between 6 and 12 months. Carry-over of up to half the leave with employer consent; unused leave paid at basic wage on exit."}'::jsonb),
 ('sick','Sick leave',2,true,'#A63528','alert', '{"paid":"banded","pay_bands":[{"days":15,"pay":100},{"days":30,"pay":50},{"days":45,"pay":0}],"accrues":false,"unit":"calendar_days","entitlement_days":90,"year_basis":"service_year","eligibility":{"min_service_months":0,"after_probation":true,"gender":null,"once_per_tenure":false,"instances_per_year":null},"half_day":false,"backdate_days":3,"future_only":false,"past_only":true,"notice_tiers":[],"rm_override":true,"min_days":1,"max_days":90,"gap_days":0,"attachment_from_days":2,"comment_required":true,"count_rest_days":true,"during_notice_period":true,"carry_forward":false,"encashable":false,"advance_allowed":false,"approval":[{"approver":"manager"}],"law":"Art. 31 — up to 90 days per year after probation: first 15 full pay, next 30 half pay, remaining 45 unpaid. Report within 3 working days; medical certificate required."}'::jsonb),
 ('maternity','Maternity leave',3,true,'#B7826F','user', '{"paid":"banded","pay_bands":[{"days":45,"pay":100},{"days":15,"pay":50}],"accrues":false,"unit":"calendar_days","entitlement_days":60,"extension_unpaid_days":45,"year_basis":"per_instance","eligibility":{"min_service_months":0,"after_probation":false,"gender":"Female","once_per_tenure":false,"instances_per_year":1},"half_day":false,"backdate_days":30,"future_only":false,"notice_tiers":[{"min_days":1,"notice_days":30}],"rm_override":true,"min_days":1,"max_days":105,"gap_days":0,"attachment_from_days":1,"comment_required":false,"count_rest_days":true,"during_notice_period":true,"carry_forward":false,"encashable":false,"advance_allowed":false,"approval":[{"approver":"manager"},{"approver":"hop"}],"law":"Art. 30 — 60 days: 45 at full pay + 15 at half pay; up to 45 more days unpaid for illness arising from pregnancy or delivery (certificate)."}'::jsonb),
 ('parental','Parental leave',4,true,'#936659','users', '{"paid":"paid","accrues":false,"unit":"working_days","entitlement_days":5,"year_basis":"per_instance","window_months_after_event":6,"eligibility":{"min_service_months":0,"after_probation":false,"gender":null,"once_per_tenure":false,"instances_per_year":null},"half_day":false,"backdate_days":14,"future_only":false,"notice_tiers":[],"rm_override":true,"min_days":1,"max_days":5,"gap_days":0,"attachment_from_days":null,"comment_required":true,"count_rest_days":false,"during_notice_period":true,"carry_forward":false,"encashable":false,"advance_allowed":false,"approval":[{"approver":"manager"}],"law":"Art. 32 — 5 working days paid, for either parent, within 6 months of the birth."}'::jsonb),
 ('bereavement','Bereavement leave',5,true,'#463830','doc', '{"paid":"paid","accrues":false,"unit":"calendar_days","entitlement_days":5,"year_basis":"per_instance","relation_days":{"Spouse":5,"Parent":3,"Child":3,"Sibling":3,"Grandchild":3,"Grandparent":3},"eligibility":{"min_service_months":0,"after_probation":false,"gender":null,"once_per_tenure":false,"instances_per_year":null},"half_day":false,"backdate_days":14,"future_only":false,"notice_tiers":[],"rm_override":true,"min_days":1,"max_days":5,"gap_days":0,"attachment_from_days":null,"comment_required":true,"count_rest_days":true,"during_notice_period":true,"carry_forward":false,"encashable":false,"advance_allowed":false,"approval":[{"approver":"manager"}],"law":"Art. 32 — 5 days for the death of a spouse; 3 days for a parent, child, sibling, grandchild or grandparent."}'::jsonb),
 ('study','Study leave',6,true,'#A97C33','doc', '{"paid":"paid","accrues":false,"unit":"working_days","entitlement_days":10,"year_basis":"leave_year","eligibility":{"min_service_months":24,"after_probation":true,"gender":null,"once_per_tenure":false,"instances_per_year":null},"half_day":false,"backdate_days":0,"future_only":true,"notice_tiers":[{"min_days":1,"notice_days":14}],"rm_override":true,"min_days":1,"max_days":10,"gap_days":0,"attachment_from_days":1,"comment_required":true,"count_rest_days":false,"during_notice_period":false,"carry_forward":false,"encashable":false,"advance_allowed":false,"approval":[{"approver":"manager"},{"approver":"hop"}],"law":"Art. 32 — 10 working days per year to sit exams, after 2 years of service, at an accredited UAE institution."}'::jsonb),
 ('hajj','Hajj leave',7,true,'#7F6533','globe', '{"paid":"unpaid","accrues":false,"unit":"calendar_days","entitlement_days":30,"year_basis":"per_instance","eligibility":{"min_service_months":12,"after_probation":true,"gender":null,"once_per_tenure":true,"instances_per_year":1},"half_day":false,"backdate_days":0,"future_only":true,"notice_tiers":[{"min_days":1,"notice_days":30}],"rm_override":true,"min_days":1,"max_days":30,"gap_days":0,"attachment_from_days":null,"comment_required":true,"count_rest_days":true,"during_notice_period":false,"carry_forward":false,"encashable":false,"advance_allowed":false,"approval":[{"approver":"manager"},{"approver":"hop"}],"law":"Company policy (not in Decree-Law 33/2021): up to 30 days unpaid, once during employment."}'::jsonb),
 ('unpaid','Unpaid leave',8,true,'#786A5F','clock', '{"paid":"unpaid","accrues":false,"unit":"calendar_days","entitlement_days":null,"year_basis":"leave_year","eligibility":{"min_service_months":0,"after_probation":false,"gender":null,"once_per_tenure":false,"instances_per_year":null},"half_day":false,"backdate_days":0,"future_only":true,"notice_tiers":[{"min_days":1,"notice_days":7}],"rm_override":true,"min_days":1,"max_days":null,"gap_days":0,"attachment_from_days":null,"comment_required":true,"count_rest_days":true,"during_notice_period":false,"carry_forward":false,"encashable":false,"advance_allowed":false,"requires_annual_exhausted":false,"approval":[{"approver":"manager"},{"approver":"hop"}],"law":"Art. 33 — unpaid leave by agreement; the days are not counted as service for annual-leave accrual (switch under Accrual)."}'::jsonb),
 ('comp_off','Compensatory off',9,true,'#4E4038','flag', '{"paid":"paid","accrues":false,"source":"attendance_comp_off","unit":"working_days","entitlement_days":null,"year_basis":"leave_year","expiry_days":60,"eligibility":{"min_service_months":0,"after_probation":false,"gender":null,"once_per_tenure":false,"instances_per_year":null},"half_day":true,"backdate_days":0,"future_only":true,"notice_tiers":[{"min_days":1,"notice_days":2}],"rm_override":true,"min_days":0.5,"max_days":null,"gap_days":0,"attachment_from_days":null,"comment_required":false,"count_rest_days":false,"during_notice_period":true,"carry_forward":false,"encashable":false,"advance_allowed":false,"approval":[{"approver":"manager"}],"law":"Earned by approved rest-day / public-holiday work (Attendance → Comp off); expires after the window set under Administration → Attendance."}'::jsonb),
 ('national_service','National service',10,false,'#13171B','shield', '{"paid":"paid","accrues":false,"unit":"calendar_days","entitlement_days":null,"year_basis":"per_instance","eligibility":{"min_service_months":0,"after_probation":false,"gender":null,"once_per_tenure":false,"instances_per_year":null},"half_day":false,"backdate_days":0,"future_only":true,"notice_tiers":[],"rm_override":true,"min_days":1,"max_days":null,"gap_days":0,"attachment_from_days":1,"comment_required":true,"count_rest_days":true,"during_notice_period":true,"carry_forward":false,"encashable":false,"advance_allowed":false,"approval":[{"approver":"hop"}],"law":"Federal Law 6/2014 — UAE nationals called for national service keep their job and pay (placeholder — Legal to confirm terms)."}'::jsonb),
 ('sabbatical','Sabbatical',11,false,'#B2A496','calendar', '{"paid":"unpaid","accrues":false,"unit":"calendar_days","entitlement_days":null,"year_basis":"per_instance","eligibility":{"min_service_months":36,"after_probation":true,"gender":null,"once_per_tenure":false,"instances_per_year":1},"half_day":false,"backdate_days":0,"future_only":true,"notice_tiers":[{"min_days":1,"notice_days":60}],"rm_override":false,"min_days":30,"max_days":180,"gap_days":0,"attachment_from_days":null,"comment_required":true,"count_rest_days":true,"during_notice_period":false,"carry_forward":false,"encashable":false,"advance_allowed":false,"approval":[{"approver":"manager"},{"approver":"hop"}],"law":"Company policy placeholder — switch on when approved."}'::jsonb)
) as v(key,name,sort,active,color,icon,rules)
where not exists (select 1 from public.leave_types);
