# Bridge v98 — paced OKR panel polish: both guide lines, cleaner layout

`public/js/19-okr-roles-acl.js` + cache-buster `?v=98`. No DB changes.

- **Paced threshold graphs now draw BOTH guides:** the flat red dashed cap ("Stay at or below 50k overall") and an amber dashed **budget-so-far slope** ("Budget so far — 543.48 a day"). Status and the green/red dots are still judged against the slope; the cap is the hard limit for the whole period.
- **"Held the line" tile removed on paced (amount) thresholds** — the explainer note still carries the count. Percent thresholds keep the tile (there it counts readings on the good side of the line).
- **Panel layout:** the stat tiles sit in their own row, and **Status + the Add update button share one aligned row** underneath (status left, button right) — no more awkward wrapping when tiles overflow.

---

# Bridge v97 — amount thresholds are daily-split budgets

`public/js/19-okr-roles-acl.js` + cache-buster `?v=97`. No DB changes.

- **OKR: "Less than / Greater than" objectives measured in amounts (number / currency) are now judged as a daily-split budget, not on the average of the reported values.** The threshold is the period's total (≤50k over a 92-day quarter = ≤543.48 a day), and on the day of a report the running total must stay within the **budget so far** (threshold × day ÷ days): day 58 allows 50k × 58 ÷ 92 = 31,521.74, so a running total of 33,518 reads **Off track** even though it is still under 50k. Status is judged on the day of the latest update; once the period closes, the full threshold decides Achieved / Not achieved. (Budget figures are rounded to 2 decimals, and the comparison is inclusive — exactly on the budget is still On track.)
- The panel's **Daily average** tile now shows threshold ÷ days (the allowed amount per day), a new **Budget so far** tile shows what the total may be as of the latest update, and **Held the line** re-counts each update against the budget-so-far of its own day. The graph's red dashed guide is the rising budget slope instead of a flat cap (axis anchored at 0), the dots go green/red against that slope, and the explainer note spells out the arithmetic. The Excel export's Scoring column says "running total vs the daily-split budget".
- **Percent thresholds are untouched** — a ratio is a line to hold, not a pot to spend — they keep the v96-era rule (average of each reported day vs the line). Thresholds without period dates also keep the old rule (nothing to pace by). Manual status marks still beat everything.

---

# Bridge v96 — automations on built-in columns · reminders ARE an automation now · quarterly roll-up sees the level below

`public/js/06-crm.js`, `public/js/18-settings-notifications.js`, `public/js/19-okr-roles-acl.js` + cache-buster `?v=96`.
DB (additive): new `crm_rule_reminders` table + `crm-rule-reminders-every-minute` cron job. The old `crm-column-reminders-every-minute` job was unscheduled (its feature is replaced below); `crm-reminders-every-minute` stays and keeps firing any personal reminders people had already set. Nothing else touched or deleted.

- **Workspace: automations react to (and set) built-in columns.** The "When a column…" trigger now lists **Status, Assignee, Priority, Due date, Customer and Ticket (title)** in a *Built-in columns* group above the board's own columns — with the right conditions per column (Status/Priority "becomes…", Assignee "becomes person/group", Due date "date has passed (checked daily)", text contains/equals…). The **"Set a column value…"** action gets the same list (Assignee stays on the dedicated *Assign to…* action). Changing Status, Priority, Due date or Assignee anywhere in the UI now fires these column triggers; existing rules are untouched.
- **Reminders rebuilt as an automation action — the three old reminder features are gone.** The per-row/message/chat-header ⏰ bells, the "My reminders" block in ticket details, the **⏰ Reminder column type** (the emoji button is gone with it) and the **Column reminder** card were all removed; "+ New rule" goes straight to the rule editor. In their place, every automation rule can now **Set a reminder…**:
  - **Who** — *Only me* (the person who saves the rule — private to them), or any mix of **people and groups**.
  - **When** — the row's **date column** (built-in Due date or any date column) plus a **time column** or a fixed time of day; or one **fixed date & time**. All times are Dubai time.
  - When the trigger fires, the reminder is scheduled; firing it is a **server job (every minute)** that sends the in-app note + email at that exact minute — Bridge open or closed — honouring the Settings toggles (In-App / Email → Workspace reminders) and each person's email switch. One pending reminder per rule+ticket: re-triggering **re-arms** it to the latest date & time; past or empty dates are skipped, and nothing older than a day is ever replayed after an outage.
  - Old boards keep working: any leftover ⏰ Reminder columns are simply hidden, reminders people had already set still fire once (server job unchanged), and existing automation rules run exactly as before.
