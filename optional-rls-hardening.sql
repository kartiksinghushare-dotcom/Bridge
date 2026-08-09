-- ══════════════════════════════════════════════════════════════════════════════
-- OPTIONAL — defence in depth. NOT applied; review before running.
--
-- Today crm_messages / crm_conversations use `for all to authenticated using (true)`,
-- so membership is enforced by the APP only. Someone who knows the API URL + the
-- public anon key and is signed in could still read another channel's messages.
-- v75 fixes what the UI shows; this makes the DATABASE enforce the same rule.
--
-- Test on a Supabase branch first if you can. If anything goes wrong, the rollback
-- at the bottom restores the current behaviour instantly.
-- ══════════════════════════════════════════════════════════════════════════════

-- Who bypasses membership (matches the app's admin role profiles).
create or replace function public.crm_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and p.status = 'Active'
       and ( coalesce(p.hrm->>'roleProfileId','') in ('superadmin','admin')
             or (p.hrm->>'roleProfileId' is null and p.role in ('Admin','SubAdmin')) )
  );
$$;

-- Can the current user see this board? (channel member OR board member OR admin)
create or replace function public.crm_can_see_board(b_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.crm_is_admin()
      or exists (select 1 from public.crm_board_members m
                  where m.board_id = b_id and m.user_id = auth.uid())
      or exists (select 1 from public.crm_boards b
                  join public.crm_hub_members hm on hm.hub_id = b.hub_id
                 where b.id = b_id and hm.user_id = auth.uid());
$$;

grant execute on function public.crm_is_admin(), public.crm_can_see_board(text) to authenticated;

-- Swap the permissive policies for membership-aware ones.
drop policy if exists crm_conversations_all on public.crm_conversations;
create policy crm_conversations_member on public.crm_conversations
  for all to authenticated
  using (public.crm_can_see_board(board_id))
  with check (public.crm_can_see_board(board_id));

drop policy if exists crm_messages_all on public.crm_messages;
create policy crm_messages_member on public.crm_messages
  for all to authenticated
  using (exists (select 1 from public.crm_conversations c
                  where c.id = conversation_id and public.crm_can_see_board(c.board_id)))
  with check (exists (select 1 from public.crm_conversations c
                       where c.id = conversation_id and public.crm_can_see_board(c.board_id)));

-- ── ROLLBACK (restores exactly what you have today) ───────────────────────────
-- drop policy if exists crm_conversations_member on public.crm_conversations;
-- drop policy if exists crm_messages_member     on public.crm_messages;
-- create policy crm_conversations_all on public.crm_conversations for all to authenticated using (true) with check (true);
-- create policy crm_messages_all      on public.crm_messages      for all to authenticated using (true) with check (true);
