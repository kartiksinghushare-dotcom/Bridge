# Bridge (v3.7)

## v3.7 — OKR visibility is scope-driven (Access Control) + cache-busting

- **Who sees which OKRs is now set per role (or per person) in Access Control.** The OKRs area gained the standard **“sees”** scope: **Everyone / Their department / Their team / Only their own** — no more hardcoded "admins see all, managers see team". Two rules always hold on top of the scope: owners **always** see objectives they own or created (they have to update them), and everything **below** a visible objective is visible with it.
  - Department scope = objectives owned by people in their department **plus** trees assigned to their department, even if the root's owner sits elsewhere.
  - Per-person overrides work like every other area (Access Control → person → Personal → Override on OKRs).
  - Built-in roles re-seeded: Super Admin & Administrator → everyone · Team Lead / Manager → their team · Basic Employee → only their own. **Custom roles keep their toggles but start at "only their own" — open the role in Access Control and pick its OKR scope.**
- **Cache-busting**: all app scripts in `index.html` now load with `?v=37`. Bump this number whenever you deploy changed JS so browsers stop serving stale files (the reason recent changes "didn't show up").

## v3.6 — Users: one role system + bulk edit

- **Legacy roles removed from the UI.** The Users table, the mobile cards, the Access Control people list and the Hierarchy chart now all show the **assigned Access Control role** (Super Admin / Administrator / Team Lead / Basic Employee / any custom role) — the old Admin/SubAdmin/Manager/User labels are gone everywhere. (The delete-protection for the root Super Admin now keys off the new role too.)
- **Bulk edit users.** Checkboxes on every row (+ select-all in the header). Selecting people raises a bar with **Bulk edit**: tick any mix of **Department · Position · Reports to · Status · Email notifications · Role (Access Control)** and the ticked fields apply to everyone selected in one save. Safety is per-user: circular-hierarchy manager changes are skipped and reported, the last Access Control holder can never lose the role, manager changes record manager-history exactly like the single editor, and every write goes through the reliable `sbWrite` queue. One audit entry summarises the batch.

## v3.5 — OKR: move objectives, annual → quarterly split, view filter

- **Move any objective** (✥ button on every card): pick a new parent — any objective at any level, or top level — and the whole subtree moves with it. Loops are impossible (an objective's own branch is excluded); moving to top level asks for the department. Every move is logged (old parent → new parent, old level → new level).
- **Annual objectives with quarterly targets** (toggle in the editor, non-Yes/No metrics): flipping it on suggests **4 quarters** (auto-split from the annual period) each with start/end dates, a start value and a target — keep 2, add 6, rename or re-date them freely. Saving creates one linked objective per period: **same owner, same metric/unit/schedule — only dates and targets differ**, shown nested under the annual with a `Q1` tag.
  - The annual number then updates **automatically from the quarters** — a per-objective field picks how: **Latest update / Total / Average / Highest / Lowest** (the suggested quarterly values re-fill to match the mode). The annual itself never asks for check-ins; the quarters carry the schedule.
  - Existing quarters are edited from the tree like any objective; more periods can be added from the annual's editor later. Turning the toggle off keeps the children (nothing is deleted).
  - DB: additive `okrs.is_annual` + `okrs.quarter_label` (migration applied); the annual↔quarters link reuses the roll-up engine with a new `latest` mode.
- **Quarter filter got a view switch** — **All / Annual / Quarterly** on top of the existing Q1–Q4 · year picker: *Annual* keeps the tree but hides the quarterly splits; *Quarterly* lists only the quarterly objectives (narrowed by the selected quarters); *All* behaves as before.

## v3.4 — OKR revisions (original vs revised, side by side)

- **Revise targets without touching the original.** The ↻ button on any OKR card (or "Revise targets" in its progress panel) opens one compact screen listing the objective **and its quarterly sub-objectives** — set new targets for any of them, add one reason note, save. Entering the original value removes that revision.
- **One input stream feeds both.** Check-ins keep working exactly as before; the same updates fill the original and the revised goal — no double entry.
- **Compared on the same screen:** cards show `Tgt ~~1M~~ → 750k` with a "Revised" tag; the progress panel shows two bars (**vs revised / vs original**) plus who revised it, when, and why; the graph gains an amber **Revised pace** line next to the original pace and the Actual line.
- Operative status/pace follow the revised goal; the original stays visible for comparison. Every revision and removal is written to the OKR's activity log.
- DB: additive `okrs.revised_target / revised_note / revised_at / revised_by` (migration applied). Also fixed: roll-up objectives' graphs now plot their aggregated value historically.

## v3.3 — OKR quarter filter

- Multi-select **Q1–Q4 dropdown** (with year switcher) at the top of the OKR filter bar. An OKR shows if its period **overlaps** a selected quarter — a 6-month OKR (Jan–Jun) appears under both Q1 and Q2. Parents without their own dates use the span of their sub-objectives; OKRs with no dates at all are hidden while the filter is on. Selection is shown on the button (e.g. "Q1, Q3 · 2026").

## v3.2 — OKR upgrades

- **Big numbers abbreviated**: currency and number OKRs now show `1k / 10k / 1.25M / 1B` instead of `10000000` — on cards, the progress panel, and the check-in feed. Percent and Yes/No metrics are untouched; inputs still take exact values.
- **Auto roll-up from the level below** (per-objective toggle in the editor): an L0 can take its current value from its **direct L1 sub-objectives only** (L1 from L2, and so on — always exactly one level). When enabled you choose how values combine: **Total (sum) / Average / Highest / Lowest**.
  - The owner no longer does manual check-ins on that objective (no reminders, no Update button — it shows "Auto · total of level below").
  - Progress, status and the Actual-vs-Ideal graph all use the rolled-up value, including historically (the graph rebuilds what the aggregate was on each date).
  - Progress is still measured against the objective's own start → target.
  - DB: additive `okrs.rollup` + `okrs.rollup_mode` columns (migration applied).

## v3.1 — deployed-feedback fixes + CRM v3

- **Duplicate tab rows fixed**: router fallbacks re-entered the strip wrapper, stacking two identical hub strips (visible on Dashboard and after clicking Analytics/Team). Pages also kept their own older internal tab bars — removed (Visuals/Cards on Dashboard, All Checklists/Team inside All results).
- **Analytics removed completely** (it duplicated the dashboard): Dashboard hub is now Overview + OKRs; `#analytics` links land on the Dashboard.
- **One "Team"**: the Team pill in the Checklists hub is the only one; it opens the team board directly.
- **Dashboard rebuilt**: one clear page — tappable KPI cards (on-time rate, late, open tickets, approvals waiting, OKRs) that jump to the right tab, three focused charts, and the "open tickets by user" panel.
- **CRM v3 (fully dynamic, ClickUp-style)**:
  - **Custom statuses per board** — add/rename/recolor statuses and mark which count as "done" (Statuses button on every ticket board). They drive the kanban columns, every status dropdown, the open/overdue counters. Stored per board, no schema change.
  - **Kanban quick-add** — "+ New" at the top of every column creates a ticket directly in that status.
  - **Details panel** — open any ticket and everything is editable in one place: status, priority, assignee, due date, customer, all custom fields, plus the activity trail.
  - Tickets whose status is removed are migrated to the first status automatically (and the table's status cell is now an inline dropdown).


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
