// Bridge — send-push (v132: + dm / attendance / people / access kinds)
// Called by the DB triggers on `notifications` (new rows, and collapsed chat rows that grew) with the
// rows to deliver. For every device the person registered (push_subscriptions):
//   · skips the person entirely while Bridge is OPEN AND FOCUSED on one of their devices
//     (user_presence heartbeat < 45s old) — the open app rings once; no second alert from the OS
//   · skips while the person is on Do Not Disturb or inside their quiet hours (profiles.notify_prefs)
//   · honours the person's per-kind "Push" preference (profiles.notify_prefs.channels[kind].push)
//   · short TTL for chat (a "new message" push is stale after an hour), longer for work items
//   · sends a Web Push (kind 'webpush'); native tokens ('apns'/'fcm') are stored for the Capacitor app
//     and skipped until a native sender is wired in
//   · when the push service ACCEPTS the message for a chat/mention row, stamps crm_reads.last_delivered_at
//     so the sender sees grey ✓✓ even though the app is closed
//   · removes subscriptions the push service reports dead (404/410)
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
};
type Row = { id: string; user_id: string; text: string; link?: string | null; created_at?: string; updated_at?: string; kind?: string | null; conversation_id?: string | null; count?: number | null; actor_id?: string | null };

const PRESENCE_FRESH_MS = 45_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("POST only", { status: 405, headers: cors });

  const admin = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });
  const { data: cfg, error: cfgErr } = await admin.from("push_config").select("*").eq("id", "default").maybeSingle();
  if (cfgErr || !cfg) return json({ error: "push_config missing" }, 500);
  if (req.headers.get("x-push-secret") !== cfg.hook_secret) return json({ error: "forbidden" }, 403);

  let body: { rows?: Row[] } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const rows = (body.rows || []).filter((r) => r && r.user_id && r.text);
  if (!rows.length) return json({ sent: 0 });

  webpush.setVapidDetails(cfg.vapid_subject || "mailto:admin@bloomingbox.com", cfg.vapid_public, cfg.vapid_private);

  const userIds = Array.from(new Set(rows.map((r) => String(r.user_id))));
  const since = new Date(Date.now() - PRESENCE_FRESH_MS).toISOString();
  const [{ data: subs }, { data: profs }, { data: pres }] = await Promise.all([
    admin.from("push_subscriptions").select("*").in("user_id", userIds),
    admin.from("profiles").select("id,notify_prefs").in("id", userIds),
    admin.from("user_presence").select("user_id,focused,visible,last_seen").in("user_id", userIds).gte("last_seen", since),
  ]);
  if (!subs || !subs.length) return json({ sent: 0, reason: "no subscriptions" });

  const prefs: Record<string, any> = {};
  for (const p of profs || []) prefs[String(p.id)] = p.notify_prefs || {};
  const focusedNow = new Set<string>();
  for (const p of pres || []) if (p.focused) focusedNow.add(String(p.user_id));
  const byUser: Record<string, typeof subs> = {};
  for (const s of subs) (byUser[s.user_id] = byUser[s.user_id] || []).push(s);

  let sent = 0, failed = 0, skipped = 0, online = 0, quiet = 0;
  const dead: string[] = [];
  const delivered = new Set<string>();   // "user|conversation" pairs to stamp
  const jobs: Promise<void>[] = [];

  for (const r of rows) {
    const uid = String(r.user_id);
    const kind = r.kind || kindOf(r.text, r.link || "");
    const p = prefs[uid] || {};
    if (focusedNow.has(uid)) { online++; continue; }                                 // Bridge is open & focused → the app itself alerts
    if (p.push === false) { skipped++; continue; }                                   // device-wide switch (legacy)
    const ch = p.channels && p.channels[kind];
    if (ch && ch.push === false) { skipped++; continue; }                            // this kind is muted for push
    if (isDnd(p) || inQuietHours(p)) { quiet++; continue; }                          // Do Not Disturb / quiet hours
    const list = byUser[uid] || [];
    for (const s of list) {
      if (s.kind !== "webpush") continue; // TODO(native): APNs / FCM sender for the Capacitor app
      const payload = JSON.stringify({
        id: r.id, kind,
        title: titleFor(kind, r),
        body: stripLead(r.text),
        link: r.link || "",
        tag: r.link || r.id,               // same chat → replaces instead of stacking
        count: r.count || 1,
        at: r.updated_at || r.created_at || new Date().toISOString(),
      });
      jobs.push(
        webpush
          .sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: ttlFor(kind), urgency: "high" })
          .then(() => { sent++; if (r.conversation_id) delivered.add(uid + "|" + r.conversation_id); })
          .catch((e: any) => {
            failed++;
            const code = e && (e.statusCode || e.status);
            if (code === 404 || code === 410) dead.push(s.id);
            else admin.from("push_subscriptions").update({ last_error: String(e && (e.body || e.message) || e).slice(0, 300), updated_at: new Date().toISOString() }).eq("id", s.id).then(() => {});
          }),
      );
    }
  }
  await Promise.all(jobs);
  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
  if (delivered.size) {
    const now = new Date().toISOString();
    const stamps = Array.from(delivered).map((k) => { const [user_id, conversation_id] = k.split("|"); return { user_id, conversation_id, last_delivered_at: now }; });
    await admin.from("crm_reads").upsert(stamps, { onConflict: "user_id,conversation_id" });
  }
  return json({ sent, failed, skipped, online, quiet, removed: dead.length, delivered: delivered.size });
});

