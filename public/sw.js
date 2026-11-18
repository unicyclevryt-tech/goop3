// Scramjet service worker: only intercept Goop's proxied pages.
importScripts('./scram/scramjet.all.js');
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
const base = new URL(self.registration.scope).pathname;
const proxyPrefix = base + 'scramjet/';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Normal site assets, favicon, and recovery page must never depend on proxy IDB.
  if (url.origin !== self.location.origin || !url.pathname.startsWith(proxyPrefix)) return;
  event.respondWith((async () => {
    try {
      await scramjet.loadConfig();
      if (scramjet.route(event)) return await scramjet.fetch(event);
      return fetch(event.request);
    } catch (err) {
      console.error('[Goop] Scramjet storage/route error', err);
      return new Response('Scramjet storage error. Open /repair.html to reset proxy storage.', {
        status:503, headers:{'Content-Type':'text/plain; charset=utf-8'}
      });
    }
  })());
});
