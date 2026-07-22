# Bridge (v3.12)

## v3.12 — CRM restructure: channels removed · boards on the hub · member-scoped filtered views · native Status column · filter every column

- **Channels are gone.** A hub (e.g. **Dubai**) is now the whole workspace: open it and its **boards are tabs right there** — create as many boards (chat or ticket table) and columns as needed straight on the hub. One hub never shows another hub's content. The existing demo channels and their boards/conversations were deleted (per request); the Dubai / Abu Dhabi / Sharjah hubs remain, empty and ready. New boards are created with a name + type picker (Ticket table / Chat) and auto-add the creator as a member. DB: `crm_channels` / `crm_channel_members` no longer used; board access = board members (+ CRM managers).
- **Filtered views under each hub** (sidebar children of the hub): a view is **exactly the hub, mirrored** — the same board tabs (chats included), where each ticket board carries a **saved filter**. Create it with just a name + the people who can see it; then open the view and hit **Set view filter** on any board tab to save that board's conditions (every column filterable). Assigned people see all the hub's boards through the view — filtered — even if they're not members of those boards, and everything they do in it (updates, new tickets, chats) lands on the real boards, so the hub itself always shows everything. Views live in the sidebar with a live matching-count; creator (+ CRM managers) edit name/people/filters, and can **delete a view** from the sidebar (hover → trash), the view's toolbar, or inside Edit view — boards and tickets are never affected. Gated by a new **CRM → Filtered views** permission (built-in roles re-seeded v13: Super Admin / Admin / Manager get it). DB: new `crm_views` table (`filters` = per-board map).
- **Status is a native column** in every ticket table — right after Assignee, an inline dropdown (like Assignee), resizable, driven by the board's custom statuses. The per-board **Statuses** editor (add/rename/recolor/mark-done) got its button back on the board bar, and the ticket details panel now has a Status field too.
- **Every column is filterable.** New **Filter** button on every ticket board: build conditions over Status / Assignee / Priority / Customer / Title / Due date / every custom column (each type gets matching operators — contains, =, >, <, any-of, checked, date has passed…). **Number, currency, date and time columns also take a “between (range)”** — from → to, with either side left open. The same condition builder powers filtered views. Board filters are per-session; view filters are saved.
- **A Chat board always exists by default.** Every hub is created with a Chat board, and any hub found without one is healed automatically on load (deterministic id, so two clients can never double-create it). The three existing hubs were backfilled with their Chat boards (admins added as members).
- Cache-busting bumped to `?v=63`.

# Bridge (v3.11)

## v3.11.2 — dismissible info notes + slimmer CRM sidebar

- **Info notes can be dismissed.** The blue explainer banners (e.g. "This annual objective updates automatically — combined progress of its quarters" in the Progress popup, the Quarterly-view hint, the annual explainer in the editor) now carry an **×** — click it and that note never shows again on this browser (same rule as the "How this tab works" bars). New shared `dismissNote()` helper, ready to reuse on any future note.
- **CRM sidebar: group list removed.** With people-groups created, the sidebar no longer lists every group (each row just opened the same dialog anyway) — one compact **Groups (n)** entry opens the manage dialog; @tags, automations and notification fan-out are untouched. Cache-busting bumped to `?v=59`.

## v3.11.1 — feedback fixes

- **Progress popup decluttered**: the rules-summary chip row (Measured / Owner / Dept / Check-ins / Period / Created by / Edit objective) was removed — the popup goes straight to the numbers; rules live in the editor (pencil icon on the card).
- **Users: visible “Template” button** in the page header (next to Download / Bulk upload) — no need to open the upload dialog to get it.
- **Owner picker rebuilt for big teams**: selected owners show as removable chips on top; below them a **search box** (name / email / department) filters the people list live without losing focus; selected people sort first. Cache-busting bumped to `?v=58`.

## v3.11 — OKR: multi-owner group check-ins, per-level departments, clickable summary, multi-select filters, clean cards, full email suite · Users: bulk upload / download / template / search

