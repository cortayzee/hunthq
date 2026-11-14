// Map search: your own waypoints and routes, WMUs and LEH codes, coordinates, BC place names
// (lakes, creeks, peaks, towns: BC Geographical Names) and road names (BC Digital Road Atlas).
// Both BC sources are public WFS layers on openmaps.gov.bc.ca, the same server as the map layers.
import { store } from './db.js?v=20261114004928-4d6f117';
import * as M from './map.js?v=20261114004928-4d6f117';
import { $, esc, parseLatLon, haversineKm } from './util.js?v=20261114004928-4d6f117';
import { icon } from './icons.js?v=20261114004928-4d6f117';
import { spotLabel } from './animals.js?v=20261114004928-4d6f117';
import { REGION_NAMES, regionOf } from './limits.js?v=20261114004928-4d6f117';

const WFS = 'https://openmaps.gov.bc.ca/geo/pub/wfs';
const GNS = 'WHSE_BASEMAPPING.GNS_GEOGRAPHICAL_NAMES_SP';
const DRA = 'WHSE_BASEMAPPING.DRA_DGTL_ROAD_ATLAS_MPAR_SP';

// Every word must start a word in the name: "tunkwa fsr" finds "Tunkwa Creek FSR".
const words = (q) => q.toLowerCase().replace(/[%_*'"\\]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 5);
const cql = (field, ws) => ws.map((w) => `(${field} ILIKE '${w}%' OR ${field} ILIKE '% ${w}%' OR ${field} ILIKE '%-${w}%')`).join(' AND ');
async function wfs(type, props, filter, count, signal) {
  const p = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'pub:' + type, outputFormat: 'application/json',
    srsName: 'EPSG:4326', count: String(count), propertyName: props, CQL_FILTER: filter });
  const r = await fetch(`${WFS}?${p}`, { signal }); if (!r.ok) throw new Error('search ' + r.status);
  return (await r.json()).features || [];
}
const near = () => { const c = M.map.getCenter(); return { lat: c.lat, lon: c.lng }; };
const kmFrom = (lat, lon) => { const c = near(); return haversineKm([c.lon, c.lat], [lon, lat]); };
const kmTxt = (km) => (km < 1 ? 'here' : km < 10 ? km.toFixed(1) + ' km' : Math.round(km).toLocaleString('en-CA') + ' km');
const matchRank = (name, ws) => { const n = name.toLowerCase(), q = ws.join(' '); return n === q ? 0 : n.startsWith(q) ? 1 : 2; };
const wmuTxt = (lon, lat) => { const mu = M.wmuAt(lon, lat); return mu ? 'WMU ' + mu : ''; };

// ---- BC Geographical Names ----
function placeKind(type, cls) {
  const t = `${type} ${cls}`.toLowerCase();
  if (/lake|creek|river|pond|slough|marsh|bay|falls|spring|reservoir|lagoon|inlet|channel|water/.test(t)) return 'water';
  if (/mount|peak|ridge|range|hill|pass|plateau|bluff|butte|summit|cliff|glacier|valley|canyon|terrain|landform/.test(t)) return 'peak';
  if (/park|protected|ecological|conservancy|wildlife/.test(t)) return 'tree';
  if (/city|town|village|district|locality|community|municipal|populated|reserve|settlement|resort/.test(t)) return 'home';
  return 'pin';
}
const ZOOM = { water: 13, peak: 13, tree: 12, home: 12, pin: 13 };
// Common names ("Fish Lake" is in BC dozens of times): ask for nearby matches as well as province-wide ones.
function nearBox(d = 1.6) {
  const c = near(), w = d * 1.6;
  return `INTERSECTS(GEOMETRY, SRID=4326;POLYGON((${c.lon - w} ${c.lat - d}, ${c.lon + w} ${c.lat - d}, ${c.lon + w} ${c.lat + d}, ${c.lon - w} ${c.lat + d}, ${c.lon - w} ${c.lat - d})))`;
}
const both = async (type, props, f, n, signal) => {
  const [a, b] = await Promise.all([wfs(type, props, `${f} AND ${nearBox()}`, n, signal), wfs(type, props, f, n, signal)]);
  const seen = new Set(); return [...a, ...b].filter((x) => x.geometry && !seen.has(x.id) && seen.add(x.id));
};
async function places(ws, signal) {
  const fs = await both(GNS, 'GEOGRAPHICAL_NAME,FEATURE_TYPE,FEATURE_CLASS,RELATIVE_LOCATION,GEOMETRY', cql('GEOGRAPHICAL_NAME', ws), 40, signal);
  return fs.filter((f) => f.geometry?.coordinates).map((f) => {
    const p = f.properties; const [lon, lat] = f.geometry.coordinates; const kind = placeKind(p.FEATURE_TYPE || '', p.FEATURE_CLASS || '');
    const km = kmFrom(lat, lon); const type = String(p.FEATURE_TYPE || 'Place').replace(/\s*\(\d+\)$/, '');
    return { group: 'Places', icon: kind, title: p.GEOGRAPHICAL_NAME, sub: [type, wmuTxt(lon, lat), kmTxt(km)].filter(Boolean).join(' · '), note: p.RELATIVE_LOCATION || '',
      score: matchRank(p.GEOGRAPHICAL_NAME, ws) * 600 + Math.min(km, 1500) * 0.6 + (kind === 'pin' ? 60 : 0),
      go: { type: 'place', lat, lng: lon, zoom: ZOOM[kind], label: p.GEOGRAPHICAL_NAME } };
  });
}

