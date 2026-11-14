// Ridgeline service worker: keeps the app and its BC data on the phone so it opens and works with no signal.
//   - The page itself: network first (updates show straight away), the saved copy after 4 s or when offline.
//   - Versioned code (?v=…): saved once per version, served from the phone.
//   - BC data, map engine, icons, fonts: served from the phone, refreshed in the background.
//   - Other sites (map tiles, weather, Supabase): untouched; the app handles those itself.
// VER and CORE are stamped by scripts/bump_version.py.
const VER = '20261114203930-16c5f4a';
const CORE = ['js/access.js?v=20261114203930-16c5f4a', 'js/animals.js?v=20261114203930-16c5f4a', 'js/config.js?v=20261114203930-16c5f4a', 'js/db.js?v=20261114203930-16c5f4a', 'js/elevation.js?v=20261114203930-16c5f4a', 'js/exporters.js?v=20261114203930-16c5f4a', 'js/icons.js?v=20261114203930-16c5f4a', 'js/licences.js?v=20261114203930-16c5f4a', 'js/limits.js?v=20261114203930-16c5f4a', 'js/main.js?v=20261114203930-16c5f4a', 'js/map.js?v=20261114203930-16c5f4a', 'js/mvpr.js?v=20261114203930-16c5f4a', 'js/route.js?v=20261114203930-16c5f4a', 'js/rut.js?v=20261114203930-16c5f4a', 'js/search.js?v=20261114203930-16c5f4a', 'js/seasons.js?v=20261114203930-16c5f4a', 'js/terrain.js?v=20261114203930-16c5f4a', 'js/util.js?v=20261114203930-16c5f4a', 'js/views/import.js?v=20261114203930-16c5f4a', 'js/views/insights.js?v=20261114203930-16c5f4a', 'js/views/layers.js?v=20261114203930-16c5f4a', 'js/views/log.js?v=20261114203930-16c5f4a', 'js/views/more.js?v=20261114203930-16c5f4a', 'js/views/open.js?v=20261114203930-16c5f4a', 'js/views/sun.js?v=20261114203930-16c5f4a', 'js/views/tags.js?v=20261114203930-16c5f4a', 'js/views/trips.js?v=20261114203930-16c5f4a', 'js/views/wmu.js?v=20261114203930-16c5f4a', 'js/vis.js?v=20261114203930-16c5f4a', 'js/weather.js?v=20261114203930-16c5f4a', 'js/wildlife.js?v=20261114203930-16c5f4a', 'css/app.css?v=20261114203930-16c5f4a'];
const DATA = [
  'hunt-hq-handoff/data/bc_seasons_2026_2028.json', 'hunt-hq-handoff/data/leh_2026.json', 'hunt-hq-handoff/data/leh_zones_2026.geojson',
  'hunt-hq-handoff/data/leh_zone_labels.geojson', 'hunt-hq-handoff/data/wmu_2026.geojson', 'hunt-hq-handoff/data/wmu_labels.geojson',
  'hunt-hq-handoff/data/access.json', 'hunt-hq-handoff/data/harvest_wmu.json', 'hunt-hq-handoff/data/season_notes.json',
  'hunt-hq-handoff/data/motor_vehicle_closures_synopsis_text.md',
  'vendor/maplibre-gl.js', 'vendor/maplibre-gl.css', 'vendor/supabase.js', 'vendor/suncalc.js', 'vendor/togeojson.umd.js', 'vendor/jszip.min.js',
  'manifest.webmanifest', 'brand/ridgeline-icon.svg', 'brand/apple-touch-icon.png', 'brand/icon-192.png',
];
const APP = 'rl-app-' + VER, STATIC = 'rl-static', PAGE = 'rl-page';

async function saveAll(cacheName, urls, fresh) {
  const c = await caches.open(cacheName);
  await Promise.allSettled(urls.map(async (u) => {
    if (!fresh && (await c.match(u))) return;
    const r = await fetch(u, { cache: 'reload' }); if (r.ok) await c.put(u, r);
  }));
}
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(Promise.all([saveAll(APP, CORE, true), saveAll(STATIC, DATA, false), saveAll(PAGE, ['./'], true)]));
});
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('rl-app-') && k !== APP) await caches.delete(k);
  await self.clients.claim();
})()));

const timeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
async function page(req) {
  const c = await caches.open(PAGE);
  const net = fetch(req).then((r) => { if (r.ok) c.put('./', r.clone()); return r; });
  try { return await timeout(net, 4000); }
  catch { return (await c.match('./')) || net; }
}
async function versioned(req) {
  const c = await caches.open(APP);
  // A forced reload (the app's stale-file check) always goes to the network and replaces the saved copy.
  if (req.cache !== 'reload') { const hit = await c.match(req); if (hit) return hit; }
  const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r;
}
async function staleWhileRevalidate(req, e) {
  const c = await caches.open(STATIC); const key = req.url.split('?')[0];
  const hit = await c.match(key);
  const net = fetch(req).then((r) => { if (r.ok) c.put(key, r.clone()); return r; });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') { e.respondWith(page(req)); return; }
  if (url.searchParams.has('v')) { e.respondWith(versioned(req)); return; }
  if (/\/(hunt-hq-handoff\/data|vendor|brand)\/|manifest\.webmanifest$/.test(url.pathname)) e.respondWith(staleWhileRevalidate(req, e));
});
