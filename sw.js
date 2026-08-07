/* ATF Price Calculator — service worker.
   Purpose: make the site installable as an app, and give a basic offline shell.
   Strategy: NETWORK-FIRST for same-origin GETs so a fresh deploy always shows;
   cache is only a fallback when offline. POSTs and cross-origin requests (the
   CRM API on crm2.arihantatf.com) are never touched, so login/vendor/PO calls
   always hit the live network and nothing sensitive is cached. */
const CACHE = 'atf-calc-v2';
const CORE = [
  '/', '/index.html',
  '/xlsx.full.min.js', '/jspdf.umd.min.js', '/jspdf.autotable.min.js',
  '/manifest.json', '/icon-192.png', '/icon-512.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // never intercept CRM writes
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;             // CRM API → straight to network
  e.respondWith((async () => {
    try {
      const net = await fetch(req);
      const c = await caches.open(CACHE);
      c.put(req, net.clone());
      return net;
    } catch (err) {
      const cached = await caches.match(req);
      return cached || caches.match('/index.html');
    }
  })());
});