- **OKR: a quarterly objective's "Auto-update from the level below" now actually sees the level below.** A quarter rarely has real children in the tree — the level below's quarters belong to *their own* annual — so L0·Q1's roll-up used to find nothing. It now aggregates every **matching quarter one level down** (each L1·Q1, exactly the relation the Quarterly view nests by), plus any sub-objectives created directly under the quarter, with double-counting guarded (a child annual is skipped when its quarters already feed in). The **Progress & Updates panel lists the feeding objectives** — "Below-level Q1 objectives — feeding this quarterly (total)" — with the same bars/status chips the annual's quarterly panel has, and the graph, %, status and editor wording all follow. Non-quarterly roll-ups are unchanged.

---

# Bridge v95 — the new-ticket form lives IN the row

`public/js/06-crm.js` + cache-buster `?v=95`. No DB changes.

- No popup: **+ New ticket** opens an entry row at the **top of the table**, one input under each column header — Title + Customer under Ticket, the Assignee picker (people & groups), the Status dropdown, and every custom column in its own cell — ending in an **Add** button (Enter also adds, Esc or × closes). The row stays open after adding, so several tickets can be entered back-to-back.
- Same permissions and behaviour as the v94 form: Status/custom cells need Edit, Assignee needs Assign, assigning at creation notifies like a normal assignment, "created"/"assigned" automations run, and date/time inputs stay grey until committed.

---

# Bridge v94 — New ticket is a full form

`public/js/06-crm.js` + cache-buster `?v=94`. No DB changes.

- **+ New ticket** now opens a form with every field up front — Ticket title (required), Customer, **Assignee** (people & groups), **Status**, **Due date**, and **all of the board's custom columns** — then one **Add ticket** button. The two-field inline row at the top of the table is gone.
- Access rules match the table: title/customer come with Workspace → Create; Status, Due date and custom columns show only with Edit; the Assignee picker only with Assign. Creating with an assignee notifies them (or every group member) exactly like assigning from the table, and "created"/"assigned" automations both run. Date/time fields in the form use the same grey-until-committed treatment as the table (no Safari ghosts).

---

# Bridge v93 — the Remind column is opt-in now

`public/js/06-crm.js` + cache-buster `?v=93`. No DB changes.

