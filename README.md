# Bridge (v2)

Shift checklists, escalation tickets and CRM for Shiftly — previously one 8,400-line `Bridge.html`, now a proper Vite project.

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
