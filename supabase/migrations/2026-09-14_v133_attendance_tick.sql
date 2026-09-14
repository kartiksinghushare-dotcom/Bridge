-- ═══ Bridge v133 — bridge_attendance_tick() rewrite (HRMS Phase 1 §9.2, §9.6, §11) ═══
-- Runs every 5 min via pg_cron 'bridge-attendance-tick' → bridge_attendance_tick_guarded() (only when attendance is enabled).
-- Changes vs v132:
--   · Auto clock-out ONLY when attendance_settings.open_shift_mode = 'auto_out'. Default 'flag': a forgotten clock-out
--     stays open; the person and their manager are told (next morning) and the manager closes it in the app.
--   · Missed clock-in also goes to the manager, same day, after missed_in_rm_after_min.
--   · Public holidays (public_holidays) and rest days are skipped everywhere; work_schedule.effectiveFrom is honoured.
--   · "Still clocked in" second nudge after clockout_reminder_hours on the clock.
--   · Open shifts older than log_buffer_days are escalated once more to the manager and the manager's manager.
--   · Every email goes through send-notification exactly as before; in-app rows carry kind 'attendance'.
create or replace function public.bridge_attendance_tick()
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  st jsonb; tz text; auto_t time; now_local timestamp; today_local date; r record; cut timestamptz;
  ns jsonb; email_evt boolean; base_url text; anon text; mode text;
  in_on boolean; in_after int; rm_after int; out_on boolean; out_after int; out_hours int; buf_days int;
  sched jsonb; t_in time; t_out time; offdays jsonb; dow text; lnk text; txt text; nid text; pref jsonb; do_email boolean;
  mgr record; mgr2 record; is_hol boolean; loc text; onduty boolean; end_ts timestamp;
