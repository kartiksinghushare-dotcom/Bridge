/* Bridge — service worker (v3.22)
   Purpose: Web Push while the app is closed + open-the-right-thing on tap.
   Deliberately NO caching: the app keeps loading straight from Vercel so a deploy is live
   immediately (a stale cache would be worse than no cache for an internal tool). */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function(e){
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { try { d = { body: e.data.text() }; } catch (y) {} }
  var title = d.title || 'Bridge';
  var opts = {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: d.tag || d.id || undefined,          // same conversation => replaces instead of stacking
    renotify: true,
    timestamp: d.at ? Date.parse(d.at) : Date.now(),
    data: { link: d.link || '', id: d.id || '' },
    vibrate: [90, 40, 90]
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

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