// ---- Roads: one result per road, splitting same-named roads that are far apart ("Main St" in every town) ----
const SURF = { paved: 'Paved road', loose: 'Gravel road', rough: 'Rough road', overgrown: 'Overgrown road', seasonal: 'Seasonal road', decommissioned: 'Decommissioned road' };
async function roads(ws, signal) {
  const segs = await both(DRA, 'ROAD_NAME_FULL,ROAD_SURFACE,GEOMETRY', cql('ROAD_NAME_FULL', ws), 300, signal);
  const groups = [];
  for (const s of segs) {
    const name = s.properties.ROAD_NAME_FULL; if (!name) continue;
    const cs = s.geometry.type === 'LineString' ? s.geometry.coordinates : s.geometry.coordinates.flat();
    const [x, y] = cs[0];
    let g = groups.find((g) => g.name === name && x > g.bb[0] - 0.15 && x < g.bb[2] + 0.15 && y > g.bb[1] - 0.1 && y < g.bb[3] + 0.1);
    if (!g) groups.push((g = { name, feats: [], bb: [x, y, x, y], len: {} }));
    g.feats.push(s);
    for (const [px, py] of cs) { g.bb[0] = Math.min(g.bb[0], px); g.bb[1] = Math.min(g.bb[1], py); g.bb[2] = Math.max(g.bb[2], px); g.bb[3] = Math.max(g.bb[3], py); }
    const sf = s.properties.ROAD_SURFACE || ''; g.len[sf] = (g.len[sf] || 0) + 1;
  }
  return groups.map((g) => {
    const lon = (g.bb[0] + g.bb[2]) / 2, lat = (g.bb[1] + g.bb[3]) / 2, km = kmFrom(lat, lon);
    const surf = Object.entries(g.len).sort((p, q) => q[1] - p[1])[0]?.[0];
    const kind = /\bFSR\b/.test(g.name) ? 'Forest service road' : SURF[surf] || 'Road';
    return { group: 'Roads', icon: 'route', title: g.name, sub: [kind, wmuTxt(lon, lat), kmTxt(km)].filter(Boolean).join(' · '),
      score: matchRank(g.name, ws) * 600 + Math.min(km, 1500) * 0.6, go: { type: 'road', name: g.name, feats: g.feats, bb: g.bb } };
  });
}

