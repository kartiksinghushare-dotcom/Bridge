-- ═══ Bridge v137 — Workspace chat, WhatsApp parity: voice notes, files, quoted replies, forward, pin, star, mute ═══
-- Additive only. Applied to the live project on 2026-09-15. Nothing is deleted or rewritten.

-- ── crm_messages: new columns ──
alter table public.crm_messages
  add column if not exists reply_to     text,          -- quoted message id (same conversation)
  add column if not exists forwarded    boolean default false,
  add column if not exists attachments  jsonb  default '[]'::jsonb,   -- [{kind:'audio'|'file'|'video', path, name, size, type, dur}]
  add column if not exists sticker      text,          -- sticker id (rendered large, no bubble)
  add column if not exists link_preview jsonb,         -- {url,title,description,image,site}
  add column if not exists pinned_at    timestamptz,
  add column if not exists pinned_by    uuid;
create index if not exists crm_messages_pinned_idx on public.crm_messages(conversation_id) where pinned_at is not null;

-- the "lite" view (loaded on open, without photo blobs) carries the new columns too
create or replace view public.crm_messages_lite as
 select id, conversation_id, sender_id, from_customer, name, body, created_at, reactions, parent_id, edited_at,
        coalesce(jsonb_array_length(images),0) as image_count, deleted_at, deleted_by,
        reply_to, forwarded, attachments, sticker, link_preview, pinned_at, pinned_by
   from public.crm_messages;

-- ── starred messages (per person) ──
create table if not exists public.crm_stars (
  user_id uuid not null, message_id text not null, conversation_id text not null, created_at timestamptz default now(),
  primary key (user_id, message_id));
alter table public.crm_stars enable row level security;
drop policy if exists crm_stars_own on public.crm_stars;
create policy crm_stars_own on public.crm_stars for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── per-person chat preferences: mute / archive / pin-to-top ──
create table if not exists public.crm_convo_prefs (
  user_id uuid not null, conversation_id text not null,
  muted_until timestamptz, archived boolean default false, pinned boolean default false, updated_at timestamptz default now(),
  primary key (user_id, conversation_id));
alter table public.crm_convo_prefs enable row level security;
drop policy if exists crm_convo_prefs_own on public.crm_convo_prefs;
create policy crm_convo_prefs_own on public.crm_convo_prefs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── last seen (header "last seen today at 14:05") ──
alter table public.profiles add column if not exists last_seen_at timestamptz;

-- ── storage: private bucket for voice notes and files, signed links only ──
insert into storage.buckets (id, name, public, file_size_limit)
  values ('chat-media','chat-media', false, 52428800) on conflict (id) do nothing;
drop policy if exists chat_media_auth_all on storage.objects;
create policy chat_media_auth_all on storage.objects for all to authenticated
  using (bucket_id = 'chat-media') with check (bucket_id = 'chat-media');

-- ── helper: what a message "is" when it has no text (used by both fan-out triggers) ──
create or replace function public.crm_msg_preview(p_body text, p_images jsonb, p_att jsonb, p_sticker text) returns text
language plpgsql immutable as $$
declare prev text; a jsonb;
begin
  prev := left(trim(regexp_replace(coalesce(p_body,''), '\s+', ' ', 'g')), 90);
  if prev <> '' then return prev; end if;
  if p_sticker is not null and p_sticker <> '' then return chr(127775)||' Sticker'; end if;
  if coalesce(jsonb_array_length(p_att),0) > 0 then
    a := p_att->0;
    if a->>'kind' = 'audio' then return chr(127908)||' Voice note'; end if;
    if a->>'kind' = 'video' then return chr(127909)||' Video'; end if;
    return chr(128206)||' '||coalesce(a->>'name','File');
  end if;
  if coalesce(jsonb_array_length(p_images),0) > 0 then return chr(128247)||' Photo'; end if;
  return '';
end $$;

-- muted chats: no "new message" notification (a direct @tag still gets through, like WhatsApp)
create or replace function public.crm_is_muted(p_uid text, p_cid text) returns boolean
language sql stable as $$
  select exists (select 1 from public.crm_convo_prefs where user_id::text = p_uid and conversation_id = p_cid and muted_until is not null and muted_until > now());
