# Deploying v73 — and why the live site still looks old

Your screenshots show bridge-five-plum.vercel.app running the ORIGINAL code — four markers prove it:
the blue "Create an objective…" banner (removed in v72), the always-open filter wall (collapsed in v72),
objective titles crushed one-character-per-line (fixed in v71), and the inline New-conversation form on
mobile (replaced by a floating button in v72). None of my delivered fixes are live yet.

## Steps (Vercel via GitHub)
1. In your local Bridge repo, overwrite these 4 files at the SAME paths:
   - `index.html`
   - `public/js/06-crm.js`
   - `public/js/19-okr-roles-acl.js`
   - `src/styles/main.css`
2. `git add -A && git commit -m "Mobile UI + OKR accuracy (v73)" && git push`
3. Vercel auto-builds. Wait for the deployment to finish.
4. On your phone: hard-refresh (or Safari: Settings → Clear History and Website Data for the site).

## How to verify it's live
- Open the site → View Source (or use desktop): every script tag must end with `?v=73`.
  If you still see `?v=70`, the deploy didn't take.
- The OKR page must have NO blue banner, and a "Filters" button instead of the chip wall.

## Data fix for "Flower Wastage < 120k"
That objective's STORED target is 0 (the modal shows "LIMIT ≤0"), so 30k→70k reads 0% — the math is
right, the target is wrong. Open it → Edit → set the target to 120000 (or switch direction to
"Less than" 120000 for pure compliance). It will then read 77.8% of allowance used / compliant.
