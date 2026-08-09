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

## v3.19 — Mobile: chat had no scroll and no composer; OKR cards were bulky

**a. Chat thread didn't scroll and the message box was off-screen (phones).**
`main.css` carries a blunt mobile rule:

```css
#content [style*="display:flex"]:not([style*="flex-direction:column"]):not(…){flex-wrap:wrap}
```

It matched `.crm-chatbody` (inline `display:flex`, a row). In a **wrapping** flex
container the flex line is sized to its content, so `.crm-threadcol` grew to the full
height of the message list instead of being clipped by its parent. Result: `#crm-thread`
never became scrollable, and `.crm-composer` was laid out below the fold — under the
bottom nav. The v3.18 `position:absolute` chat-pane fix was correct and was working; the
wrap rule undid it one level lower, which is why the pane measured right but the column
didn't. The same rule also wrapped the composer row (attach button on one line, textarea
on the next, ~99px tall) and could drop a long bubble underneath its avatar.
→ Fixed: `.crm-chatpane, .crm-chatbody, .crm-threadcol, .crm-composer>div, #crm-thread>div`
are explicitly `flex-wrap:nowrap` (in `06-crm.js`, and repeated in `main.css` next to the
rule that causes it). Verified in headless Chromium at 390×844: thread `scrollHeight`
1780 vs `clientHeight` 658 (scrolls), composer bottom at y=784 = exactly the top of the
60px bottom nav.

**b. Chat density.** The phone view used desktop sizing. Header 9px→6px padding and
15px→14px title, bubbles 13px→12.5px, thread padding 14px→10px, composer 8px→6px with a
38px textarea. The textarea stays at 16px so iOS doesn't zoom the viewport on focus, and
the placeholder shortens to "Message…" on mobile so it fits one line. Header is now 57px
instead of 63px and roughly one extra message fits per screen.

**c. OKR objective cards were bulky and unaligned.** The mobile rule
`.okr-nums{flex:1 1 100%}` pushed the numbers block onto its own full-width line under the
meta, stretching the progress bar across the card and leaving the value, the dash and the
status pill at a different x-position on every card.
→ Redesigned: title on the left, numbers in a fixed right-hand column — current value as
the headline, target under it, then bar / % / status, all right-aligned so every card reads
down the same edge. The leaf bullet is hidden and the checkbox/chevron gutter is 22px+18px
instead of 24px+24px, giving the title ~30px more room. `curTgt` is now two spans
(`.okr-curv` / `.okr-tgt`) so the desktop row still reads "39% ≤ 36%" inline and only the
phone stacks them. Cards dropped from ~110px to ~65-85px.

## v3.20 — @-mention UX + OKR alignment round 2

**Why "still the same" on your phone:** the fixes live in the local Bridge folder; the phone
loads shiftlly.vercel.app, which only updates after `git push` → Vercel build. Verify with
View Source: script tags must say `?v=85`.

**a. @-mention picker.** Was a 240px desktop popover with 30px rows, anchored 58px above the
composer's bottom (wrong once the composer grew). Now anchored `bottom:calc(100% + 6px)` (always
just above the composer at any height), and on phones it becomes a full-width sheet with 46px
thumb-sized rows and 14px names.

**b. Mention chips in bubbles.** The chip style was inline (`#EDF5F7` bg, dark-orange text) —
unreadable inside the sender's own orange bubble. Now a `.crm-tag` class: pale chip in received
bubbles, translucent-white chip with white text in `.crm-mine`.

**c. Composer-density rule leak (self-inflicted in v3.19, caught in testing).**
`.crm-composer>div>button{width:36px}` also matched the mention rows (the sheet lives inside the
composer), collapsing every row to 36px wide. The rule is now scoped to a `.crm-sendrow` class on
the attach/textarea/send row only.

**d. OKR titles finally share ONE left edge.** Parent cards had a chevron gutter, leaf cards
didn't — so titles started at different x-positions card by card. On phones the chevron column is
gone entirely; expanding moved to the "N sub-objectives" chip in the meta line (now a real button,
orange, with a rotating ▾ — it also works on desktop as a second affordance). Child indent capped
at 10px/level on phones (was 16px, up to 80px of a 390px screen).

**e. OKR bars slimmed.** Search/filter toolbar and the Select-all/Export bar: tighter padding,
smaller type, 8px gaps to the list. Search input is 16px so iOS doesn't zoom on focus.
