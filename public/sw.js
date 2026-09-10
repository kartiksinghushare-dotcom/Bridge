/* Bridge — service worker (v3.27)
   Purpose: Web Push while the app is closed + open-the-right-thing on tap.
   Deliberately NO caching: the app keeps loading straight from Vercel so a deploy is live
   immediately (a stale cache would be worse than no cache for an internal tool).

   Alert rules (mirror of the in-app notification center):
   · If a Bridge window is OPEN on this device, the worker never shows a system notification —
     it hands the payload to the app, which decides (one place, one sound). The app shows its own
     desktop pop-up only when it is in the background. No double alerts.
   · A push that arrives late (queued while the device was asleep/offline) is shown only if it is
     still fresh (< 10 min) OR nothing of the same chat has been shown since; a burst of stale
     pushes on wake-up collapses to one silent-ish card per chat instead of a wall of sounds. */
var STALE_MS = 10 * 60 * 1000;

self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function(e){
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { try { d = { body: e.data.text() }; } catch (y) {} }
  e.waitUntil(handlePush(d));
});

function handlePush(d){
  var title = d.title || 'Bridge';
  var tag = d.tag || d.id || 'bridge';
  var at = d.at ? Date.parse(d.at) : Date.now();
  var stale = isFinite(at) && (Date.now() - at) > STALE_MS;
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
    var open = list.filter(function(c){ return c.url.indexOf(self.location.origin) === 0; });
    if (open.length) {
      /* the app is open on this device → let it decide (it rings/pops once, respects DND, viewing, tab focus) */
      open.forEach(function(c){ try { c.postMessage({ type: 'bb-push', data: d }); } catch (x) {} });
      return;
    }
    return self.registration.getNotifications({ tag: tag }).then(function(existing){
      /* stale + something already on screen for this chat → just refresh the card quietly */
      var quiet = stale && existing && existing.length > 0;
      var opts = {
        body: d.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: tag,                                   // same conversation ⇒ replaces instead of stacking
        renotify: !stale,                           // a fresh push re-alerts; a late one updates silently
        silent: quiet,
        timestamp: isFinite(at) ? at : Date.now(),
        data: { link: d.link || '', id: d.id || '', kind: d.kind || '' },
        vibrate: stale ? [] : [90, 40, 90]
      };
      return self.registration.showNotification(title, opts);
    });
  });
}

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var link = (e.notification.data && e.notification.data.link) || '';
  var url = self.location.origin + '/' + (link ? ('?nl=' + encodeURIComponent(link)) : '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf(self.location.origin) === 0 && 'focus' in c) {
        try { c.postMessage({ type: 'bb-open', link: link }); } catch (x) {}
        return c.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});

/* the app tells the worker when a native (Capacitor) shell wants to route pushes itself */
self.addEventListener('message', function(e){
  if (e.data && e.data.type === 'bb-ping' && e.source) { try { e.source.postMessage({ type: 'bb-pong' }); } catch (x) {} }
});