begin
  select value into st from workspace_settings where key='attendance_settings';
  tz := coalesce(st->>'tz','Asia/Dubai');
  mode := coalesce(nullif(st->>'open_shift_mode',''),'flag');
  auto_t := coalesce(nullif(st->>'auto_out_time',''),'23:59')::time;
  now_local := (now() at time zone tz);
  today_local := now_local::date;
  dow := to_char(now_local,'Dy');
  in_on := coalesce((st->>'reminder_in_on')::boolean,true);
  in_after := coalesce((st->>'reminder_in_after_min')::int,15);
  rm_after := coalesce((st->>'missed_in_rm_after_min')::int,60);
  out_on := coalesce((st->>'reminder_out_on')::boolean,true);
  out_after := coalesce((st->>'reminder_out_after_min')::int,30);
  out_hours := coalesce((st->>'clockout_reminder_hours')::int,10);
  buf_days := coalesce((st->>'log_buffer_days')::int,3);
  select value into ns from workspace_settings where key='notification_settings';
  email_evt := coalesce((ns->>'email_attendance_reminder')::boolean,true) and coalesce((ns->>'email_enabled')::boolean,false);
  base_url := coalesce(nullif(ns->>'app_url',''),'https://bridge-five-plum.vercel.app');
  anon := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4dWhteXhmem9xdm11a2F1c2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxODgxMTgsImV4cCI6MjA5NDc2NDExOH0._-WHdcw2p1LR09imPkfGx7F7VfqwHJHkcW6b0hSD00k';

  -- 1) OPEN SHIFTS
  if mode = 'auto_out' then
    -- legacy: close any open session whose (date + auto_out_time, local) has passed
    for r in select a.id, a.user_id, a.date, a.clock_in_at from attendance a
              where a.clock_out_at is null and a.clock_in_at is not null and ((a.date + auto_t) at time zone tz) <= now()
    loop
      cut := (r.date + auto_t) at time zone tz;
      if cut < r.clock_in_at then cut := r.clock_in_at; end if;
      update attendance set clock_out_at = cut, auto_out = true, updated_at = now(),
             note = trim(coalesce(note,'')||' Auto clocked out at end of day.') where id = r.id;
      lnk := 'att:'||r.date::text;
      insert into notifications (id,user_id,text,read,created_at,link,kind,count,updated_at)
      values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), r.user_id::text,
              chr(9201)||' You forgot to clock out on '||to_char(r.date,'DD Mon')||' — we clocked you out automatically at '||to_char(cut at time zone tz,'HH24:MI')||'.',
              false, now(), lnk, 'attendance', 1, now());
    end loop;
  else
    -- spec §9.2: never close on a timer. Next local day (from 07:00), tell the person and the manager once.
    if now_local::time >= time '07:00' then
      for r in select a.id, a.user_id, a.date, a.clock_in_at, p.first_name, p.last_name, p.manager_id
                 from attendance a join profiles p on p.id = a.user_id
                where a.clock_out_at is null and a.clock_in_at is not null and a.date < today_local and a.rm_notified_at is null
                  and a.clock_in_at < now() - interval '12 hours'   -- a night shift that started yesterday is still live this morning
      loop
        lnk := 'att:open:'||r.id;
        update attendance set rm_notified_at = now() where id = r.id;
        insert into notifications (id,user_id,text,read,created_at,link,kind,count,updated_at)
        values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), r.user_id::text,
                chr(9201)||' You didn''t clock out on '||to_char(r.date,'DD Mon')||'. Your manager will close the shift — tell them when you actually left.',
                false, now(), 'att:'||r.date::text, 'attendance', 1, now());
        if r.manager_id is not null and coalesce((ns->>'inapp_attendance_open_shift')::boolean,true) then
          txt := chr(9201)||' '||trim(coalesce(r.first_name,'')||' '||coalesce(r.last_name,''))||' clocked in on '||to_char(r.date,'DD Mon')||' at '||to_char(r.clock_in_at at time zone tz,'HH24:MI')||' and never clocked out — please close the shift.';
          insert into notifications (id,user_id,text,read,created_at,link,kind,count,updated_at)
          values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), r.manager_id::text, txt, false, now(), lnk, 'attendance', 1, now());
          select p.email, p.first_name, coalesce(p.email_enabled,true) as email_ok, p.notify_prefs into mgr from profiles p where p.id = r.manager_id;
          pref := mgr.notify_prefs->'channels'->'attendance';
          do_email := coalesce((ns->>'email_attendance_open_shift')::boolean,true) and coalesce((ns->>'email_enabled')::boolean,false) and mgr.email_ok and mgr.email is not null and coalesce(pref->>'email','true') <> 'false';
          if do_email then
            perform net.http_post(url := 'https://bxuhmyxfzoqvmukausjd.supabase.co/functions/v1/send-notification',
              headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||anon),
              body := jsonb_build_object('to', mgr.email, 'from_name', coalesce(ns->>'email_from_name','Bridge'),
                'subject', 'Open shift to close: '||trim(coalesce(r.first_name,'')||' '||coalesce(r.last_name,''))||' ('||to_char(r.date,'DD Mon')||')',
                'html', '<p>Hi '||coalesce(mgr.first_name,'')||',</p><p>'||txt||'</p><p>Bridge never guesses a clock-out time. Open <b>Attendance → Requests</b> and close the shift with the time they actually left.</p><p><a href="'||base_url||'/#attendance">Open Bridge</a></p>'),
              timeout_milliseconds := 8000);
          end if;
        end if;
      end loop;
      -- escalation (§9.6 log_buffer_days): still open after the buffer → manager again + manager's manager, once
      for r in select a.id, a.user_id, a.date, p.first_name, p.last_name, p.manager_id
                 from attendance a join profiles p on p.id = a.user_id
                where a.clock_out_at is null and a.clock_in_at is not null and a.date < today_local - buf_days and a.rm_notified_at is not null
                  and not exists (select 1 from notifications n where n.link = 'att:open:esc:'||a.id)
      loop
        txt := chr(9888)||' Still open after '||buf_days||' days: '||trim(coalesce(r.first_name,'')||' '||coalesce(r.last_name,''))||' on '||to_char(r.date,'DD Mon')||' — this blocks payroll until it is closed.';
        if r.manager_id is not null then
          insert into notifications (id,user_id,text,read,created_at,link,kind,count,updated_at)
          values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), r.manager_id::text, txt, false, now(), 'att:open:esc:'||r.id, 'attendance', 1, now());
          select p.manager_id into mgr2 from profiles p where p.id = r.manager_id;
          if mgr2.manager_id is not null and mgr2.manager_id <> r.manager_id then
            insert into notifications (id,user_id,text,read,created_at,link,kind,count,updated_at)
            values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), mgr2.manager_id::text, txt, false, now(), 'att:open:esc:'||r.id, 'attendance', 1, now());
          end if;
        else
          -- no manager on file: mark as escalated so it doesn't loop, the Verification report still shows it
          insert into notifications (id,user_id,text,read,created_at,link,kind,count,updated_at)
          values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), r.user_id::text, txt, false, now(), 'att:open:esc:'||r.id, 'attendance', 1, now());
        end if;
      end loop;
    end if;
  end if;

  -- 2) CLOCK-IN REMINDERS (person) + MISSED CLOCK-IN (manager): scheduled working day only.
  for r in select p.id, p.email, p.first_name, p.last_name, p.manager_id, p.location_id, coalesce(p.email_enabled,true) as email_ok, p.work_schedule, p.notify_prefs
             from profiles p where p.status='Active' and coalesce(p.attendance_required,true)
  loop
    sched := coalesce(r.work_schedule,'{}'::jsonb);
    -- dated pattern: if the current version isn't live yet, use the last history entry
    if (sched->>'effectiveFrom') is not null and (sched->>'effectiveFrom')::date > today_local and jsonb_typeof(sched->'history')='array' and jsonb_array_length(sched->'history')>0 then
      sched := sched->'history'->(jsonb_array_length(sched->'history')-1);
    end if;
    t_in := coalesce(nullif(sched->>'in',''),'09:00')::time;
    offdays := coalesce(sched->'offDays','["Sun"]'::jsonb);
    if offdays ? dow then continue; end if;
    select exists (select 1 from public_holidays h where h.date = today_local and (h.location_id is null or r.location_id is null or h.location_id = r.location_id)) into is_hol;
    if is_hol then continue; end if;
    if exists (select 1 from attendance a where a.user_id=r.id and a.date=today_local) then continue; end if;
    -- person
    if in_on and now_local >= (today_local + t_in) + (in_after||' minutes')::interval and now_local <= (today_local + t_in) + ((in_after+120)||' minutes')::interval then
      lnk := 'att:in:'||today_local::text;
      if not exists (select 1 from notifications n where n.user_id=r.id::text and n.link=lnk) then
        txt := chr(9200)||' Good morning '||coalesce(r.first_name,'')||' — you haven''t clocked in yet today. Tap to clock in.';
        insert into notifications (id,user_id,text,read,created_at,link,kind,count,updated_at)
        values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), r.id::text, txt, false, now(), lnk, 'attendance', 1, now());
        pref := r.notify_prefs->'channels'->'attendance';
        do_email := email_evt and r.email_ok and r.email is not null and coalesce(pref->>'email','true') <> 'false';
        if do_email then
          perform net.http_post(url := 'https://bxuhmyxfzoqvmukausjd.supabase.co/functions/v1/send-notification',
            headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||anon),
            body := jsonb_build_object('to', r.email, 'from_name', coalesce(ns->>'email_from_name','Bridge'),
              'subject', 'Reminder: clock in for today',
              'html', '<p>Hi '||coalesce(r.first_name,'')||',</p><p>You haven''t clocked in yet today. Open Bridge and tap <b>Clock in</b> from your dashboard.</p><p><a href="'||base_url||'/#home">Open Bridge</a></p>'),
            timeout_milliseconds := 8000);
        end if;
      end if;
    end if;
    -- manager (§9.2: same-day notification to colleague AND RM)
    if in_on and r.manager_id is not null and coalesce((ns->>'inapp_attendance_missed_rm')::boolean,true)
       and now_local >= (today_local + t_in) + (rm_after||' minutes')::interval and now_local <= (today_local + t_in) + ((rm_after+240)||' minutes')::interval then
      select exists (select 1 from attendance_requests q where q.user_id=r.id and q.type='on_duty' and q.status='Approved' and q.date<=today_local and coalesce(q.date_to,q.date)>=today_local) into onduty;
      if not onduty then
        lnk := 'att:team:'||today_local::text||':'||r.id::text;
        if not exists (select 1 from notifications n where n.user_id=r.manager_id::text and n.link=lnk) then
          txt := chr(9200)||' '||trim(coalesce(r.first_name,'')||' '||coalesce(r.last_name,''))||' hasn''t clocked in yet today (shift '||to_char(t_in,'HH24:MI')||').';
          insert into notifications (id,user_id,text,read,created_at,link,kind,count,updated_at)
          values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), r.manager_id::text, txt, false, now(), lnk, 'attendance', 1, now());
          if coalesce((ns->>'email_attendance_missed_rm')::boolean,false) and coalesce((ns->>'email_enabled')::boolean,false) then
            select p.email, p.first_name, coalesce(p.email_enabled,true) as email_ok, p.notify_prefs into mgr from profiles p where p.id = r.manager_id;
            pref := mgr.notify_prefs->'channels'->'attendance';
            if mgr.email_ok and mgr.email is not null and coalesce(pref->>'email','true') <> 'false' then
              perform net.http_post(url := 'https://bxuhmyxfzoqvmukausjd.supabase.co/functions/v1/send-notification',
                headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||anon),
                body := jsonb_build_object('to', mgr.email, 'from_name', coalesce(ns->>'email_from_name','Bridge'),
                  'subject', trim(coalesce(r.first_name,'')||' '||coalesce(r.last_name,''))||' hasn''t clocked in',
                  'html', '<p>Hi '||coalesce(mgr.first_name,'')||',</p><p>'||txt||'</p><p><a href="'||base_url||'/#attendance">Open Bridge</a></p>'),
                timeout_milliseconds := 8000);
            end if;
          end if;
        end if;
      end if;
    end if;
  end loop;

  -- 3) CLOCK-OUT REMINDERS: open session today, past schedule.out + N min, or past clockout_reminder_hours on the clock (once each per day).
  if out_on then
    for r in select a.id as att_id, a.date, a.clock_in_at, p.id, p.email, p.first_name, coalesce(p.email_enabled,true) as email_ok, p.work_schedule, p.notify_prefs
               from attendance a join profiles p on p.id=a.user_id
              where a.clock_out_at is null and a.clock_in_at is not null and a.date >= today_local - 1
    loop
      sched := coalesce(r.work_schedule,'{}'::jsonb);
      if (sched->>'effectiveFrom') is not null and (sched->>'effectiveFrom')::date > today_local and jsonb_typeof(sched->'history')='array' and jsonb_array_length(sched->'history')>0 then
        sched := sched->'history'->(jsonb_array_length(sched->'history')-1);
      end if;
      t_in := coalesce(nullif(sched->>'in',''),'09:00')::time;
      t_out := coalesce(nullif(sched->>'out',''),'18:00')::time;
      -- shift end as a timestamp on the session's own date (next day for a night shift)
      end_ts := (r.date + t_out) + case when t_out < t_in then interval '1 day' else interval '0' end;
      lnk := null;
      if now_local >= end_ts + (out_after||' minutes')::interval then lnk := 'att:out:'||r.date::text; txt := chr(9201)||' Still clocked in? Your shift ended at '||to_char(t_out,'HH24:MI')||' — tap to clock out.';
      elsif now() >= r.clock_in_at + (out_hours||' hours')::interval then lnk := 'att:out:long:'||r.date::text; txt := chr(9201)||' You''ve been clocked in for over '||out_hours||' hours — still working? Tap to clock out.';
      end if;
      if lnk is null then continue; end if;
      if exists (select 1 from notifications n where n.user_id=r.id::text and n.link=lnk) then continue; end if;
      insert into notifications (id,user_id,text,read,created_at,link,kind,count,updated_at)
      values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), r.id::text, txt, false, now(), lnk, 'attendance', 1, now());
      pref := r.notify_prefs->'channels'->'attendance';
      do_email := email_evt and r.email_ok and r.email is not null and coalesce(pref->>'email','true') <> 'false';
      if do_email then
        perform net.http_post(url := 'https://bxuhmyxfzoqvmukausjd.supabase.co/functions/v1/send-notification',
          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||anon),
          body := jsonb_build_object('to', r.email, 'from_name', coalesce(ns->>'email_from_name','Bridge'),
            'subject', 'Reminder: clock out', 'html', '<p>Hi '||coalesce(r.first_name,'')||',</p><p>You are still clocked in. Open Bridge and tap <b>Clock out</b>. '||case when mode='auto_out' then 'If you forget, you will be clocked out automatically at end of day.' else 'If you forget, your manager will have to close the shift for you.' end||'</p><p><a href="'||base_url||'/#home">Open Bridge</a></p>'),
          timeout_milliseconds := 8000);
      end if;
    end loop;
  end if;

  -- 4) PEOPLE: birthdays, work anniversaries, document expiry (unchanged from v132)
  if now_local::time >= time '09:00' and now_local::time < time '09:06' then
    for r in select p.id, p.first_name, p.last_name, p.manager_id, p.birth_date, p.joining_date from profiles p where p.status='Active'
    loop
      if r.birth_date is not null and to_char(r.birth_date,'MM-DD') = to_char(today_local,'MM-DD') then
        lnk := 'profile:'||r.id::text;
        if r.manager_id is not null and not exists (select 1 from notifications n where n.user_id=r.manager_id::text and n.link=lnk and n.created_at::date=today_local) then
          insert into notifications (id,user_id,text,read,created_at,link,kind,count,updated_at)
          values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), r.manager_id::text,
                  chr(127874)||' It''s '||trim(coalesce(r.first_name,'')||' '||coalesce(r.last_name,''))||'''s birthday today!', false, now(), lnk, 'people', 1, now());
        end if;
      end if;
      if r.joining_date is not null and to_char(r.joining_date,'MM-DD') = to_char(today_local,'MM-DD') and r.joining_date < today_local then
        lnk := 'profile:'||r.id::text;
        if r.manager_id is not null and not exists (select 1 from notifications n where n.user_id=r.manager_id::text and n.link=lnk and n.created_at::date=today_local) then
          insert into notifications (id,user_id,text,read,created_at,link,kind,count,updated_at)
          values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), r.manager_id::text,
                  chr(127881)||' '||trim(coalesce(r.first_name,'')||' '||coalesce(r.last_name,''))||' completes '||(extract(year from age(today_local, r.joining_date)))::int||' year(s) at the company today.', false, now(), lnk, 'people', 1, now());
        end if;
      end if;
    end loop;
    for r in select d.id as doc_id, d.user_id, d.name, d.expiry_date, p.manager_id, (d.expiry_date - today_local) as days_left
               from profile_documents d join profiles p on p.id=d.user_id
              where d.expiry_date is not null and (d.expiry_date - today_local) in (90,60,30,7,0)
    loop
      lnk := 'profile:'||r.user_id::text||':docs';
      txt := chr(128196)||' Document "'||r.name||'" '||case when r.days_left=0 then 'expires today' else 'expires in '||r.days_left||' days' end||'.';
      if not exists (select 1 from notifications n where n.user_id=r.user_id::text and n.link=lnk and n.created_at::date=today_local and n.text=txt) then
        insert into notifications (id,user_id,text,read,created_at,link,kind,count,updated_at)
        values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), r.user_id::text, txt, false, now(), lnk, 'people', 1, now());
        if r.manager_id is not null then
          insert into notifications (id,user_id,text,read,created_at,link,kind,count,updated_at)
          values ('n_'||substr(md5(random()::text||clock_timestamp()::text),1,12), r.manager_id::text, txt, false, now(), lnk, 'people', 1, now());
        end if;
      end if;
    end loop;
  end if;
end $function$;