$$;

CREATE OR REPLACE FUNCTION public.notif_fan_out_message()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  conv record; v_hub text; sender text; tagged_u text[]; sname text; title text; prev text; lowbody text;
  recips text[]; tagged text[] := '{}'; aud text[]; uid text; fn text; g jsonb; token text; gm text[];
  ns jsonb; mention_on boolean; msg_on boolean; is_reply boolean; lnk text; existing record; n int;
begin
  if new.from_customer or new.sender_id is null or new.deleted_at is not null then return null; end if;
  select c.id, c.board_id, c.title, c.customer into conv from crm_conversations c where c.id = new.conversation_id;
  if not found then return null; end if;
  select b.hub_id into v_hub from crm_boards b where b.id = conv.board_id;
  sender := new.sender_id::text;
  title := coalesce(nullif(conv.title,''), nullif(conv.customer,''), 'a conversation');
  lnk := 'crm:'||conv.id;
  is_reply := new.parent_id is not null;

  select coalesce(array_agg(distinct m.uid), '{}') into recips
    from (select user_id::text as uid from crm_board_members where board_id = conv.board_id
          union select user_id::text from crm_hub_members where hub_id = v_hub) m
    join profiles p on p.id::text = m.uid
   where p.status = 'Active' and m.uid <> sender;
  if coalesce(array_length(recips,1),0) = 0 then return null; end if;

  select trim(coalesce(first_name,'')||' '||coalesce(last_name,'')) into sname from profiles where id = new.sender_id;
  if coalesce(sname,'') = '' then sname := 'Someone'; end if;
  lowbody := ' '||lower(coalesce(new.body,''))||' ';
  prev := crm_msg_preview(new.body, new.images, new.attachments, new.sticker);

  if lowbody ~ '@(all|everyone)\M' then
    tagged := recips;
  else
    foreach uid in array recips loop
      select lower(regexp_replace(split_part(coalesce(first_name,''),' ',1), '[^a-zA-Z0-9_]', '', 'g')) into fn from profiles where id::text = uid;
      if fn <> '' and lowbody ~ ('@'||fn||'\M') then tagged := array_append(tagged, uid); end if;
    end loop;
    for g in select jsonb_array_elements(coalesce(value->'groups','[]'::jsonb)) from workspace_settings where key = 'crm_settings' loop
      token := lower(regexp_replace(coalesce(g->>'name',''), '[^a-zA-Z0-9_]', '', 'g'));
      if token <> '' and lowbody ~ ('@'||token||'\M') then
        select coalesce(array_agg(x), '{}') into gm from jsonb_array_elements_text(coalesce(g->'members','[]'::jsonb)) x where x = any(recips);
        tagged := tagged || gm;
      end if;
    end loop;
  end if;
  -- a quoted reply tags the person being replied to
  if new.reply_to is not null then
    select sender_id::text into uid from crm_messages where id = new.reply_to;
    if uid is not null and uid <> sender and uid = any(recips) and not (uid = any(tagged)) then tagged := array_append(tagged, uid); end if;
  end if;

  if is_reply then
    select coalesce(array_agg(distinct sender_id::text), '{}') into aud from crm_messages
     where (id = new.parent_id or parent_id = new.parent_id) and sender_id is not null
       and sender_id::text <> sender and sender_id::text = any(recips);
  else
    aud := recips;
  end if;

  select value into ns from workspace_settings where key = 'notification_settings';
  mention_on := coalesce((ns->>'inapp_crm_mention')::boolean, true);
  msg_on     := coalesce((ns->>'inapp_crm_message')::boolean, true);

  if mention_on then
    select coalesce(array_agg(distinct t), '{}') into tagged_u from unnest(tagged) t;
    foreach uid in array tagged_u loop
      if exists (select 1 from notifications where user_id = uid and link = lnk and created_at > now() - interval '3 seconds') then continue; end if;
      insert into notifications (id, user_id, text, read, created_at, link, kind, conversation_id, actor_id, count, updated_at)
      values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), uid,
              chr(128172)||' '||sname||' tagged you in '||chr(8220)||title||chr(8221), false, now(), lnk, 'mention', conv.id, sender, 1, now());
    end loop;
  end if;

  if msg_on then
    foreach uid in array aud loop
      if uid = any(tagged) then continue; end if;
      if crm_is_muted(uid, conv.id) then continue; end if;
      select x.id, x.count into existing from notifications x
       where x.user_id = uid and x.conversation_id = conv.id and x.kind = 'chat' and x.read = false
         and x.updated_at > now() - interval '2 minutes'
       order by x.updated_at desc limit 1;
      if found then
        n := existing.count + 1;
        update notifications
           set count = n, updated_at = now(), actor_id = sender,
               text = chr(128172)||' '||n||' new messages in '||chr(8220)||title||chr(8221)||' '||chr(183)||' '||sname||': '||prev
         where id = existing.id;
      else
        if exists (select 1 from notifications where user_id = uid and link = lnk and created_at > now() - interval '3 seconds') then continue; end if;
        insert into notifications (id, user_id, text, read, created_at, link, kind, conversation_id, actor_id, count, updated_at)
        values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), uid,
                chr(128172)||' '||sname||case when is_reply then ' replied' else '' end||' in '||chr(8220)||title||chr(8221)||case when prev <> '' then ': '||prev else '' end,
                false, now(), lnk, 'chat', conv.id, sender, 1, now());
      end if;
    end loop;
  end if;
  return null;
