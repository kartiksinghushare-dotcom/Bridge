# Bridge — bug report & fixes

## v3 additions (found while aligning UI with Evarca)

- **Blank icons**: the sidebar section chevrons, profile chevron and the Access Control shield used icon names that didn't exist in Bridge's icon map — they rendered as empty SVGs. Added.
- **⌘K quick search crashed for users with people-access**: it called `scopedUsers()` (an Evarca-only function that doesn't exist in Bridge) and offered screens (Payroll, HR Config…) whose routes don't exist in Bridge. Fixed to use Bridge's own visibility helper and Bridge screens only.
- **Duplicate `const badge`/`BADGE_TONE` declarations** across two modules — in a browser this throws `SyntaxError: Identifier already declared` and would have killed the whole OKR/Access-Control module. Deduplicated (a full sweep confirms zero top-level const/let collisions remain).
- **Broken `.pop` animation**: the modal pop-in referenced `@keyframes uipop` which was never defined. Added.
- **Deep links only worked at boot**: no `hashchange` listener existed, and navigation used `replaceState`, so Back/Forward did nothing. Now pushState + hashchange (Evarca model).
- **Dead "Workflow" settings tab** removed — its four toggles were written to the DB but no code ever read them.


## 1. "Mohit closes a ticket and it reopens hours later" — ROOT CAUSE FOUND

Confirmed from the live database: Mohit's 5 "reopening" tickets were the **same ERP question creating a brand-new identical ticket every day** (Jul 8, 9, 13, 14, 15), plus his closes **never reached the server** (0 tickets closed on the server since Jun 21, despite closes in the UI).

Three compounding causes:

**a. Broken duplicate check.** Escalation dedup ran on the *submitter's* device against their local tickets — but staff can only see tickets assigned to *themselves*, so they could never see the manager's existing ticket. Every daily "Fail" answer created a fresh identical ticket.
→ Fixed: dedup is now **server-side**. A repeat failure **reopens the same ticket** and logs the occurrence on it (visible on the ticket card: "🔁 Reoccurred 4× — last Jul 15"). Same-day re-edits with the same answer are ignored.

**b. Silently lost writes.** supabase-js doesn't throw on API errors — it returns `{error}`, which the code ignored (`.then(()=>{})`). After a tab sat idle for hours the auth token was expired; clicking Close fired a request that failed with 401 and *nobody noticed*. The next background refresh pulled the server's stale "Open" back down — the visible "reopen".
→ Fixed: new reliable-write layer (`sbWrite`, `public/js/01a-sync-queue.js`) — session refresh before writing, error checking, automatic retry, persistent offline queue with a visible "waiting to sync" pill, and refresh protection so a server pull can't clobber a queued local change. Proven by an automated test of the exact scenario.

**c. Open tickets vanishing after 30 days.** Ticket loading filtered by `created_at > 30 days ago`, so an old-but-still-open ticket silently disappeared from the app (and a reopened old ticket would have been invisible).
→ Fixed: queries now fetch `last 30 days OR still Open/In Progress`.

**Data cleanup applied:** 13 duplicate open tickets were auto-closed ("duplicate of …" note), keeping the newest per issue with the full occurrence history. Mohit's list went from 5 copies of the same issue to 1.

## 2. Duplicate function definitions silently overwriting each other

`App._crmDecide`, `App._crmMoveConvo`, `App._crmSaveBoardSettings` were each defined **twice** (two generations of CRM code). The later definition won at runtime, which had real consequences:
- Approve/Reject **no longer moved/resolved the ticket** and never wrote the status/board to the server (older, correct routing logic was dead code).
- The dead `_crmSaveBoardSettings` read form controls that no longer exist and would have wiped board settings if triggered; the live one clobbered other notify settings.
→ Fixed: merged each pair into one function keeping the full behavior (approver permission + approve/reject routing + both notification rule systems), duplicates deleted.

## 3. Swallowed errors on CRM writes

Messages, status/priority changes, assignments, moves, deletes: all wrapped in `try{…}catch(e){}` — a failed write meant silent data loss (and deleted items resurrecting on the next refresh).
→ Fixed: all converted to the reliable-write layer with queued retry.

## 4. Wasteful background sync

The whole-table mirror re-POSTed 9 tables every few seconds even with zero changes (visible in the API logs).
→ Fixed: each table is hashed and only mirrored when its payload actually changed. Also, opening the Tickets page re-sent `viewed_by` for *every* ticket; now only newly-viewed ones.

## 5. Duplicate escalation emails

The escalation path called `queueEmail(…)` twice for every escalation — assignees got two identical emails.
→ Fixed: single send.

## New in the CRM (ClickUp replacement)

- **Kanban board view** for ticket boards (Table ⇄ Board switcher, per board, remembered): columns Open / In Progress / Resolved / Closed with drag-and-drop status changes.
- **Due dates** on tickets — editable in the chat header, table column, and kanban cards; overdue shown red with ⚠, "N overdue" counter per board.
- **Unread tracking** (synced across devices via new `crm_reads` table): unread dot + highlight on conversations, unread badges on board tabs and on the CRM entry in the sidebar.
- **Assignment flow**: assigning a conversation now notifies the assignee (in-app + email) and is recorded in the activity log; status changes are logged too.
- Tickets page: **search box** + assignee filter (for admins), resolution note shown on resolved tickets, reoccurrence history on cards.
