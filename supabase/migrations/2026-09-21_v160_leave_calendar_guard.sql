-- ═══ Bridge v160 — company leave calendar (everyone) · strict approval guard · leave_settings write guard ═══
-- Applied to the live project on 2026-09-21 via the Supabase MCP. Additive only.

-- 1) Anyone signed in can see WHO is off, WHEN, and WHAT TYPE — never the reason, attachment or balance.
create or replace function public.bridge_leave_calendar(p_from date, p_to date)
returns table(id text, user_id uuid, type_key text, date_from date, date_to date, half_day text, days numeric, day_list jsonb, status text)
language sql stable security definer set search_path = public as $$
  select q.id, q.user_id, q.type_key, q.date_from, q.date_to, q.half_day, q.days, q.day_list, q.status
    from leave_requests q
   where auth.uid() is not null and q.status = 'Approved' and q.date_to >= p_from and q.date_from <= p_to;
$$;
grant execute on function public.bridge_leave_calendar(date, date) to authenticated;

-- 2) Approvers may only move a request along its own flow (next level / Approved at the final level / Rejected);
--    the request itself (person, type, dates, days, reason, attachment, flow) is immutable to them. People with
--    Adjust keep the audited correction path.
create or replace function public.bridge_lr_guard_own() returns trigger
language plpgsql security definer set search_path = public as $$
declare final_level int; can_adjust boolean;
begin
  if auth.uid() is null then return new; end if;
  if new.user_id <> old.user_id or new.type_key <> old.type_key then raise exception 'leave: type and person cannot change'; end if;
  can_adjust := bridge_leave_perm('adjust', old.user_id);
  if old.user_id = auth.uid() and not can_adjust then
    if old.status = 'Pending' and new.status not in ('Pending','Withdrawn') then raise exception 'leave: you can only withdraw your own request'; end if;
    if old.status = 'Approved' and not (new.status = 'Cancelled' and old.date_from > current_date) then raise exception 'leave: approved leave can only be cancelled before it starts — ask People'; end if;
    if old.status in ('Rejected','Cancelled','Withdrawn') then raise exception 'leave: this request is closed'; end if;
    if new.decided_by is distinct from old.decided_by or new.approvals is distinct from old.approvals or new.level is distinct from old.level
       or new.date_from is distinct from old.date_from or new.date_to is distinct from old.date_to or new.days is distinct from old.days
       or new.flow is distinct from old.flow or new.applied_by is distinct from old.applied_by then
      raise exception 'leave: you cannot change a submitted request — withdraw it and apply again';
    end if;
  elsif old.user_id <> auth.uid() and not can_adjust then
    if new.date_from is distinct from old.date_from or new.date_to is distinct from old.date_to or new.reason is distinct from old.reason
       or new.attachment_url is distinct from old.attachment_url or new.flow is distinct from old.flow or new.applied_by is distinct from old.applied_by
       or new.half_day is distinct from old.half_day or new.created_by is distinct from old.created_by
       or new.days is distinct from old.days or new.day_list is distinct from old.day_list then
      raise exception 'leave: approvers cannot edit the request itself';
    end if;
    if old.status <> 'Pending' then raise exception 'leave: this request is already %', lower(old.status); end if;
    if new.status not in ('Pending','Approved','Rejected') then raise exception 'leave: approvers can only approve or reject'; end if;
    final_level := greatest(0, jsonb_array_length(coalesce(old.flow,'[]'::jsonb)) - 1);
    if jsonb_array_length(old.flow) > 0 and not (old.flow -> old.level -> 'ids' ? auth.uid()::text) and not bridge_leave_perm('approve', old.user_id) then
      raise exception 'leave: this request is not waiting for you';
    end if;
    if new.status = 'Pending' and new.level <> old.level + 1 then raise exception 'leave: approvals must follow the flow one level at a time'; end if;
    if new.status = 'Approved' and old.level < final_level then raise exception 'leave: another approval level is still required'; end if;
    if new.status in ('Approved','Rejected') and (new.decided_by is distinct from auth.uid()) then raise exception 'leave: decided_by must be you'; end if;
    if jsonb_array_length(coalesce(new.approvals,'[]'::jsonb)) <> jsonb_array_length(coalesce(old.approvals,'[]'::jsonb)) + 1 then raise exception 'leave: one approval record per decision'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists leave_requests_guard_own on public.leave_requests;
create trigger leave_requests_guard_own before update on public.leave_requests for each row execute function public.bridge_lr_guard_own();

-- 3) leave_settings may only be written by leave managers (other workspace_settings keys unchanged)
create or replace function public.bridge_ws_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if coalesce(new.key, old.key) = 'leave_settings' and not bridge_leave_perm('manage', auth.uid()) then
    raise exception 'leave settings: you need Leaves → Manage';
  end if;
  return new;
end $$;
drop trigger if exists workspace_settings_leave_guard on public.workspace_settings;
create trigger workspace_settings_leave_guard before insert or update on public.workspace_settings for each row execute function public.bridge_ws_guard();
