// okr-reminders — daily OKR job (pg_cron 'okr-daily-reminders', 05:00 UTC = 09:00 Asia/Dubai, via pg_net).
//
// v2 (unchanged below, section A): one combined "check-in due today" email per owner, deduped in email_log.
// v4.0 (section B): alerts about the DATA, not the calendar —
//   · variance  — actual sits below the approved ramp (okrs.pacing) by more than the tolerance for
//                 N updates in a row            → owners + the owners of the objective above
//   · stale     — no update for longer than cadence × multiplier → owners; one day later the level above too
//   · blocked   — handled live in the app (19b-okr-v4.js → okrBlockedAlert), not here
// Thresholds come from workspace_settings.notification_settings.okr_alerts (Settings → Email → OKR alert
// thresholds): { tolerance, variance_streak, stale_multiplier }. Every alert is written to okr_alerts with a
// fingerprint, so the same condition is never sent twice. Section B is skipped entirely until the v4
// migration has run (it checks for okrs.kind), so deploying this before the migration is safe.
import { createClient } from 'npm:@supabase/supabase-js@2'

const TZ = 'Asia/Dubai'

function todayInTZ(now: Date) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now) // YYYY-MM-DD
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(now) // e.g. Mon
  const day = Number(date.slice(8, 10))
  return { date, weekday, day }
}

// Mirrors okrDueOn() in the app (19-okr-roles-acl.js) — keep the two in sync.
function dueOn(o: Record<string, unknown>, d: { date: string; weekday: string; day: number }) {
  if (o.deleted_at) return false
  if (o.closed) return false
  if (o.state === 'draft') return false // v4.0: drafts are not live
  if (o.is_annual) return false
  if (o.rollup) return false
  const f = (o.frequency && typeof o.frequency === 'object') ? o.frequency as Record<string, unknown> : {}
  if (!f.type) return false
  if (o.period_start && d.date < String(o.period_start)) return false
  if (o.period_end && d.date > String(o.period_end)) return false
  if (f.type === 'weekly') return d.weekday === (f.day || 'Mon')
  if (f.type === 'monthly') {
    const y = Number(d.date.slice(0, 4)), m = Number(d.date.slice(5, 7))
    const daysInMonth = new Date(y, m, 0).getDate()
    const want = Math.min(Number(f.day || 1), daysInMonth)
    return d.day === want
  }
  if (f.type === 'custom') return Array.isArray(f.dates) && (f.dates as string[]).includes(d.date)
  return false
}

function fill(str: string, vars: Record<string, string>) {
  return String(str || '').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}

