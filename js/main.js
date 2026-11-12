import * as db from './db.js';
import { store } from './db.js';
import * as M from './map.js';
import { loadSeasons, seasonsFor, openRange, normMU } from './seasons.js';
import { $, $$, esc, toast, closeModal, todayISO, earthLink } from './util.js';
import { REGS_URL } from './config.js';
import { sunInfo } from './views/sun.js';
import { mvprSummary } from './mvpr.js';

const views = {};
const viewModules = {
  layers: () => import('./views/layers.js'), open: () => import('./views/open.js'), log: () => import('./views/log.js'),
  trips: () => import('./views/trips.js'), tags: () => import('./views/tags.js'), insights: () => import('./views/insights.js'),
  import: () => import('./views/import.js'), sun: () => import('./views/sun.js'), more: () => import('./views/more.js'),
};
export const app = { tab: 'layers', date: todayISO(), dropMode: false };

async function showTab(tab) {
  app.tab = tab;
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  const mod = views[tab] || (views[tab] = await viewModules[tab]());
  const v = $('#view'); v.innerHTML = ''; v.scrollTop = 0;
  openPanel();
  await mod.render(v);
  try { localStorage.setItem('hunthq_tab', tab); } catch {}
}
export const rerender = () => showTab(app.tab);
export function openPanel() { $('#app').classList.remove('panel-closed'); setTimeout(() => M.map?.resize(), 50); }
export function closePanel() { $('#app').classList.add('panel-closed'); $('#panel').classList.remove('full'); M.setSelection?.(null); setTimeout(() => M.map?.resize(), 50); }
export async function openWmu(mu, region) {
  const { showWmu } = await import('./views/wmu.js');
  $$('#tabs button').forEach((b) => b.classList.remove('active'));
  openPanel(); const v = $('#view'); v.scrollTop = 0;
  await showWmu(v, mu, { region, date: app.date, onBack: () => showTab(app.tab) });
}
db.onChange((what) => {
  if (['spots', 'tracks', 'all'].includes(what)) M.refreshData();
  if (what !== 'prefs' && views[app.tab]?.onData) views[app.tab].onData(what);
});

// ---- Auth ----
async function boot() {
  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; $('#authMsg').textContent = '';
    try { await db.signIn(f.email.value, f.password.value); start(); } catch (err) { $('#authMsg').textContent = err.message; }
  });
  $('#signupBtn').onclick = async () => {
    const f = $('#authForm'); if (!f.reportValidity()) return;
    try {
      const ok = await db.signUp(f.email.value, f.password.value);
      if (ok) start(); else $('#authMsg').innerHTML = '<span class="ok">Check your email to confirm, then sign in.</span>';
    } catch (err) { $('#authMsg').textContent = err.message; }
  };
  $('#localModeBtn').onclick = (e) => { e.preventDefault(); db.useLocal(); start(); };
  if (await db.restoreSession()) start(); else $('#auth').classList.remove('hidden');
}

let started = false;
async function start() {
  if (started) return; started = true;
  $('#auth').classList.add('hidden'); $('#app').classList.remove('hidden');
  try { await db.loadAll(); } catch (e) { toast('Could not load data: ' + e.message, 6000); console.error(e); }
  await loadSeasons();
  await M.initMap('map', store.prefs);
  $('#baseSel').value = M.mapState().base;
  $('#terrainBtn').classList.toggle('on', M.terrainOn());
  wireUI();
  const t = (() => { try { return localStorage.getItem('hunthq_tab'); } catch { return null; } })();
  if (viewModules[t]) app.tab = t;
}

let saveT;
export function saveMapPrefs() {
  clearTimeout(saveT);
  saveT = setTimeout(() => db.savePrefs({ map: M.mapState() }).catch((e) => console.warn(e)), 2500);
}