- The built-in trailing **Remind** column is gone from ticket tables. Personal ⏰ reminders are now a **column type**: hit **+ Column → ⏰ Reminder** on any board that wants the bell — it behaves like any other column (drag to position, resize, rename, delete) and renders the same per-person bell (each person's own date & time reminder, in-app + email, fires with Bridge closed; the cell stores no data). Reminder columns don't appear in filters, automation column pickers or the details panel (which already has its My-reminders block). Setting reminders from the chat header, message hover and details panel is unchanged.

---

# Bridge v92 — Column reminder lives inside "+ New rule"

`public/js/06-crm.js` + cache-buster `?v=92`. No DB changes.

- The always-visible Column-reminder card is gone. **+ New rule** now asks what to create — **Automation rule** (the existing trigger → actions flow) or **Column reminder** (pick the Date and Time columns, one per board). Once added, the reminder sits **in the rules list** like any other rule, with its own on/off toggle, pencil to edit the columns, and a remove button (with confirmation — columns and values untouched). Everything else about how it fires is unchanged.

---

# Bridge v91 — empty date/time cells can no longer look filled (Safari) · "no assignee" badge

`public/js/06-crm.js` + cache-buster `?v=91`. No DB changes.

- **Safari showed a ghost value in EMPTY date/time cells** (today's date / a default time, in full ink) — an untouched cell looked saved, so rows silently never qualified for column reminders. Empty cells now render **grey** ("Empty — click to pick" on hover) and turn ink only once a value is actually committed. Commits happen on change **and** on blur (Safari sometimes skips change), deduped so column automations never run twice for one edit.
- **Amber "!" badge** on the Time cell when a row has its date & time set but **no assignee** (and isn't done) — hover explains that nobody will be auto-reminded until an Assignee is picked.

---

# Bridge v90 — OKR "Achieved" waits for the end date · column-driven reminders for assignees

Two files (`public/js/19-okr-roles-acl.js`, `public/js/06-crm.js`) + cache-buster `?v=90`. **DB additive only**: `crm_column_reminder_log` table, `crm-column-reminders-every-minute` pg_cron job, `colReminder` setting on one board.

## OKR: Achieved only after the end date
- `okrStatusOf` no longer returns **Achieved** the moment progress hits 100% — before the period's end date it reads **On track**, and flips to Achieved only once the end date has passed. Manual status marks and Closed still win. Threshold/allowance modes were already end-gated; this closes the plain-target path. Editor explainer updated to say so.

## Workspace: Column reminder (assignee pinged at the row's date & time)
- New card at the top of every ticket board's **Automations** dialog: toggle **Column reminder** on, pick the board's **Date** and **Time** columns. At that wall-clock moment (Asia/Dubai) the assignee — or every member of the assigned group — gets an in-app notification + email, fired by an every-minute server job, so it works with everyone's app closed.
- Skips rows missing the date or the time (per choice: no default hour), tickets whose status is a done status, and unassigned rows. Each (ticket, moment) fires at most once — edit the date/time and it re-arms for the new moment; enabling never replays moments older than an hour.
- Permission: same as Automations (Workspace → Edit/Manage). The setting lives in `board.settings.colReminder` and syncs live to all clients (v89 realtime).
- Preconfigured on **Available Date and Time** (Pro x Inventory): Date + Time columns, enabled.
- Note: personal ⏰ reminders were already server-fired every minute (`crm-reminders-every-minute`) — bell column, chat header, message hover, details panel — nothing changed there.

---

# Bridge v89 — Workspace: assign to groups · views built in one dialog · ⏰ Remind-me on every row

One file of logic (`public/js/06-crm.js`) + cache-buster `?v=89`. **DB: one additive column** — `crm_conversations.assigned_group text` (nullable; nothing else touched, nothing deleted).

## Assignee can now be a group
- Every Assignee editor — the table cell, the ticket details panel and the chat-header Assign button — now offers **Groups** (the reusable people-groups) above **People**. Groups offered on a board = groups with at least one active member of that board, the same scoping rule as `@group` tagging; a currently-assigned group always stays visible even if its members left the board.
- Assigning a group notifies **every active member** (except the actor) in-app + email — exactly like assigning a person, personal email toggles respected. The activity log reads *assigned to group “Night Shift”*.
- Group-assigned tickets count as *mine* for every member (search's "mine" scope), and show a 👥 chip in the conversation list, table and panels.
- **Filters understand groups**: the Assignee condition ("is any of") lists groups alongside people — works in board filters and saved view filters alike.
- Automations can **assign to a group** too (the "assign to" action picker gained a Groups section).
- Permission unchanged: Workspace → **Assign** gates person and group assignment alike; without it the cell is read-only.

## Filtered views: boards & filters chosen in the SAME dialog — create and edit
- **New filtered view** now shows every board of the hub with a checkbox (chats included) and a **Set filter** button per ticket board — pick the boards, build each board's conditions (live "n of m match" preview), assign the people, hit Create. No more "create first, then walk every tab".
- **Edit view** is the same dialog: tick to add a board back, untick to remove it, change any board's filter, rename, reshare — one Save writes everything. Unticking never touches the real board; a view must keep at least one board.
- Everything inside the view still works as before: **View filter** button per board tab, **Remove from view**, **Edit view**, delete from the sidebar / toolbar / dialog. Permission unchanged: Workspace → **Filtered views** + creator (or managers).

## ⏰ Remind me — a column on every ticket row
- Every row of every ticket table ends with a bell: pick a date & time (+ optional note) and get an **email + in-app ping** — a *personal* reminder, visible and audible only to you. The bell fills teal with a count when you have upcoming reminders on that ticket; click again to manage/cancel them. Same reminders you could already set from the chat header and details panel — now one click from the table.

## Live for everyone — structure included
- Until now only messages, tickets and hub membership synced live; **adding a column, renaming a board, editing statuses or automations, resizing columns, creating/deleting boards or hubs, changing a filtered view, board membership and people-groups** only appeared for others after a reload. All of it now broadcasts instantly to every open client (DB: those tables were added to the realtime publication — additive, no data touched), with the usual safety net: a periodic reconcile also catches missed events, while rows with queued unsent local writes — and rows created seconds ago whose insert is still on its way — are never clobbered.

## Filtered views: groups can be members too
- The "Who can see this view" picker now lists **Groups** above people — ticking one admits *whoever is in the group at the time*, so editing the group later updates the view's audience automatically. The counter shows the real number of people covered. Stored in the existing `crm_views.members` jsonb — no schema change.

## Views are calmer now
- Inside a filtered view the toolbar shows only what belongs to a view: **New ticket · View filter · Edit view · delete**, plus **Remove from view** next to the tabs. Board administration — **Board members, Rename, + Board, + Column, Statuses, Automations, Delete board** — now lives only on the hub itself, where those changes actually happen. Same permissions as before; one clear rule: *boards are managed on the hub, views only filter them.*

## Remind column, polished
- The header emoji is gone and the per-row button is a quiet ghost bell that tints teal on hover; when you have reminders on a ticket it becomes a soft teal pill with the count inside.

## Access-level fix along the way
- Custom columns used to render **editable-looking cells to people without Workspace → Edit** (typing silently did nothing). They now render as clean read-only values — matching Status and Assignee, which were already properly gated (UI *and* handler).

---

# Bridge v87 — annual OKRs: choose how the quarters combine

One file of logic (`public/js/19-okr-roles-acl.js`) + cache-buster `?v=87`. No database changes — the choice is stored in the existing `rollup_mode` column with a `q-` prefix, so every existing annual keeps its current behaviour until you pick something else.

## "How is this annual calculated from its quarters?"

The annual section of the editor now has a mode dropdown:

- **Combined progress of the quarters** *(default — what every existing annual does today)*: each quarter counts equally; Q1 done 10% with three untouched quarters → 2.5%.
- **Total — sum of the quarterly values**: quarterly current values are added up and measured against the annual's own start → target (set quarterly targets so they add up to the annual one, e.g. 4 × 3M = 12M).
- **Average of the quarterly values**: right for rates/percentages ("hold 90% every quarter").
- **Highest quarterly value** / **Lowest quarterly value**: best (or weakest) quarter is the annual's current value.
- **Latest quarterly update**: the newest reported value is the annual's current value — right for running totals the quarters report cumulatively.

The chosen rule drives the progress %, the Current value, the graph line and the readings that feed threshold judgement; the Progress & Updates panel and the maths explainer say which rule is active. Leaving an annual (toggle off) cleans the stored mode back to a plain roll-up value.

Verified with a 19-case simulation (all modes, negative %, threshold daily-average incl. same-day duplicates, legacy annuals with the old roll-up flag) — **19/19 pass**.

---

# Bridge v86 — OKR scoring fixes + full re-theme (Light Teal · Cream · Gold)

Cumulative. **24 files** (every `public/js/*.js` except `01-supabase-sync.js`/`99-boot.js`, plus `index.html`, `src/main.js`, `src/styles/main.css`, this file). Cache-buster `?v=86`. No database changes — everything below is client logic/presentation.

---

## 1. Greater than / Less than is now judged on the **average of each day**

Threshold objectives (Which way is good? = *Greater than* / *Less than*) used to take their status from the **latest reading** — one good day could hide a bad month. Now every reported day in the period is averaged (last report of a day wins) and **that average** is what must sit on the good side of the line: average on the good side → On track / Achieved, wrong side → Off track / Not achieved. The Progress & Updates panel shows the new **Daily average** figure next to "Held the line", and the editor/help texts explain the rule. (Objectives with no in-period readings fall back to the latest value, so old rows don't flip to No data.)

## 2. Progress % can go **negative**

If the number moves backwards past its start value (start 100 → target 150, reading 80), progress now reads **−40%** instead of being floored at 0. Works for Higher- and Lower-is-better, flows through quarter → annual averaging, and the maths explainer says "moved backwards past the start" instead of pretending it's 0. Bars still render empty at ≤0 — only the figure goes negative (floor −999, ceiling 999 unchanged).

## 3. Annual objectives are **quarters-only** — the roll-up toggle is gone for them

- An **Annual objective** no longer shows the "Auto-update from the level below" toggle; it is always calculated from its **quarterly objectives** (each counting equally). Turning Annual on forces the roll-up flag off; saving an annual clears any stray flag from old data; bulk-edit skips annuals for roll-up.
- **Non-annual** objectives (quarterly and every other level) keep the toggle exactly as before.
- Old annuals that had the roll-up override on now read from their quarters — the override is retired everywhere (progress, current value, graph series, readings).

## 4. Full re-theme — light everywhere: **teal · grey · black · white · cream · gold**

- **Primary/brand**: Energizing Orange (#FF7F11 family) → **deep teal** (#0F766E family) across every button, toggle, focus ring, link, progress fill, chart line and inline style in all 20 JS files + CSS + Tailwind config.
- **Gold** (#C9A227/#D4A72C family) takes celebration & waiting: Achieved chips, ANNUAL/Draft/Admin chips (ex-purple), pending-approval pills, revised-target accents, the logo mark's gradient tip.
- **Cream** canvas (#FAF9F3 + warm paper gradient) with white cards and the existing light grey/ink neutrals.
- **Sidebar is light now** — white→cream gradient, dark teal-grey text, teal active accent (was near-black).
- Login hero stays deep ink-teal with teal/gold accents; info-blues and chip-purples remapped into the teal/gold families; semantic red/green/amber untouched.
- New CSS tokens: `--c-gold`, `--c-gold-ink`, `--c-gold-soft`, `--c-cream` (theme block v7 in `main.css`).

---

# Bridge v77 — three fixes

Cumulative. **7 files**, same repo paths. Cache-buster `?v=77`.
`index.html` · `public/js/01-supabase-sync.js` · `06-crm.js` · `15-questions-escalation.js` · `19-okr-roles-acl.js` · `04-nav-shell.js` · `src/styles/main.css`

---

## 1. "No button to add users on a channel" — there was one, but it was invisible in plain sight

The button existed and rendered fine at 360/390px. The real problem: it was a white `👥 1` chip, and the **board members** button sitting right below the tabs is *also* a white `👥 1` chip. Two identical controls meaning different things — so you tapped one, got board members, and concluded the channel one didn't exist.

Now:

- The **channel** control is a solid dark pill — `👥 Channel 1` — clearly the odd one out in a row of white buttons.
- The **board** control reads `👥 Board 1`.
- (The word is hidden on very narrow screens; the dark/white contrast still separates them.)
- A **channel-people icon now also sits on every hub row in the drawer**, which is where you naturally look on a phone to manage a channel.

Both are permission-gated and have 44px tap targets.

> Side note: while tracing this I found your design layer rewrites *any* button with inline `background:#10262E` into a gradient — and a later rule turns that gradient orange. My first attempt at a dark button silently came out orange because of it. The channel pill now uses a hex that isn't intercepted. Worth knowing if a "dark" button ever turns orange on you elsewhere.

## 2. Workspace notifications now open the actual chat/ticket

Added a nullable `link` column to `notifications` (migration `notifications_deep_link`, applied — additive, nothing else touched). New Workspace alerts carry `crm:<conversationId>`, and clicking one opens **that conversation**, on the right board and hub, marked read and scrolled to the latest message.

Your **existing** notifications predate that column, so they'd have no link — those fall back to matching the quoted title in the message (*"… tagged you in "Return""* → opens Return). Both paths are tested. If the conversation was deleted or isn't yours to see, you land on the Workspace with a quiet note rather than a dead end.

## 3. Add/remove no longer applies before you press Save

Both dialogs — channel **and** board — are now staged edits:

- Adding or removing only changes the list *in the dialog*.
- **Save changes** applies everything in one go: local state, database and everyone else's live screen.
- **Cancel**, the X, or tapping the backdrop discards the lot.
- The confirm prompt for removing *your own* channel access now fires at Save, not mid-edit.
- One toast summarising what happened ("2 added, 1 removed") instead of silent per-click writes.

Adding a whole people-group to a board is staged the same way.

---

## Verification
22 new tests covering all three (button visible/distinct/tappable at 390 **and** 360, drawer entry point, deep link with and without `link`, deleted-conversation fallback, permission check, and staged add/remove/cancel/save for both dialogs) — **22/22 pass**.

Everything prior still green: 13 notification, 17 access-control, 19 live/sticky, 19 mobile tap, 12 progress, 0 missing handlers, 0 horizontal overflow.

## Still open (your call)
- **`optional-rls-hardening.sql`** — included, not applied. Access is still app-enforced only.
- **Assign your people** — only 6 of 40 users have real Workspace assignments.