// Mirrors _bodyToHtml() in the app (18-settings-notifications.js) — same email chrome.
function bodyToHtml(fromName: string, bodyText: string, actionUrl: string) {
  const escn = (s: string) => String(s || '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string))
  const safeName = escn(fromName || 'Bridge')
  const lines = String(bodyText || '').split('\n').map((l) => l.trim())
    .filter((l) => l !== '{{action_url}}' && l !== actionUrl && !/^https?:\/\//.test(l))
    .map(escn)
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F5F3EF;font-family:sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;border:1px solid #ECEDF0;overflow:hidden">
    <div style="background:#13171B;padding:20px 28px;display:flex;align-items:center;gap:10px">
      <div style="width:28px;height:28px;border-radius:8px;background:#8B6B41;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff">B</div>
      <span style="font-weight:700;font-size:16px;color:#fff">${safeName}</span>
    </div>
    <div style="padding:28px">
      ${lines.filter(Boolean).map((l, i) => i === 0
        ? `<p style="font-size:15px;color:#374151;margin:0 0 16px">${l}</p>`
        : `<p style="font-size:14px;color:#6B7280;margin:0 0 8px;line-height:1.6">${l}</p>`).join('')}
      ${actionUrl ? `<div style="margin-top:24px">
        <a href="${actionUrl}" style="display:inline-block;background:#13171B;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none">Open OKRs →</a>
        <p style="margin:10px 0 0;font-size:11px;color:#B8B5AC">Or copy: ${actionUrl}</p>
      </div>` : ''}
    </div>
    <div style="padding:16px 28px;background:#F9F8F5;border-top:1px solid #ECEDF0;font-size:11px;color:#9CA3AF">
      ${safeName} · Automated notification · Do not reply
    </div>
  </div></body></html>`
}

const DEFAULT_TPL: Record<string, { subject: string; body: string }> = {
  okr_checkin_due: {
    subject: '⏰ OKR check-in due today ({{count}})',
    body: 'Hi {{user_name}},\n\nYou have {{count}} OKR check-in(s) scheduled for today ({{date}}):\n\n{{okr_titles}}\n\nOpen Bridge to submit your update — if a co-owner already submitted, you\'re covered.\n\n{{action_url}}',
  },
  okr_variance: {
    subject: '📉 Behind the plan: {{okr_title}}',
    body: 'Hi {{user_name}},\n\n"{{okr_title}}" is behind the approved ramp.\n\nActual: {{actual}}\nPlan for today: {{plan}}\nGap: {{gap}} — {{streak}} update(s) in a row below the plan.\n\nOpen Bridge to see the ramp and the latest updates.\n\n{{action_url}}',
  },
  okr_stale: {
    subject: '⏳ No update for {{days}} days: {{okr_title}}',
    body: 'Hi {{user_name}},\n\n"{{okr_title}}" has not been updated for {{days}} days (an update was expected {{expected}}).\n\nA number nobody is watching is how the August outage went unflagged — please add this week\'s update, or close the objective if it no longer applies.\n\n{{action_url}}',
  },
}

type Row = Record<string, any>

/* ───────── v4.0 helpers (mirror 19b-okr-v4.js: okrPlanValueAt / okrPlanPctAt) ───────── */
function pacingPts(o: Row): { date: string; value: number }[] {
  if (!Array.isArray(o.pacing)) return []
  return o.pacing.filter((p: any) => p && p.date && p.value !== null && p.value !== undefined && isFinite(Number(p.value)))
    .map((p: any) => ({ date: String(p.date).slice(0, 10), value: Number(p.value) })).sort((a: any, b: any) => a.date.localeCompare(b.date))
}
function targetEff(o: Row): number | null {
  if (o.revised_target !== null && o.revised_target !== undefined && o.metric_type !== 'yesno') return Number(o.revised_target)
  return (o.target_value === null || o.target_value === undefined) ? null : Number(o.target_value)
}
function planValueAt(o: Row, date: string): number | null {
  const pts = pacingPts(o); if (!pts.length) return null
  const s = Number(o.start_value || 0), t = targetEff(o)
  const a = pts.slice()
  const ps = o.period_start || o.baseline_as_of || (o.created_at ? String(o.created_at).slice(0, 10) : null)
  if (ps && a[0].date > String(ps)) a.unshift({ date: String(ps), value: s })
  if (o.period_end && t !== null && a[a.length - 1].date < String(o.period_end)) a.push({ date: String(o.period_end), value: t })
  if (date <= a[0].date) return a[0].value
  if (date >= a[a.length - 1].date) return a[a.length - 1].value
  for (let i = 1; i < a.length; i++) {
    if (date <= a[i].date) {
      const p = a[i - 1], q = a[i]
      const t0 = Date.parse(p.date + 'T00:00:00Z'), t1 = Date.parse(q.date + 'T00:00:00Z'), tn = Date.parse(date + 'T00:00:00Z')
      if (t1 <= t0) return q.value
      return p.value + (q.value - p.value) * ((tn - t0) / (t1 - t0))
    }
  }
  return a[a.length - 1].value
}
function pctOf(o: Row, v: number): number | null {
  const s = Number(o.start_value || 0), t = targetEff(o)
  if (t === null || !isFinite(t) || t === s) return null
  return ((v - s) / (t - s)) * 100
}
function fmtVal(o: Row, v: number | null): string {
  if (v === null || v === undefined || !isFinite(v)) return '—'
  const n = Math.round(v * 100) / 100
  const abbr = Math.abs(n) >= 1e9 ? (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B' : Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M' : Math.abs(n) >= 1e4 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k' : String(n)
  if (o.metric_type === 'percent') return abbr + '%'
  if (o.metric_type === 'currency') return (o.unit ? o.unit + ' ' : '') + abbr
  return abbr + (o.unit ? ' ' + o.unit : '')
}
function cadenceDays(o: Row): number | null {
  const f = (o.frequency && typeof o.frequency === 'object') ? o.frequency as Row : {}
  if (f.type === 'weekly') return 7
  if (f.type === 'monthly') return 30
  if (f.type === 'custom' && Array.isArray(f.dates) && f.dates.length > 1) {
    const ds = (f.dates as string[]).slice().sort(); let sum = 0
    for (let i = 1; i < ds.length; i++) sum += (Date.parse(ds[i]) - Date.parse(ds[i - 1])) / 86400000
    return Math.max(1, Math.round(sum / (ds.length - 1)))
  }
  return null
}
function owners(o: Row): string[] {
  return (Array.isArray(o.owners) && o.owners.length ? o.owners : (o.owner_id ? [o.owner_id] : [])).filter(Boolean).map(String)
}
function daysBetween(a: string, b: string) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000) }

Deno.serve(async (_req) => {
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const sb = createClient(url, serviceKey)

    const d = todayInTZ(new Date())
    // PostgREST caps a response at 1,000 rows by default — page through, or the oldest rows win silently.
    async function fetchAll(build: (from: number, to: number) => any): Promise<Row[]> {
      const out: Row[] = []; const page = 1000
      let size = page
      for (let from = 0; ; from += size) {
        const { data, error } = await build(from, from + page - 1)
        if (error) throw error
        const rows = (data || []) as Row[]
        if (!rows.length) break
        out.push(...rows)
        // The server's own max-rows may be smaller than our page: step by what we actually got, and only
        // stop on an empty page — never on "fewer than asked", which is exactly how rows go missing silently.
        size = rows.length
      }
      return out
    }

    const { data: nsRow } = await sb.from('workspace_settings').select('value').eq('key', 'notification_settings').maybeSingle()
    const ns = ((nsRow && nsRow.value) || {}) as Row
    const emailOn = ns.email_enabled === true
    const appUrl = String(ns.app_url || '').replace(/\/$/, '')
    const actionUrl = appUrl ? appUrl + '/#okr' : ''
    const fromName = ns.email_from_name || 'Bridge'
    const tplOf = (k: string) => ({ subject: ns.templates?.[k]?.subject || DEFAULT_TPL[k].subject, body: ns.templates?.[k]?.body || DEFAULT_TPL[k].body })

    const all = await fetchAll((f, t) => sb.from('okrs').select('*').is('deleted_at', null).order('id', { ascending: true }).range(f, t))
    const byId = new Map(all.map((o) => [String(o.id), o]))
    const v4 = all.length > 0 && Object.prototype.hasOwnProperty.call(all[0], 'kind')

    // People lookup (owners of everything we might write to)
    const profById = new Map<string, Row>()
    async function loadProfiles(ids: string[]) {
      const need = [...new Set(ids)].filter((x) => x && !profById.has(x))
      if (!need.length) return
      const { data } = await sb.from('profiles').select('id,first_name,last_name,email,email_enabled,status').in('id', need)
      for (const p of (data || [])) profById.set(String(p.id), p)
    }
    const nameOf = (p: Row | undefined) => `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'there'
    async function sendMail(p: Row, subject: string, html: string) {
      const resp = await fetch(`${url}/functions/v1/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(anonKey ? { Authorization: `Bearer ${anonKey}`, apikey: anonKey } : {}) },
        body: JSON.stringify({ to: p.email, from_name: fromName, subject, html }),
      })
      return resp.ok ? null : `${p.email}: HTTP ${resp.status}`
    }
    async function bell(uid: string, text: string) {
      await sb.from('notifications').insert({ id: 'n_' + Math.random().toString(36).slice(2, 9), user_id: uid, text, read: false, created_at: new Date().toISOString() })
    }

    const out: Row = { date: d.date }

    /* ═══════════ A. check-in reminders (v2 behaviour, unchanged) ═══════════ */
    {
      const due = all.filter((o) => dueOn(o, d))
      let sent = 0, skipped = 0; const errors: string[] = []
      if (due.length && emailOn && ns['email_okr_checkin_due'] !== false) {
        const dueIds = due.map((o) => o.id)
        const { data: cks } = await sb.from('okr_checkins').select('okr_id').eq('date', d.date).in('okr_id', dueIds)
        const doneSet = new Set((cks || []).map((c) => c.okr_id))
        const open = due.filter((o) => !doneSet.has(o.id))
        const perUser = new Map<string, Row[]>()
        for (const o of open) for (const uid of new Set(owners(o))) { if (!perUser.has(uid)) perUser.set(uid, []); perUser.get(uid)!.push(o) }
        await loadProfiles([...perUser.keys()])
        const tpl = tplOf('okr_checkin_due')
        for (const [uid, list] of perUser) {
          const p = profById.get(uid)
          if (!p || !p.email || p.status !== 'Active' || p.email_enabled === false) { skipped++; continue }
          const key = `okr_due_${d.date}_${uid}`
          const { data: lockRow, error: lockErr } = await sb.from('email_log').insert({ key }).select('key').maybeSingle()
          if (lockErr || !lockRow) { skipped++; continue }
          const titles = list.map((o) => '• ' + (o.title || 'Untitled')).join('\n')
          const vars = { user_name: nameOf(p), from_name: fromName, count: String(list.length), date: d.date, okr_titles: titles, action_url: actionUrl, app_url: appUrl }
          const err = await sendMail(p, fill(tpl.subject, vars), bodyToHtml(fromName, fill(tpl.body, vars), actionUrl))
          if (err) errors.push(err); else sent++
          await bell(uid, `⏰ ${list.length} OKR check-in${list.length === 1 ? '' : 's'} due today — any owner can submit for the group`)
        }
      }
      out.reminders = { due: due.length, sent, skipped, errors }
    }

    /* ═══════════ B. v4.0 alerts — only once the migration has landed ═══════════ */
    if (!v4) { out.alerts = 'skipped: v4 columns not present yet'; return Response.json(out) }
    const cfg = Object.assign({ tolerance: 15, variance_streak: 2, stale_multiplier: 2 }, (ns.okr_alerts && typeof ns.okr_alerts === 'object') ? ns.okr_alerts : {})
    const live = all.filter((o) => !o.closed && o.state !== 'draft' && !o.is_annual && !o.rollup && owners(o).length)
    const ckRows = await fetchAll((f, t) => sb.from('okr_checkins').select('id,okr_id,date,value,created_at').lte('date', d.date).order('date', { ascending: true }).order('created_at', { ascending: true }).order('id', { ascending: true }).range(f, t))
    const cksBy = new Map<string, Row[]>()
    for (const c of ckRows) { const k = String(c.okr_id); if (!cksBy.has(k)) cksBy.set(k, []); cksBy.get(k)!.push(c) }

    type Alert = { okr: Row; kind: 'variance' | 'stale'; fingerprint: string; to: string[]; vars: Row; text: string }
    const alerts: Alert[] = []
    for (const o of live) {
      const id = String(o.id)
      const cks = cksBy.get(id) || []
      const parent = o.parent_id ? byId.get(String(o.parent_id)) : undefined
      const up = parent ? owners(parent) : []

      // ── variance: value-type nodes with an approved ramp ──
      if (o.metric_type !== 'krs' && o.metric_type !== 'yesno' && pacingPts(o).length && !(o.kind === 'kr' && (o.kr_kind === 'milestone' || o.kr_kind === 'count'))) {
        const tol = (o.pace_tolerance !== null && o.pace_tolerance !== undefined) ? Number(o.pace_tolerance) : Number(cfg.tolerance)
        const vals = cks.filter((c) => c.value !== null && c.value !== undefined)
        let streak = 0
        for (let i = vals.length - 1; i >= 0; i--) {
          const c = vals[i]; const plan = planValueAt(o, String(c.date)); if (plan === null) break
          const pp = pctOf(o, plan), ap = pctOf(o, Number(c.value)); if (pp === null || ap === null) break
          // pctOf() already climbs as a lower-is-better number falls; only the legacy ALLOWANCE shape
          // ('down' with the target ABOVE the start — "% of the allowance used") reads the other way.
          const limit = o.direction === 'down' && (targetEff(o) ?? 0) > Number(o.start_value || 0)
          const behind = limit ? (ap > pp + tol) : (ap < pp - tol)
          if (!behind) break
          streak++
        }
        if (streak >= Number(cfg.variance_streak)) {
          const last = vals[vals.length - 1]
          const planToday = planValueAt(o, d.date)
          const gap = planToday === null ? null : Number(last.value) - planToday
          alerts.push({ okr: o, kind: 'variance', fingerprint: `variance:${last.date}`, to: [...new Set([...owners(o), ...up])],
            vars: { okr_title: o.title || '', actual: fmtVal(o, Number(last.value)), plan: fmtVal(o, planToday), gap: (gap === null ? '—' : (gap > 0 ? '+' : '') + fmtVal(o, Math.round(gap * 100) / 100)), streak: String(streak) },
            text: `📉 "${o.title || ''}" is behind the plan — ${fmtVal(o, Number(last.value))} vs ${fmtVal(o, planToday)} planned (${streak} updates in a row)` })
        }
      }

      // ── stale: no update for longer than cadence × multiplier ──
      const cad = cadenceDays(o)
      const lastVal = cks.length ? cks[cks.length - 1].value : null
      const reached = lastVal !== null && lastVal !== undefined && (() => { const p = pctOf(o, Number(lastVal)); return p !== null && p >= 100 })()
      const finished = (o.kind === 'kr' && o.kr_kind === 'milestone' && o.done_at)
        || (o.kind === 'kr' && o.kr_kind === 'count' && Array.isArray(o.items) && o.items.length > 0 && o.items.every((x: Row) => x && x.doneAt))
        || reached // target already met — nobody needs nagging for silence
      if (cad && !finished) {
        if (o.period_start && d.date < String(o.period_start)) continue
        if (o.period_end && d.date > String(o.period_end)) continue
        const lastDate = cks.length ? String(cks[cks.length - 1].date) : String(o.created_at || '').slice(0, 10)
        if (!lastDate) continue
        const quiet = daysBetween(lastDate, d.date)
        const limit = Math.round(cad * Number(cfg.stale_multiplier))
        if (quiet > limit) {
          const expected = new Date(Date.parse(lastDate + 'T00:00:00Z') + cad * 86400000).toISOString().slice(0, 10)
          const base = { okr_title: o.title || '', days: String(quiet), expected }
          alerts.push({ okr: o, kind: 'stale', fingerprint: `stale:${lastDate}`, to: owners(o), vars: base, text: `⏳ "${o.title || ''}" has had no update for ${quiet} days` })
          if (quiet > limit + 1 && up.length) alerts.push({ okr: o, kind: 'stale', fingerprint: `stale-up:${lastDate}`, to: up.filter((u) => !owners(o).includes(u)), vars: base, text: `⏳ "${o.title || ''}" (under your objective) has had no update for ${quiet} days` })
        }
      }
    }

    // Dedup + deliver
    let sent = 0, inapp = 0, dup = 0; const errors: string[] = []
    await loadProfiles(alerts.flatMap((a) => a.to))
    for (const a of alerts) {
      if (!a.to.length) continue
      const { data: ins, error: insErr } = await sb.from('okr_alerts').insert({ okr_id: a.okr.id, kind: a.kind, fingerprint: a.fingerprint, sent_to: a.to, details: a.vars }).select('id').maybeSingle()
      if (insErr) { if (insErr.code === '23505') { dup++ } else { errors.push('okr_alerts: ' + (insErr.message || insErr.code)) } continue } // unique (okr_id, kind, fingerprint) → already told them
      if (!ins) { dup++; continue }
      const ev = a.kind === 'variance' ? 'okr_variance' : 'okr_stale'
      const tpl = tplOf(ev)
      for (const uid of new Set(a.to)) {
        const p = profById.get(uid)
        if (ns['inapp_' + ev] !== false) { await bell(uid, a.text); inapp++ }
        if (emailOn && ns['email_' + ev] !== false && p && p.email && p.status === 'Active' && p.email_enabled !== false) {
          const vars = { user_name: nameOf(p), from_name: fromName, action_url: actionUrl, app_url: appUrl, ...a.vars }
          const err = await sendMail(p, fill(tpl.subject, vars), bodyToHtml(fromName, fill(tpl.body, vars), actionUrl))
          if (err) errors.push(err); else sent++
        }
      }
    }
    out.alerts = { candidates: alerts.length, deduped: dup, emails: sent, inapp, errors, cfg }
    return Response.json(out)
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
})