exception when others then
  raise warning 'notif_fan_out_message: %', sqlerrm;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.notif_fan_out_dm()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare conv record; sender text; peer text; sname text; prev text; lnk text; existing record; n int; ns jsonb; dm_on boolean; pref jsonb;
begin
  if new.from_customer or new.sender_id is null or new.deleted_at is not null then return null; end if;
  select c.id, c.kind, c.dm_members into conv from crm_conversations c where c.id = new.conversation_id;
  if not found or coalesce(conv.kind,'chat') <> 'dm' then return null; end if;
  sender := new.sender_id::text;
  select value into ns from workspace_settings where key='notification_settings';
  dm_on := coalesce((ns->>'inapp_dm_message')::boolean, true);
  if not dm_on then return null; end if;
  select trim(coalesce(first_name,'')||' '||coalesce(last_name,'')) into sname from profiles where id = new.sender_id;
  if coalesce(sname,'') = '' then sname := 'Someone'; end if;
  prev := crm_msg_preview(new.body, new.images, new.attachments, new.sticker);
  lnk := 'crm:'||conv.id;
  foreach peer in array coalesce(conv.dm_members,'{}') loop
    if peer = sender then continue; end if;
    if not exists (select 1 from profiles p where p.id::text = peer and p.status = 'Active') then continue; end if;
    if crm_is_muted(peer, conv.id) then continue; end if;
    select x.id, x.count into existing from notifications x
     where x.user_id = peer and x.conversation_id = conv.id and x.kind = 'dm' and x.read = false
       and x.updated_at > now() - interval '2 minutes'
     order by x.updated_at desc limit 1;
    if found then
      n := existing.count + 1;
      update notifications set count = n, updated_at = now(), actor_id = sender,
        text = chr(128172)||' '||n||' new messages from '||sname||': '||prev
      where id = existing.id;
    else
      insert into notifications (id, user_id, text, read, created_at, link, kind, conversation_id, actor_id, count, updated_at)
      values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), peer,
              chr(128172)||' '||sname||case when prev <> '' then ': '||prev else ' sent you a message' end,
              false, now(), lnk, 'dm', conv.id, sender, 1, now());
    end if;
  end loop;
  return null;
exception when others then
  raise warning 'notif_fan_out_dm: %', sqlerrm; return null;
end $function$;

-- ── profiles.last_seen_at follows the presence heartbeat (user_presence is readable only by its owner) ──
create or replace function public.bridge_presence_to_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles set last_seen_at = greatest(coalesce(last_seen_at,'epoch'::timestamptz), coalesce(new.last_seen, now()))
   where id::text = new.user_id and (last_seen_at is null or last_seen_at < now() - interval '45 seconds');
  return new;
end $$;
drop trigger if exists user_presence_last_seen on public.user_presence;
create trigger user_presence_last_seen after insert or update on public.user_presence for each row execute function public.bridge_presence_to_profile();