- **Multiple owners per OKR.** The editor's single "Owner" select is now a checkbox list — tick everyone responsible. **Any owner can edit the objective and fill its check-ins**, and the scheduled check-in behaves like a **group task** (same rule as "any one can complete" checklists): it appears in every owner's My Checklists / due-today panel, and one owner's submission counts for the whole group (cards show *by whom*). Owners always see their own OKRs; visibility scopes, the nav badge and the combined check-in modal all follow the group rule. DB: additive `okrs.owners` (jsonb, backfilled from `owner_id`; `owner_id` stays = `owners[0]` for compatibility).
- **Department & sub-department on every level.** Every objective (not just L0) can carry its own department + sub-department; leaving them empty **inherits from the parent** (cards show the effective one). Moving an objective under a parent no longer wipes its department. Department visibility scope and the filters use the effective (own-or-inherited) department.
- **Clickable summary cards.** The number cards on top (Total / Achieved / On track / Off track / Not achieved / No data / Closed) open a list of exactly the OKRs behind that number — tap any row to open it.
- **Multi-select filters.** Department, sub-department, owner, status and level are all checkbox dropdowns now (like the quarter filter) — pick any combination; the button shows the count; per-filter Clear + a Clear-all.
- **Clean cards — one click, one popup.** The per-card *Rules & Target* and *Progress & Updates* buttons are gone: **clicking an OKR opens the Progress & Updates popup**, which now starts with the goal + a compact rules summary (measured as, owners, department, schedule, period, created by) and an *Edit objective* shortcut — the duplicated Rules & Target panel was removed. Action icons (add sub / move / revise / close / edit / delete) moved into the card's right cluster.
- **OKR emails + in-app alerts, with templates & toggles.** New events: **OKR assigned** (to every owner, on create and when added later), **check-in due (daily)**, **update added** (to co-owners), **target revised**, **closed / reopened**. Each has an editable template (Settings → Templates), an email toggle (Settings → Email → OKRs) and an in-app toggle (Settings → In-App → OKRs); per-user email switches are respected.
  - **Check-in due is truly scheduled server-side**: a new `okr-reminders` edge function runs daily at **09:00 Dubai** (pg_cron `okr-daily-reminders`, 05:00 UTC) — one combined email per owner listing their due OKRs (+ an in-app bell note), deduped via the new `email_log` table, skipping OKRs a co-owner already updated. It reads the same settings/templates the app edits.
- **Users: bulk upload / download / template / search.** The search bar now shows on desktop too. New header buttons: **Download** (.xlsx of everyone you can see) and **Bulk upload** — download the .xlsx template (with a Help sheet listing valid departments/roles), fill it, drop it back: rows are validated (missing fields, bad/duplicate/existing emails, unknown departments/roles, managers resolved by email — including users created earlier in the same file), previewed, then created as **real login accounts** via the create-user function with live progress. Passwords come from the file's Password column; **blank = auto-generated** and shown once in the results with a downloadable credentials sheet. (Spreadsheet library loads on demand from CDN.)
- DB (additive): `okrs.owners` jsonb · `email_log` table (RLS, service-role only) · pg_cron job `okr-daily-reminders` · edge function `okr-reminders`.
- Cache-busting bumped to `?v=57`.

# Bridge (v3.10)

## v3.10.2 — Theme polish + compact CRM chat

