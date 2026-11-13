// Minimal service worker: makes Ridgeline installable. It doesn't cache anything yet (always goes to the network),
// so updates show up immediately. Offline support can be added here later.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