function wireUI() {
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
  $('#sheetBtn').onclick = () => { $('#panel').classList.toggle('full'); $('#sheetBtn').textContent = $('#panel').classList.contains('full') ? '▾' : '▴'; };
  $('#menuBtn').onclick = () => ($('#app').classList.contains('panel-closed') ? showTab(app.tab) : closePanel());
  $('#layersBtn').onclick = () => (app.tab === 'layers' && !$('#app').classList.contains('panel-closed') ? closePanel() : showTab('layers'));
  $('#panelX').onclick = closePanel;
  $('#baseSel').onchange = (e) => { M.setBase(e.target.value); saveMapPrefs(); };
  $('#terrainBtn').onclick = (e) => { M.setTerrain(!M.terrainOn()); e.target.classList.toggle('on', M.terrainOn()); saveMapPrefs(); };
  $('#dropBtn').onclick = () => setDropMode(!app.dropMode);
  $('#dropCancel').onclick = (e) => { e.preventDefault(); setDropMode(false); };
  M.map.on('moveend', saveMapPrefs);
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.closest('.modal-x')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); setDropMode(false); } });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const { act, id } = b.dataset;
    if (act === 'edit-spot') (await import('./views/log.js')).openSpotForm(store.spots.find((s) => s.id === id));
    if (act === 'drop-here') { popup?.remove(); (await import('./views/log.js')).openSpotForm({ lat: +b.dataset.lat, lon: +b.dataset.lon, wmu: b.dataset.wmu || '' }); }
    if (act === 'wmu') { popup?.remove(); openWmu(b.dataset.mu, b.dataset.region); }
    if (act === 'trip-here') { popup?.remove(); (await import('./views/trips.js')).openTripForm({ lat: +b.dataset.lat, lon: +b.dataset.lon, wmu: b.dataset.wmu || '' }); }
  });

  document.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-wmuform]')) return; e.preventDefault();
    const mu = normMU(e.target.mu.value); if (mu) { popup?.remove(); openWmu(mu); }
  });
  M.onMapClick(async (e) => {
    if (app.dropMode) {
      setDropMode(false);
      const { openSpotForm } = await import('./views/log.js');
      const form = openSpotForm({ lat: e.lngLat.lat, lon: e.lngLat.lng });
      const res = await M.identify(e.lngLat, ['wmu']);
      const w = M.wmuFromIdentify(res); if (w && form?.wmu && !form.wmu.value) form.wmu.value = w;
      return;
    }
    if (app.pickHandler) { const h = app.pickHandler; app.pickHandler = null; $('#dropHint').classList.add('hidden'); h(e.lngLat); return; }
    const f = M.map.queryRenderedFeatures(e.point, { layers: ['spots-dot', 'tracks-line'] })[0];
    if (f?.layer.id === 'spots-dot') {
      const s = store.spots.find((x) => x.id === f.properties.id);
      if (s) { showPopup(e.lngLat, M.spotPopupHTML(s)); return; }
    }
    if (f?.layer.id === 'tracks-line') {
      const t = store.tracks.find((x) => x.id === f.properties.id);
      if (t) { showPopup(e.lngLat, `<div class="popup"><h4>${esc(t.name || 'Track')}</h4><div class="muted">${esc(t.hunter || '')} · ${t.distance_km ? (+t.distance_km).toFixed(1) + ' km' : ''}</div></div>`); return; }
    }
    identifyPopup(e.lngLat);
  });
}

export function pickOnMap(msg = 'Tap the map to pick a location') {
  return new Promise((res) => {
    app.pickHandler = res; $('#dropHint').firstChild.textContent = msg + ' · '; $('#dropHint').classList.remove('hidden');
    if (innerWidth <= 760) closePanel();
  });
}

function setDropMode(on) {
  app.dropMode = on; $('#app').classList.toggle('drop-mode', on);
  $('#dropBtn').classList.toggle('on', on);
  $('#dropHint').firstChild.textContent = 'Tap the map to place a waypoint · ';
  $('#dropHint').classList.toggle('hidden', !on);
  if (on && innerWidth <= 760) closePanel();
}

