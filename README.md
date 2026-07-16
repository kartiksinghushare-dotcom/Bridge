# Bridge (v3)

Shift checklists, escalation tickets and CRM for Shiftly — previously one 8,400-line `Bridge.html`, now a proper Vite project.

## v3 — Evarca-aligned UI (no Evarca features added)

Evarca is the UI/arrangement reference; only features that exist in Bridge were touched:

- **Navigation hubs** — one sidebar entry with pill sub-tabs on the pages themselves:
  - **Inbox** = Alerts (notifications) + Approvals
  - **Dashboard** = Overview + Analytics + OKRs
  - **Checklists** = Builder + All results + Team
  - **People** = Directory + Hierarchy
  - **Administration** = Settings + Access Control + Departments + Locations + Audit
  - Sidebar sections are now just **Work / People / Manage** + the daily strip.
- **Routing** — browser Back/Forward now walk in-app history (pushState + hashchange); deep links (`#tickets`) work at any time, not just at boot.
- **UI kit** — `hdr`, buttons (`btnP/btnG` → `ui-btn` variants), fields, stat cards, empty/loading/error states all use the shared design tokens; every page picks this up automatically. Missing icons (shield, refresh, calendar, info…) added — Access Control/section chevrons used to render blank.
- **Tickets page** — Evarca-style filter bar: search, assignee, priority (incl. Critical), sort (newest/oldest/priority), Clear, one-line status pill row with result count, and tap-to-filter stat cards.
- **Settings** — dead "Workflow" tab removed (its toggles were saved but never read anywhere); tabs now use the standard segmented bar (In-App / Email / Templates / Data).
- **CRM (Bridge-only, improved further)** — quick filters above the conversation list (All / Unread / Mine with counts), plus everything from v2 (kanban, due dates, unread sync, assignment notifications).
- Login panel copy fixed (referenced clock-in/geofencing — features Bridge doesn't have).

## Quick start

```bash
npm install
npm run dev        # local dev server at http://localhost:5173
npm run build      # production build → dist/
npm run preview    # serve the production build locally
```

Deploy the `dist/` folder to any static host (Netlify, Vercel, S3, nginx…). It must be served over http(s) — opening `index.html` directly from disk won't work.

## Structure

```
index.html            App shell: CDN deps + script load order (ORDER MATTERS)
src/styles/main.css   All styles (processed + minified by Vite)
src/main.js           Entry point for NEW code — write ES modules here
public/js/            The app, split into ordered classic scripts:
  00-helpers.js         utils, toast, icons
  01-supabase-sync.js   Supabase client, data mappers, loaders, background mirror
  01a-sync-queue.js     ★ NEW reliable-write layer (sbWrite + offline retry queue)
  02-state-roles.js     DB/S state, localStorage, roles & permissions
  03-ui-kit.js          shared UI atoms (cards, fields, modal)
  04-nav-shell.js       navigation, topbar, render shell
  05-router-dashboard.js router + dashboard charts
  06-crm.js             CRM (hubs → channels → boards → conversations, kanban, table)
  07-login.js … 19-…    one file per page/feature area
  99-boot.js            boot sequence + session keepalive (loads LAST)
legacy/Bridge.html    untouched original, for reference
```

The `public/js` files share one top-level scope (same semantics as the original single file), so load order in `index.html` must be preserved. New functionality should go in `src/` as ES modules; it runs after all legacy scripts, so all globals (`App`, `DB`, `S`, `sb`, `sbWrite`…) are available.

## Reliability model (new)

All critical writes go through `sbWrite()` (`01a-sync-queue.js`): it refreshes the auth session if needed, checks the response for errors, retries once, and on failure queues the write in localStorage and keeps retrying (on reconnect, on tab focus, every 30s). A small "N changes waiting to sync" pill appears until everything is flushed. Server refreshes never overwrite rows that still have queued local changes.

## Database changes applied (Supabase, additive only)

- `tickets`: + `updated_at`, `reopen_count`, `occurrences` (jsonb), 2 indexes
- `crm_conversations`: + `due_date`, `updated_at`
- new table `crm_reads` (per-user unread tracking) with RLS
- data fix: 13 duplicate open tickets auto-closed, history consolidated onto the newest ticket of each issue

See `BUGFIXES.md` for everything that was broken and how it was fixed.
