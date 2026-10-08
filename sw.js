/* Offline shell. Network-first navigation prevents stale HTML after GitHub Pages updates. */
const CACHE = 'tombola-shell-v1-5';
const ASSETS = ['./','./index.html','./style.css?v=1.5','./app.js?v=1.5','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('tombola-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) { const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put('./index.html',copy)); }
      return response;
    }).catch(() => caches.match('./index.html')));
  } else {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});