let popup;
function showPopup(lngLat, htmlStr) {
  popup?.remove();
  popup = new maplibregl.Popup({ maxWidth: '340px' }).setLngLat(lngLat).setHTML(htmlStr).addTo(M.map);
  return popup;
}

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
async function weather(lat, lng) {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh`);
    const c = (await r.json()).current;
    return `${Math.round(c.temperature_2m)} °C (${Math.round(c.wind_speed_10m)} km/h from ${DIRS[Math.round(c.wind_direction_10m / 45) % 8]})`;
  } catch { return ''; }
}

const BIG_RE = /deer|moose|elk|goat|sheep|caribou|bison/i;
function fitPopup(p) {
  requestAnimationFrame(() => {
    const r = p.getElement()?.getBoundingClientRect(); if (!r) return;
    const top = 60, bottom = innerHeight - (innerWidth <= 760 && !$('#app').classList.contains('panel-closed') ? innerHeight * 0.5 : 0) - 10;
    const dy = r.bottom > bottom ? Math.min(r.bottom - bottom, r.top - top) : r.top < top ? r.top - top : 0;
    if (dy) M.map.panBy([0, dy], { duration: 300 });
  });
}

async function identifyPopup(lngLat) {
  const { lat, lng } = lngLat;
  const head = (wx, wmu = '') => `<div class="pop-head"><div><div class="coords">${lat.toFixed(6)}, ${lng.toFixed(6)}</div><div class="wx">${wx}</div></div>
    <button data-act="drop-here" data-lat="${lat}" data-lon="${lng}" data-wmu="${esc(wmu)}" title="Drop a waypoint here">＋ Waypoint</button></div>`;
  const p = showPopup(lngLat, `<div class="popup">${head('…')}<div class="pop-row"><span class="muted">Looking up WMU &amp; layers…</span></div></div>`);
  const wxP = weather(lat, lng);
  const res = await M.identify(lngLat);
  const wx = await wxP;
  if (!p.isOpen()) return;
  const date = app.date || todayISO();
  const wmuF = res.results.wmu?.feats?.[0];
  const wmu = normMU(M.wmuFromIdentify(res) || '');
  const region = wmuF?.REGION_RESPONSIBLE_NAME || (wmu && seasonsFor(wmu)[0]?.r) || '';
  let h = `<div class="popup">${head(esc(wx), wmu)}`;
  if (!res.ok || !wmu) h += `<div class="pop-row"><div class="t"><span class="muted">${res.ok ? 'No WMU found here.' : `BC map layers didn't answer (${esc(res.error)}).`} Enter a WMU:</span>
    <form class="row" data-wmuform style="margin-top:4px"><input name="mu" placeholder="e.g. 4-24" style="width:90px"><button class="small">Seasons ›</button></form></div></div>`;
  if (wmu) {
    const open = seasonsFor(wmu).filter((r) => openRange(r, date));
    const sp = [...new Set(open.filter((r) => BIG_RE.test(r.sp)).map((r) => r.sp.replace(/ \(.*\)/, '')))];
    const when = date === todayISO() ? 'today' : esc(date);
    h += `<div class="pop-row link" data-act="wmu" data-mu="${esc(wmu)}" data-region="${esc(region)}"><span class="pop-ico">🦌</span>
      <div class="t"><b>WMU ${esc(wmu)}</b><span class="muted">${esc(region)} · ${open.length ? `${open.length} open ${when}${sp.length ? ': ' + esc(sp.slice(0, 3).join(', ')) + (sp.length > 3 ? '…' : '') : ''}` : 'nothing open (general)'}</span></div><span class="chev">›</span></div>`;
  }
  const row = (ico, title, sub) => `<div class="pop-row"><span class="pop-ico">${ico}</span><div class="t"><b>${title}</b>${sub ? `<span class="muted">${sub}</span>` : ''}</div></div>`;
  for (const [id, r] of Object.entries(res.results)) {
    if (id.startsWith('leh')) for (const f of r.feats) h += row('🎯', 'LEH ' + esc(f.LTD_ENTRY_HUNTING_ZONE_LABEL || f.LIMITED_ENTRY_HUNTING_ZONE || 'zone'), esc(f.LTD_ENTRY_HUNTING_ZONE_TYPE || ''));
  }
  for (const id of ['mvpr', 'mvpr_routes']) for (const f of res.results[id]?.feats || []) h += `<div class="pop-row"><span class="pop-ico">🚫</span><div class="t"><b>Motor vehicle restriction</b>${mvprSummary(f, date)}</div></div>`;
  for (const f of res.results.parks?.feats || []) h += row('🌲', esc(f.PROTECTED_LANDS_NAME || f.PARK_NAME || 'Park / protected area'), esc(f.PROTECTED_LANDS_DESIGNATION || 'Check park hunting rules'));
  for (const f of res.results.reserves?.feats || []) h += row('⛔', esc(f.ENGLISH_NAME || f.NAME || 'First Nations reserve'), 'Reserve land: no hunting without permission');
  for (const f of res.results.private?.feats || []) h += row('🏠', 'Private land', esc(f.PID_FORMATTED || f.PID || ''));
  for (const f of res.results.gmz?.feats || []) h += row('▦', 'GMZ ' + esc(f.GAME_MANAGEMENT_ZONE_NAME || f.GAME_MANAGEMENT_ZONE_ID || ''), '');
  for (const [id, r] of Object.entries(res.results)) if (id.startsWith('custom_')) for (const f of r.feats) h += row('◫', esc(r.layer.name), esc(Object.entries(f).filter(([k]) => !/SHAPE|GEOMETRY|OBJECTID/i.test(k)).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(' · ')));
  const s = sunInfo(new Date(date + 'T12:00'), lat, lng);
  h += row('☀️', `Legal light ${s.legalStart} – ${s.legalEnd}`, `Sunrise ${s.sunrise} · sunset ${s.sunset} · ${s.moonIcon} ${esc(s.moonName)} ${s.moonPct}%`);
  h += `<div class="pop-foot"><a href="#" data-act="trip-here" data-lat="${lat}" data-lon="${lng}" data-wmu="${esc(wmu)}">Log a hunt here</a>
    <a href="${earthLink(lat, lng)}" target="_blank" rel="noopener">Google Earth</a>
    <a href="${REGS_URL}" target="_blank" rel="noopener">In-season changes</a></div></div>`;
  p.setHTML(h);
  fitPopup(p);
}

boot();