/* Do Not Disturb: profiles.notify_prefs.dnd_until (ISO). Quiet hours: notify_prefs.quiet = {on, from:'22:00', to:'08:00', tz:'Asia/Dubai'} */
function isDnd(p: any): boolean {
  const u = p && p.dnd_until; if (!u) return false;
  const t = Date.parse(u); return Number.isFinite(t) && t > Date.now();
}
function inQuietHours(p: any): boolean {
  const q = p && p.quiet; if (!q || !q.on) return false;
  const from = hm(q.from, 22 * 60), to = hm(q.to, 8 * 60);
  const tz = q.tz || "Asia/Dubai";
  let nowMin: number;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    const h = Number(parts.find((x) => x.type === "hour")?.value || 0), m = Number(parts.find((x) => x.type === "minute")?.value || 0);
    nowMin = (h % 24) * 60 + m;
  } catch { const d = new Date(); nowMin = d.getUTCHours() * 60 + d.getUTCMinutes(); }
  if (from === to) return false;
  return from < to ? (nowMin >= from && nowMin < to) : (nowMin >= from || nowMin < to);
}
function hm(s: any, dflt: number): number { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "")); if (!m) return dflt; return (Number(m[1]) % 24) * 60 + (Number(m[2]) % 60); }
function ttlFor(kind: string): number { return (kind === "chat" || kind === "mention" || kind === "dm") ? 60 * 60 : kind === "attendance" ? 60 * 60 * 2 : 60 * 60 * 6; }

function kindOf(text: string, link: string): string {
  const t = text || "";
  if (/tagged you in/i.test(t)) return "mention";
  if (/OKR|BOLT|objective/i.test(t)) return "okr";
  if (link.indexOf("crm:") === 0 && t.indexOf("\u{1F4AC}") >= 0) return "chat";
  if (/checklist/i.test(t)) return "checklist";
  if (/escalat/i.test(t)) return "escalation";
  if (/feedback|replied|reply/i.test(t)) return "feedback";
  if (/approv|reject/i.test(t)) return "approval";
  if (/overdue|late|reminder|deadline|edit request|re-?submit/i.test(t)) return "reminder";
  if (link.indexOf("crm:") === 0) return "ticket";
  return "general";
}
function titleFor(kind: string, r: Row): string {
  switch (kind) {
    case "mention": return "You were tagged";
    case "chat": return (r.count && r.count > 1) ? `${r.count} new messages` : "New message";
    case "ticket": return "Ticket";
    case "okr": return "OKR";
    case "checklist": return "Checklist";
    case "approval": return "Approval";
    case "feedback": return "Feedback";
    case "reminder": return "Reminder";
    case "escalation": return "Escalation";
    case "dm": return (r.count && r.count > 1) ? `${r.count} new messages` : "Direct message";   // v132
    case "attendance": return "Attendance";
    case "people": return "People";
    case "access": return "Access changed";
    default: return "Bridge";
  }
}
function stripLead(text: string): string {
  return String(text || "").replace(/^[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+\s*/u, "").slice(0, 240);
}
function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
