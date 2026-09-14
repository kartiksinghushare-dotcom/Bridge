-- ═══ Bridge v133 — data-layer permissions for the attendance tables (HRMS spec §7.3, §15.1, §15.3) ═══
-- Applied to the live project on 2026-09-14. Until now every Bridge table allowed any signed-in user to read and write
-- everything and the browser alone enforced Access Control. The four attendance tables now enforce the SAME rules in
-- Postgres, via bridge_att_perm(action, target) which mirrors can()/scopeFilter() in 19-okr-roles-acl.js:
--   · per-user override (profiles.hrm.perms.attendance) beats the role (workspace_settings.role_profiles[roleProfileId])
--   · built-in roles not yet synced to the server fall back to the app's presets
--   · people with no role assigned follow the legacy rules (_baseCan / _baseScope)
--   · 'approve' is implied by 'edit'; 'manage' is unscoped; view/clock on your own row is always allowed;
--     edit/delete/approve are never allowed on your own row.
-- Other tables are untouched. The cron job (security definer, owned by postgres) is not affected by RLS.

create or replace function public.bridge_att_subtree(p_root uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  with recursive t(id, depth) as (
    select p.id, 1 from profiles p where p.manager_id = p_root and p.id <> p_root
    union all
    select p.id, t.depth + 1 from profiles p join t on p.manager_id = t.id where p.id <> p_root and t.depth < 12
  ) select id from t;
$$;

create or replace function public.bridge_att_perm(p_action text, p_target uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid(); mp record; area jsonb; rid text; sc text; ok boolean := false; is_mgr boolean; is_hr boolean;
  full_perm constant jsonb := '{"scope":"everyone","actions":{"view":true,"clock":true,"approve":true,"schedule":true,"edit":true,"delete":true,"export":true,"manage":true}}';
begin
  if me is null or p_target is null then return false; end if;
  select id, role, hrm, status into mp from profiles where id = me;
  if mp.id is null or coalesce(mp.status,'Active') <> 'Active' then return false; end if;
  rid  := mp.hrm->>'roleProfileId';
  area := mp.hrm->'perms'->'attendance';
  if area is null and rid is not null then
    select value->rid->'perms'->'attendance' into area from workspace_settings where key = 'role_profiles';
    if area is null then
      area := case rid
        when 'superadmin' then full_perm
        when 'admin'      then full_perm
        when 'hr'         then full_perm
        when 'manager'    then '{"scope":"team","actions":{"view":true,"clock":true,"approve":true,"schedule":true,"export":true}}'::jsonb
        when 'basic'      then '{"scope":"self","actions":{"view":true,"clock":true}}'::jsonb
        else null end;
    end if;
  end if;
  if area is not null then
    ok := coalesce((area->'actions'->>p_action)::boolean, false);
    if not ok and p_action = 'approve' then ok := coalesce((area->'actions'->>'edit')::boolean, false); end if;
    if not ok then return false; end if;
    sc := coalesce(area->>'scope', 'none');
  else
    -- legacy: no role assigned
    if mp.role in ('Admin','SubAdmin') then return true; end if;
    is_hr  := coalesce((mp.hrm->>'isHR')::boolean, false);
    is_mgr := exists (select 1 from profiles x where x.manager_id = me and x.id <> me);
    ok := case
      when p_action in ('view','clock') then true
      when p_action in ('approve','schedule') then is_hr or is_mgr
      when p_action in ('edit','delete') then is_hr
      else false end;
    if not ok then return false; end if;
    sc := case when is_hr then 'everyone' when is_mgr then 'team' else 'self' end;
  end if;
  if p_action = 'manage' then return true; end if;
  if p_target = me then return p_action in ('view','clock','export'); end if;
  return case sc
    when 'everyone'   then true
    when 'team'       then p_target in (select bridge_att_subtree(me))
    when 'department' then exists (select 1 from profiles a, profiles b where a.id = me and b.id = p_target and a.department is not null and a.department = b.department)
    when 'location'   then exists (select 1 from profiles a, profiles b where a.id = me and b.id = p_target and a.location_id is not null and a.location_id = b.location_id)
    else false end;
end $$;
grant execute on function public.bridge_att_perm(text, uuid) to authenticated;
grant execute on function public.bridge_att_subtree(uuid) to authenticated;

-- ── attendance ──
drop policy if exists attendance_auth_all on public.attendance;
drop policy if exists att_select on public.attendance;
drop policy if exists att_insert on public.attendance;
drop policy if exists att_update on public.attendance;
drop policy if exists att_delete on public.attendance;
create policy att_select on public.attendance for select to authenticated
  using (user_id = auth.uid() or bridge_att_perm('view', user_id));
create policy att_insert on public.attendance for insert to authenticated
  with check (
    (user_id = auth.uid() and edited_by is null and coalesce(source,'web') <> 'manual' and bridge_att_perm('clock', user_id))
    or bridge_att_perm('edit', user_id)
    or (bridge_att_perm('approve', user_id) and source = 'regularised'));
create policy att_update on public.attendance for update to authenticated
  using (user_id = auth.uid() or bridge_att_perm('edit', user_id) or bridge_att_perm('approve', user_id))
  with check (user_id = auth.uid() or bridge_att_perm('edit', user_id) or bridge_att_perm('approve', user_id));
create policy att_delete on public.attendance for delete to authenticated
  using (user_id <> auth.uid() and bridge_att_perm('delete', user_id));

-- An employee may only CLOSE their own open session (or mark it synced). Every other change to their own row —
-- moving the clock-in, reopening, editing history, changing the date/mode — is refused unless they hold Edit.
create or replace function public.bridge_att_guard_own() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;                           -- server jobs
  if new.user_id <> old.user_id then raise exception 'attendance: cannot move a session to another person'; end if;
  if old.user_id = auth.uid() and not bridge_att_perm('edit', old.user_id) then
    if old.clock_out_at is not null then raise exception 'attendance: this session is already closed — ask your manager to correct it'; end if;
    if new.clock_in_at is distinct from old.clock_in_at or new.date is distinct from old.date or new.mode is distinct from old.mode
       or new.history is distinct from old.history or new.edited_by is distinct from old.edited_by or new.edit_reason is distinct from old.edit_reason
       or new.in_location_id is distinct from old.in_location_id or new.in_lat is distinct from old.in_lat or new.in_lng is distinct from old.in_lng
       or new.auto_out is distinct from old.auto_out or new.source is distinct from old.source then
      raise exception 'attendance: you can only clock out of your own session — ask your manager to correct it';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists attendance_guard_own on public.attendance;
create trigger attendance_guard_own before update on public.attendance for each row execute function public.bridge_att_guard_own();

-- ── attendance_requests ──
drop policy if exists attendance_requests_auth_all on public.attendance_requests;
drop policy if exists areq_select on public.attendance_requests;
drop policy if exists areq_insert on public.attendance_requests;
drop policy if exists areq_update on public.attendance_requests;
drop policy if exists areq_delete on public.attendance_requests;
create policy areq_select on public.attendance_requests for select to authenticated
  using (user_id = auth.uid() or bridge_att_perm('view', user_id));
create policy areq_insert on public.attendance_requests for insert to authenticated
  with check (user_id = auth.uid() and created_by = auth.uid() and status = 'Pending' and decided_by is null
              and type in ('regularisation','partial_day','on_duty','comp_off') and bridge_att_perm('clock', user_id));
create policy areq_update on public.attendance_requests for update to authenticated
  using (user_id = auth.uid() or bridge_att_perm('approve', user_id))
  with check (user_id = auth.uid() or bridge_att_perm('approve', user_id));
create policy areq_delete on public.attendance_requests for delete to authenticated
  using (user_id <> auth.uid() and bridge_att_perm('delete', user_id));

-- The requester may only withdraw (Pending → Cancelled) or update the comp-off minutes; never decide.
create or replace function public.bridge_areq_guard_own() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.user_id <> old.user_id or new.type <> old.type then raise exception 'attendance request: type and person cannot change'; end if;
  if old.user_id = auth.uid() and not bridge_att_perm('approve', old.user_id) then
    if old.status <> 'Pending' then raise exception 'attendance request: already decided'; end if;
    if new.status not in ('Pending','Cancelled') or new.decided_by is not null or new.decided_at is not null
       or new.date is distinct from old.date or new.date_to is distinct from old.date_to then
      raise exception 'attendance request: you can only withdraw your own request';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists attendance_requests_guard_own on public.attendance_requests;
create trigger attendance_requests_guard_own before update on public.attendance_requests for each row execute function public.bridge_areq_guard_own();

-- one live comp-off request per person per day (the client dedupes too; this closes the race on a fresh load)
create unique index if not exists attendance_requests_compoff_uniq on public.attendance_requests(user_id, date) where type = 'comp_off' and status <> 'Cancelled';

-- ── wfh_days ──
drop policy if exists wfh_days_auth_all on public.wfh_days;
drop policy if exists wfh_select on public.wfh_days;
drop policy if exists wfh_write on public.wfh_days;
drop policy if exists wfh_delete on public.wfh_days;
create policy wfh_select on public.wfh_days for select to authenticated using (user_id = auth.uid() or bridge_att_perm('view', user_id));
create policy wfh_write  on public.wfh_days for insert to authenticated with check (user_id = auth.uid() or bridge_att_perm('edit', user_id));
create policy wfh_delete on public.wfh_days for delete to authenticated using (user_id = auth.uid() or bridge_att_perm('edit', user_id));
drop policy if exists wfh_update on public.wfh_days;
create policy wfh_update on public.wfh_days for update to authenticated using (user_id = auth.uid() or bridge_att_perm('edit', user_id)) with check (user_id = auth.uid() or bridge_att_perm('edit', user_id));

-- ── public_holidays ──
drop policy if exists public_holidays_auth_all on public.public_holidays;
drop policy if exists ph_select on public.public_holidays;
drop policy if exists ph_write on public.public_holidays;
create policy ph_select on public.public_holidays for select to authenticated using (true);
create policy ph_write  on public.public_holidays for all to authenticated using (bridge_att_perm('manage', auth.uid())) with check (bridge_att_perm('manage', auth.uid()));