- **Refined palette** (replaces v3.10.1's copper, which read muddy): interactive accent is now a **deep gold `#8B6B41`** (AA contrast with white text) with hover `#6F5430`, decorative gold stays brand `#D1B68F`, soft fills calmed to `#F5EEE1`, canvas/sidebars to warm porcelain `#F5F3EF`, ink stays Carbon `#13171B`. Same theme on every page — one sweep across all tokens, tailwind config and inline styles.
- **Buttons back to normal case** (the all-caps CTA experiment is gone); success chips (On Time / Submitted / Active / Approved / Resolved) are properly **green** again instead of champagne, and the default "Resolved" ticket status is green too.
- **CRM chat is compact**: message gap cut from ~20px to 7px, slimmer bubbles (7×11px padding, 13px text), smaller avatars (26px), tighter chat header, composer and conversation list rows.
- **Column delete validation**: a board column that still holds values on any ticket can no longer be deleted — the delete is blocked with a message showing how many tickets still use it; clear the values first. Empty columns delete as before (with confirmation).
- **Add members by group**: the Board members and Channel members dialogs now have an "Add a whole group" section — one tap adds every (active) member of a people-group who isn't already in; the button shows how many it will add.
- **Column reorder rebuilt**: drag the ⠿ grip in a column header (the header itself is no longer draggable, so clicking the name to edit and resizing no longer fight the drag). While dragging, a gold insertion bar shows exactly where the column will land — left half of a header inserts before it, right half after — and the dragged column dims. (v=55)
- **Conversations compact everywhere** (chats, tickets, thread panels): consecutive messages from the same person within 5 minutes now **group** — one name header, bubbles 2px apart (9px between speakers). Sender name and time share one line (full date on bubble hover), the separate timestamp row is gone, avatars are 24px, bubbles 6×10px, and the thread side-panel slimmed to 320px with a tighter reply box. A back-and-forth that took a screen now fits in a third of it. (v=56)
- Cache-busting bumped to `?v=54`.

## v3.10.1 — BloomingBox brand theme (BB Brand Guidelines 2023)

The whole UI now follows the BloomingBox brand guidelines:

- **Palette** (was coral/salmon): primary accent is now **Copper `#936659`** with **Gold `#D1B68F`** for light accents/borders, **Champagne `#FFEAD7`** for soft fills, **Leather Brown `#54433C`** for accent text, ink is **Carbon Black `#13171B`**, and the app canvas/sidebars use a **Sand Beige** tint (`#F1ECE4`, borders `#D8CCC0`). Mapped everywhere — tailwind config, CSS tokens (`--c-brand`, `--grad-brand`, focus rings) and every inline style across all pages (CRM, checklists, OKRs, dashboards, settings…).
- **Typography**: Poppins everywhere (the brand's digital primary — already loaded). Primary/brand CTAs now use the brand's button style: **uppercase + wide letter-spacing** (like the guidelines' ADD TO CART). Display headings get subtle tracking.
- **Login screen** rebuilt in brand style: Carbon Black panel, letterspaced `B R I D G E · BY BLOOMINGBOX` wordmark, gold rule + gold/nude glows.
- Cache-busting bumped to `?v=53`.

## v3.10 — CRM: Assignee column, chat fix, renaming, scoped people, resizable columns, People groups

- **Assignee in the table.** Every ticket board's table now shows the built-in **Assignee** column right after the Ticket column — an inline dropdown (gated by CRM → Assign), listing only people on that board/channel. No more creating a custom "Assigned" people column to see it.
- **Ticket chat fixed: scrolling + composer.** Opening a ticket from a table board rendered the message pane without a height constraint, so long threads pushed the message box below the fold with no scrollbar (the chat pane was missing `min-height:0`). The thread now scrolls and the composer (textarea + send, @mentions, image attach) is always visible.
- **Rename everything** (new CRM → **Rename** permission): the sidebar's "Hubs" title is now a workspace label — click it to rename (e.g. "Workspaces", "Cities"); hubs, channels and boards each get a pencil to rename them, synced for everyone.
- **People pickers are scoped to the board.** Person-type columns, the details-panel Assignee, the chat Assign button and every automation picker (assign to…, notify…, person-column values) now list **only members of that board or its channel** — not the whole company. Existing values from non-members still display.
- **Tagging is scoped too.** @mention suggestions and who actually gets notified are limited to people assigned to that channel/board (chat boards and ticket boards alike). `@all` notifies board+channel members only.
- **Resizable columns.** Drag the edge of any table header (Ticket, Assignee, custom columns) to resize. Widths are **shared per board** (stored in `board.settings.colWidths`, no schema change) and only people with CRM → Edit can resize.
- **People groups** (new CRM → **People groups** permission): a Groups section at the bottom of the CRM sidebar. Create a group once (e.g. *Night Shift*) and use it everywhere: tag the whole group with `@NightShift` in any conversation, tick it in automation "notify" actions, in per-board notification rules and in global CRM defaults — in-app + email fan out to every member. Group tags only notify members who can see that board. Stored in `workspace_settings.crm_settings` — no schema change.
- **Permissions:** the CRM area gains **Rename** and **People groups** toggles (Access Control → role → CRM). Built-in roles re-seeded (v12): Super Admin / Administrator / Team Lead-Manager get both; Basic Employee gets neither. Custom roles keep their toggles — flip the two new ones on per role as needed.
- Cache-busting bumped to `?v=52`.

# Bridge (v3.9)

## v3.9.2 — Progress panel shows only the feeders · revised target visible in the editor

- **An annual's Progress & Updates panel now lists ONLY its quarters** (the objectives that actually feed it) with their Q tags — regular L1 sub-objectives no longer appear there; they have their own panels. (With the roll-up override on, all feeding children show, as that's what drives the number.)
- **The edit form now shows the revision**: when a target has been revised, the form shows "Original target" plus an amber **Revised target (drives progress)** field — editable inline, with who/when/why next to it. Changing it updates the revision (logged); clearing it or setting it back to the original removes the revision.

## v3.9.1 — Annual & level-below roll-up: two independent, manual toggles

- **Both toggles are always visible and fully manual** — enabling Annual never touches the roll-up toggle (and vice versa); nothing flips, hides or locks. A one-time data fix cleared the roll-up flag that the old annual toggle had silently set on all 43 existing annuals.
- **Clear precedence when reading the number**: roll-up ON → level-below aggregation drives it (explicit override, shown with an amber "both toggles are on" note in the editor and panels) · Annual ON with roll-up OFF → the **combined progress of its quarters, nothing else** (regular children and own check-ins can't feed it, even with no quarters at all) · both OFF → own check-ins. Cards, panels, graphs and the "Progress source" row all state which source is active.

## v3.9 — Annual progress from quarters · Close status · quarterly hierarchy view

- **Annual progress = combined progress of its quarters, each counting equally.** L0 Q1 done 10% with the rest untouched → the L0 annual reads **2.5%** ("out of all progress"); its current value maps that % onto its own start → target scale, and the graph follows. Only quarter-tagged children feed an annual — an L1's updates never move the L0 annual (the L1's own quarters move the L1). The per-annual "how quarters combine" dropdown was removed — this rule replaces it.
- **Close status (with reason, required).** New 🔒 action on every card: closing freezes the objective — no updates, check-ins, reminders or revisions — but keeps it in the list, greyed with a **Closed** chip (reason on hover), full history intact. Reason + who + when show in Rules & Target; reopen anytime with 🔓. Closed shows in the status filter and a summary card appears when any exist. DB: additive `okrs.closed / closed_reason / closed_at / closed_by` (migration applied).
- **Revision reason is now required** when revising targets, and shows in the **Rules & Target** tab too: `Revised 17 Jul by <name>: 1M → 750k — "reason" · same updates feed both numbers`.
- **Views: Annual / Quarterly only** (All removed; Annual is the default clean tree). **Quarterly view is now a hierarchy**, not a flat list: every quarter nests under the matching quarter of its nearest ancestor annual — an L1's Q1 sits under the L0's Q1, exactly mirroring the annual tree (expanded by default; label-matched; all other filters still apply).

# Bridge (v3.8)

## v3.8.2 — Compact, cleaner OKR cards

- Each objective card is now one slim line: chips · title · **owner as initials only** (full name on hover) · department · period · sub-count. The check-in schedule text left the card (it lives in Rules & Target), "Cur X · Tgt Y" became plain **`4.6% / 8%`**, and the big full-width progress bar is a **small inline meter** next to the % and status.
- **Rules & Target / Progress & Updates** buttons shrunk; the per-card **Update button was removed** — updates are added from the Progress & Updates popup (its "Add update" button). Summary cards slimmed too. Nothing functional changed.

## v3.8.1 — OKR list: fixed ordering + chip alignment

- **Quarters always group together**: under an annual, children now render Q1 → Q2 → Q3 → Q4 (by their period dates) first, then the regular sub-objectives — a sub-objective created between two "add period" batches no longer lands in the middle of the quarters. The flat filtered list follows the same tree order too.
- **Alignment**: the L-level / Q / ANNUAL chips moved into the title line (equal heights, vertically centred, wrap cleanly) and the leading dot/chevron column is one width everywhere — titles line up whether or not a row has chips or children.

## v3.8 — Quarterly OKRs: same level as their annual + editable from the annual

- **Levels**: a quarterly split now sits AT its annual's level — an L0 annual's quarters read **L0 · Q1**, not L1. Children created under a quarter are L1, and deeper nesting stays consistent. The level filter, editor titles and Move preview all follow (a quarter moved under another objective lands at that objective's level).
- **Edit quarters from the annual**: opening an annual objective's editor now shows its quarterly objectives as **editable rows** (label, dates, start value, target) — change them there and Save writes onto each quarterly objective (logged as "via annual editor"; check-in history untouched). A failed validation keeps everything you typed.
- **Two-way sync**: shared fields changed on the annual (title pattern, owner, goal, unit, direction, metric, check-in schedule) follow onto quarters that still match the annual's old value — a quarter you customised by hand keeps its own value. Edits made on a quarter directly appear in the annual's editor next time it opens, and its numbers keep feeding the annual as before.
- No database changes needed.

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