// ---- Things that live in the app ----
function parseDMS(q) {
  const m = q.match(/(\d{2})[°\s]+(\d{1,2})['′\s]+(\d{1,2}(?:\.\d+)?)["″\s]*([NS])?[,\s]+(\d{2,3})[°\s]+(\d{1,2})['′\s]+(\d{1,2}(?:\.\d+)?)["″\s]*([EW])?/i);
  if (!m) return null;
  const lat = +m[1] + m[2] / 60 + m[3] / 3600, lon = +m[5] + m[6] / 60 + m[7] / 3600;
  return { lat: /s/i.test(m[4] || '') ? -lat : lat, lon: /e/i.test(m[8] || '') ? lon : -lon };
}
function coords(q) {
  if (!/\d/.test(q) || /[a-df-mo-rt-vx-z]{2}/i.test(q.replace(/[NSEW]\b/gi, ''))) return null;
  const c = parseDMS(q) || (/^[\s\d.,°+-]+$/.test(q) ? parseLatLon(q) : null);
  if (!c || !(c.lat > 47 && c.lat < 61 && c.lon > -141 && c.lon < -113)) return null;
  return { group: 'Coordinates', icon: 'target', title: `${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}`, sub: [wmuTxt(c.lon, c.lat), kmTxt(kmFrom(c.lat, c.lon))].filter(Boolean).join(' · '),
    score: -1, go: { type: 'place', lat: c.lat, lng: c.lon, zoom: 14, label: '' } };
}
let lehHunts = null;
function local(q, ws) {
  const out = []; const has = (s) => { const n = String(s || '').toLowerCase(); return ws.every((w) => n.includes(w)); };
  const mu = q.trim().replace(/\s+/g, '').replace(/^wmu/i, '').replace(/^(\d)[-.](\d{1,2})$/, (m, a, b) => `${a}-${+b}`);
  const f = M.WMU_GEO?.features.find((x) => x.properties.id === mu);
  if (f) { const r = regionOf(mu); out.push({ group: 'Units', icon: 'grid', title: 'WMU ' + mu, sub: `Region ${r}${REGION_NAMES[r] ? ', ' + REGION_NAMES[r] : ''}`, score: -2, go: { type: 'wmu', mu, region: r } }); }
  const code = q.trim().replace(/^leh\s*/i, '');
  if (/^\d{4}$/.test(code) && lehHunts) for (const h of lehHunts.filter((h) => h.code === code)) out.push({ group: 'Units', icon: 'tag', title: `LEH ${h.code}`, sub: [h.sp, h.class, h.mus.join(', ')].filter(Boolean).join(' · '), score: -2, go: { type: 'leh', code } });
  const spots = store.spots.filter((s) => has(spotLabel(s)) || has(s.notes)).slice(0, 40).map((s) => ({ group: 'Yours', icon: 'pin', title: spotLabel(s),
    sub: [s.species, s.wmu ? 'WMU ' + s.wmu : '', kmTxt(kmFrom(s.lat, s.lon))].filter(Boolean).join(' · '), score: matchRank(spotLabel(s), ws) * 100 + kmFrom(s.lat, s.lon) * 0.1, go: { type: 'spot', id: s.id } }));
  const tracks = store.tracks.filter((t) => has(t.name)).slice(0, 20).map((t) => ({ group: 'Yours', icon: 'route', title: t.name, sub: [t.source && t.source !== 'drawn' ? 'GPS track' : 'Route', t.distance_km ? (+t.distance_km).toFixed(1) + ' km' : ''].filter(Boolean).join(' · '),
    score: matchRank(t.name, ws) * 100, go: { type: 'track', id: t.id } }));
  return [...out, ...[...spots, ...tracks].sort((a, b) => a.score - b.score).slice(0, 5)];
}

// ---- UI ----
const ORDER = ['Coordinates', 'Units', 'Yours', 'Places', 'Roads'];
const LIMIT = { Places: 7, Roads: 5 };
export function initSearch(onPick) {
  const box = $('#search'), inp = $('#searchQ'), res = $('#searchRes'), clr = $('#searchX');
  import('./views/tags.js?v=20261114004928-4d6f117').then((T) => T.loadLeh()).then((d) => (lehHunts = d.hunts || [])).catch(() => {});
  let items = [], active = -1, ctl = null, timer = 0, seq = 0;
  const cache = new Map();
  const open = (on) => { res.classList.toggle('hidden', !on); inp.setAttribute('aria-expanded', String(on)); box.classList.toggle('open', on); };
  const row = (it, i) => `<li role="option" id="sr${i}" data-i="${i}" class="sr-row${i === active ? ' on' : ''}" aria-selected="${i === active}"><span class="sr-ic sr-${it.icon}">${icon(it.icon, { size: 17 })}</span>
    <span class="sr-t"><b>${esc(it.title)}</b><span>${esc(it.sub || '')}</span>${it.note ? `<span class="sr-note">${esc(it.note)}</span>` : ''}</span></li>`;
  function draw(state = {}) {
    let h = ''; let i = 0;
    for (const g of ORDER) {
      const list = items.filter((x) => x.group === g); if (!list.length) continue;
      h += `<li class="sr-h" role="presentation">${g === 'Yours' ? 'Your map' : g}</li>` + list.map(() => row(items[i], i++)).join('');
    }
    if (state.loading) h += `<li class="sr-msg" role="presentation"><span class="spin" aria-hidden="true"></span>Searching BC places and roads…</li>`;
    else if (state.error && !items.length) h += `<li class="sr-msg" role="presentation">Couldn’t reach the BC place-name service. Check your connection.</li>`;
    else if (!items.length && state.done) h += `<li class="sr-msg" role="presentation">No places or roads match “${esc(inp.value.trim())}”.</li>`;
    res.innerHTML = h; open(!!h);
    inp.setAttribute('aria-activedescendant', active >= 0 ? 'sr' + active : '');
  }
  const setItems = (list) => {
    const by = {}; for (const it of list) (by[it.group] ||= []).push(it);
    items = ORDER.flatMap((g) => (by[g] || []).sort((a, b) => a.score - b.score).slice(0, LIMIT[g] || 8));
    active = items.length ? 0 : -1;
  };
  async function run() {
    const q = inp.value.trim(); const ws = words(q); const me = ++seq;
    clr.classList.toggle('hidden', !q);
    ctl?.abort(); ctl = null;
    if (!q) { items = []; open(false); return; }
    const base = [coords(q), ...local(q, ws)].filter(Boolean);
    const remote = !base.some((x) => x.group === 'Coordinates' || x.group === 'Units') && ws.join('').length >= 2;
    setItems(base); draw({ loading: remote });
    if (!remote) return;
    const key = ws.join(' ') + '|' + M.map.getCenter().toArray().map((v) => v.toFixed(1)).join();
    ctl = new AbortController(); const sig = ctl.signal;
    let err = false; const got = [];
    const take = (p) => p.then((r) => { if (me !== seq) return; got.push(...r); setItems([...base, ...got]); draw({ loading: true }); }).catch((e) => { if (e.name !== 'AbortError') err = true; });
    const hit = cache.get(key);
    if (hit) { got.push(...hit); } else {
      await Promise.all([take(places(ws, sig)), ws.join('').length >= 3 ? take(roads(ws, sig)) : null]);
      if (me !== seq) return; if (!err) cache.set(key, got.slice());
    }
    setItems([...base, ...got]); draw({ done: true, error: err });
  }
  function pick(i) {
    const it = items[i]; if (!it) return;
    seq++; ctl?.abort(); clearTimeout(timer);
    inp.value = it.title; clr.classList.remove('hidden'); open(false); inp.blur();
    onPick(it.go, it);
  }
  inp.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 280); });
  inp.addEventListener('focus', () => { if (inp.value.trim() && items.length) draw(); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!items.length) return; active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; draw(); $('#sr' + active)?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); if (items.length) pick(Math.max(0, active)); else run(); }
    else if (e.key === 'Escape') { if (!res.classList.contains('hidden')) open(false); else { inp.value = ''; clear(); inp.blur(); } }
  });
  res.addEventListener('pointerdown', (e) => e.preventDefault()); // keep focus so the tap lands
  res.addEventListener('click', (e) => { const li = e.target.closest('[data-i]'); if (li) pick(+li.dataset.i); });
  const clear = () => { seq++; ctl?.abort(); items = []; open(false); clr.classList.add('hidden'); onPick(null); };
  clr.onclick = () => { inp.value = ''; clear(); inp.focus(); };
  document.addEventListener('pointerdown', (e) => { if (!box.contains(e.target) && !res.contains(e.target)) open(false); });
  addEventListener('keydown', (e) => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') && !e.metaKey && !e.ctrlKey) { e.preventDefault(); inp.focus(); inp.select(); } });
}
