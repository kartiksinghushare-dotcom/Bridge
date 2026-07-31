# v73 — progress accuracy + dismissible note (on top of v71/v72 mobile fixes)

## Progress % is now the real number
- The engine clamped every percentage to 100 ("beating the target is Achieved, not 140%").
  Removed: your fleet case (25 → 28, now 28.66) now reads **122%**, not 100%. Floor stays 0;
  sanity ceiling 999%. Bars still fill at 100%.
- Annual = average of quarters now uses each quarter's REAL progress (an overachieved Q1 counts fully).
- Verified with a 12-case unit-test matrix run against the app's own functions — including both of
  your screenshot cases — 12/12 pass.

## The % explains itself
The un-dismissable yellow essay in Progress & Updates is gone. In its place: one neutral line showing
the actual arithmetic — e.g. "122% = (current − start) ÷ (target − start) = (28.66 − 25) ÷ (28 − 25)
— target beaten." It has an × and stays hidden once dismissed (per browser). Every mode is covered
(journey, allowance, compliance, hold-the-line, roll-up, annual), so a wrong-looking % immediately
shows WHY — e.g. Flower Wastage displays "…÷ (0 − 30k) — moving away from the target", exposing the
stored target of 0.

## Also in this build (from v71/v72, not yet live on your Vercel)
Chat bubbles left/right by sender · conversation list reachable on mobile · collapsible OKR filters ·
blue banners removed · floating New-chat button · full-width search · single-line ticket toolbar ·
off-screen filter popovers auto-clamp · 19/19 behavioral tap tests pass, 0 horizontal overflow.
