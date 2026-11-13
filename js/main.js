import * as db from './db.js?v=20261113164651-0306e63';
import { store } from './db.js?v=20261113164651-0306e63';
import * as M from './map.js?v=20261113164651-0306e63';
import { loadSeasons, seasonsFor, openRange, normMU } from './seasons.js?v=20261113164651-0306e63';
import { $, $$, esc, initTips, toast, closeModal, requestClose, todayISO } from './util.js?v=20261113164651-0306e63';
import { REGS_URL, BASES } from './config.js?v=20261113164651-0306e63';
import { sunInfo } from './views/sun.js?v=20261113164651-0306e63';
import { mvprSummary, mvprStatus } from './mvpr.js?v=20261113164651-0306e63';
import { icon, hydrateIcons } from './icons.js?v=20261113164651-0306e63';
import * as R from './route.js?v=20261113164651-0306e63';
import * as V from './vis.js?v=20261113164651-0306e63';

const views = {};
const viewModules = {
  layers: () => import('./views/layers.js?v=20261113164651-0306e63'), open: () => import('./views/open.js?v=20261113164651-0306e63'), log: () => import('./views/log.js?v=20261113164651-0306e63'),
  trips: () => import('./views/trips.js?v=20261113164651-0306e63'), tags: () => import('./views/tags.js?v=20261113164651-0306e63'), insights: () => import('./views/insights.js?v=20261113164651-0306e63'),
  import: () => import('./views/import.js?v=20261113164651-0306e63'), sun: () => import('./views/sun.js?v=20261113164651-0306e63'), more: () => import('./views/more.js?v=20261113164651-0306e63'),
};
export const app = { tab: 'layers', date: todayISO(), dropMode: false };
const isPhone = () => innerWidth <= 760;
const panelOpen = () => !$('#app').classList.contains('panel-closed');

const TAB_PARENT = { import: 'more', sun: 'insights' };
async function showTab(tab) {
  if (app.tab !== tab) views[app.tab]?.onLeave?.();
  clearSelection(); M.setRoutePreview?.(null);
  app.tab = tab;
  const navTab = TAB_PARENT[tab] || tab; // pages without their own tab light up their parent
  $$('#tabs button').forEach((b) => { const on = b.dataset.tab === navTab; b.classList.toggle('active', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const v = $('#view');
  openPanel();
  let mod;
  try { mod = views[tab] || (views[tab] = await viewModules[tab]()); }
  catch (e) { console.error(e); v.innerHTML = loadFail(); return; }
  v.innerHTML = ''; v.scrollTop = 0; v.onclick = v.onchange = v.oninput = v.onkeydown = null; // drop the previous view's handlers
  try { await mod.render(v); } catch (e) { console.error(e); v.innerHTML = loadFail(e); return; }
  hydrateIcons(v);
  try { localStorage.setItem('hunthq_tab', tab); } catch {}
}
export const rerender = () => showTab(app.tab);
export const showTabPublic = (t) => showTab(t);
// If a view can't load (usually a half-updated cache right after a deploy) say so instead of doing nothing.
const loadFail = (e) => `<div class="empty" style="margin-top:24px"><b>This section didn't load</b><span class="muted">The app was probably just updated. Reloading fixes it.${e ? '<br><small>' + esc(String(e.message || e)).slice(0, 140) + '</small>' : ''}</span>
  <button class="primary" onclick="location.reload()">Reload app</button></div>`;
export function openPanel() {
  if (!panelOpen()) { $('#app').classList.remove('panel-closed'); $('#panel').classList.remove('full'); }
  if (!isPhone()) M.map?.setPadding({ left: 400, top: 0, right: 0, bottom: 0 });
  $('#menuBtn')?.setAttribute('aria-expanded', 'true');
}
export function closePanel() {
  $('#app').classList.add('panel-closed'); $('#panel').classList.remove('full');
  M.map?.setPadding({ left: 0, top: 0, right: 0, bottom: 0 });
  $('#menuBtn')?.setAttribute('aria-expanded', 'false');
}
// Selected-WMU indicator on the map: shows which unit is highlighted red; X clears it.
let selEl = null;
export function selChip(label) {
  if (!selEl) {
    selEl = document.createElement('div'); selEl.className = 'map-chip sel-chip hidden';
    selEl.innerHTML = `<span class="dot" style="background:#ff4d4d"></span><span class="t"></span><button aria-label="Clear highlight">${icon('x', { size: 16 })}</button>`;
    selEl.querySelector('button').onclick = () => { clearSelection(); if (!$$('#tabs button.active').length && !$('#app').classList.contains('panel-closed')) showTab(app.tab); };
    $('#app').append(selEl);
  }
  selEl.querySelector('.t').textContent = label || '';
  selEl.classList.toggle('hidden', !label);
}
export function clearSelection() { M.setSelection?.(null); selChip(null); }
export async function openWmu(mu, region) {
  const { showWmu } = await import('./views/wmu.js?v=20261113164651-0306e63');
  $$('#tabs button').forEach((b) => b.classList.remove('active'));
  openPanel(); const v = $('#view'); v.scrollTop = 0; v.onclick = v.onchange = v.oninput = v.onkeydown = null;
  await showWmu(v, mu, { region, date: app.date, onBack: () => showTab(app.tab) });
  selChip(`WMU ${mu} selected`);
  hydrateIcons(v);
}
db.onChange((what) => {
  if (['spots', 'tracks', 'all', 'trips'].includes(what)) V.apply();
  if (what !== 'prefs' && views[app.tab]?.onData && panelOpen()) views[app.tab].onData(what);
});

// ---- Auth ----
async function boot() {
  hydrateIcons(); initTips();
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

// Load everything; on failure keep a banner up (with Retry) instead of silently showing an empty app.
async function loadData() {
  try { await db.loadAll(); syncBanner(null); return true; }
  catch (e) { console.error(e); syncBanner('Couldn\u2019t load your hunts (' + (e.message || 'network error') + '). Your data is safe in your account.'); return false; }
}
function syncBanner(msg) {
  let b = document.getElementById('syncBanner');
  if (!msg) { b?.remove(); return; }
  if (!b) {
    b = document.createElement('div'); b.id = 'syncBanner'; b.className = 'sync-banner'; b.setAttribute('role', 'alert');
    b.innerHTML = '<span class="t"></span><button class="primary">Retry</button>';
    b.querySelector('button').onclick = async () => { b.querySelector('button').disabled = true; if (await loadData()) { V.apply(); views[app.tab]?.onData?.('all'); toast('Hunts loaded'); } else b.querySelector('button').disabled = false; };
    document.getElementById('app').append(b);
  }
  b.querySelector('.t').textContent = msg;
}
async function licReminder() {
  const LIC = await import('./licences.js?v=20261113164651-0306e63'); const due = LIC.due();
  document.querySelector('#tabs [data-tab="more"]')?.classList.toggle('has-dot', due.length > 0);
  if (!due.length) return;
  const today = todayISO(); try { if (localStorage.getItem('hunthq_licnote') === today) return; localStorage.setItem('hunthq_licnote', today); } catch {}
  const l = due[0]; const st = LIC.status(l); const nm = l.name || LIC.TYPES[l.type]?.name || 'A licence';
  setTimeout(() => toast(st.days < 0 ? `${nm} has expired. See More > Licences.` : `${nm} expires in ${st.days} days. Renew it soon.`, 7000), 1500);
}
// Coming back to a tab that sat open: pull fresh data so it never shows (or saves over) an old copy.
document.addEventListener('click', async (e) => { if (e.target.closest('[data-signin]')) { await db.signOut(); location.reload(); } });
function watchFreshness() {
  if (db.getMode() !== 'remote') return;
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (Date.now() - hiddenAt < 60000 || document.querySelector('#modal:not(.hidden)')) return;
    if (await loadData()) { V.apply(); if (panelOpen()) views[app.tab]?.onData?.('all'); }
  });
}

let started = false;
async function start() {
  if (started) return; started = true;
  $('#auth').classList.add('hidden'); $('#app').classList.remove('hidden');
  await loadData();
  watchFreshness();
  licReminder();
  await loadSeasons();
  const saved = store.prefs.map || {};
  await M.initMap('map', store.prefs);
  import('./wildlife.js?v=20261113164651-0306e63').then((W) => { const go = () => (M.map.getLayer('wmu-fill') ? W.restore() : setTimeout(go, 300)); go(); });
  if (saved.pitch && !saved.terrain) M.map.setPitch(0);
  V.apply();
  wireUI();
  syncChrome();
  const t = (() => { try { return localStorage.getItem('hunthq_tab'); } catch { return null; } })();
  if (viewModules[t]) app.tab = t;
}

let saveT;
export function saveMapPrefs() {
  clearTimeout(saveT);
  saveT = setTimeout(() => db.savePrefs({ map: M.mapState() }).catch((e) => console.warn(e)), 2000);
}

// ---- Map chrome ----
// Thumbnail tile near Fernie (z10) for each base map.
const thumb = (b) => b.tiles[0].replace('{z}', 10).replace('{x}', 183).replace('{y}', 345);
function renderBaseGrid() {
  const cur = M.getState().base;
  $('#baseGrid').innerHTML = Object.entries(BASES).map(([id, b]) => `<button class="base-opt" role="radio" aria-checked="${id === cur}" data-base="${id}">
    <span class="thumb" style="background-image:url('${thumb(b)}')"></span>${esc(b.name)}</button>`).join('');
}
function syncChrome() {
  const s = M.getState();
  $('#terrainBtn').setAttribute('aria-pressed', String(s.terrain));
  $('#t3dChk').checked = s.terrain; $('#hillChk').checked = s.hillshade; $('#refChk').checked = M.refOn(); $('#refChk').disabled = !!BASES[s.base]?.ref;
  $('#exagRng').value = s.exag; $('#exagOut').textContent = (+s.exag).toFixed(1) + '×';
  $('#exagRow').classList.toggle('hidden', !s.terrain);
  if (!$('#basePop').classList.contains('hidden')) $$('#baseGrid .base-opt').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.base === s.base)));
}
function toggleBasePop(force) {
  const pop = $('#basePop'); const show = force ?? pop.classList.contains('hidden');
  if (show) {
    renderBaseGrid(); syncChrome();
    const r = $('#baseBtn').getBoundingClientRect();
    pop.style.top = `${r.top}px`; pop.style.right = `${innerWidth - r.left + 10}px`; pop.style.maxHeight = `${innerHeight - r.top - 16}px`;
  }
  pop.classList.toggle('hidden', !show); $('#baseBtn').setAttribute('aria-expanded', String(show));
}

// Bottom-sheet drag on phones: transform follows the finger, then snaps to full / half / closed.
function wireSheet() {
  const panel = $('#panel');
  let y0 = null, base = 0, dy = 0, t0 = 0;
  const start = (e) => {
    if (!isPhone() || e.target.closest('button:not(.sheet-grip)') && !e.target.closest('.sheet-grip')) return;
    y0 = e.clientY; dy = 0; t0 = performance.now();
    base = panel.classList.contains('full') ? 0 : panel.getBoundingClientRect().top - (innerHeight - panel.offsetHeight);
    panel.classList.add('dragging'); panel.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => { if (y0 == null) return; dy = e.clientY - y0; panel.style.transform = `translateY(${Math.max(0, base + dy)}px)`; };
  const end = () => {
    if (y0 == null) return; y0 = null; panel.classList.remove('dragging'); panel.style.transform = '';
    const v = dy / Math.max(1, performance.now() - t0); // px/ms
    const y = base + dy, h = panel.offsetHeight;
    if (v > 0.6 || y > h * 0.75) closePanel();
    else if (v < -0.4 || y < h * 0.22) panel.classList.add('full');
    else panel.classList.remove('full');
  };
  for (const el of [$('.panel-top'), $('.panel-head')]) {
    el.addEventListener('pointerdown', (e) => { if (e.target.closest('#tabs button, #panelX')) return; start(e); });
  }
  panel.addEventListener('pointermove', move); panel.addEventListener('pointerup', end); panel.addEventListener('pointercancel', end);
  $('.panel-top').addEventListener('click', (e) => { if (!e.target.closest('#panelX') && isPhone() && Math.abs(dy) < 4) panel.classList.toggle('full'); });
}

function wireUI() {
  // Map-type + 3D buttons live in MapLibre's top-right stack so they line up under zoom/locate.
  const ctrl = document.createElement('div'); ctrl.className = 'maplibregl-ctrl hq-ctrl';
  ctrl.append($('#baseBtn'), $('#terrainBtn'));
  M.map.addControl({ onAdd: () => ctrl, onRemove: () => ctrl.remove() }, 'top-right');
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
  // One button: opens the panel on the last section used, or closes it.
  $('#menuBtn').onclick = () => (panelOpen() ? closePanel() : showTab(app.tab));
  $('#panelX').onclick = closePanel;
  wireSheet();

  $('#baseBtn').onclick = (e) => { e.stopPropagation(); toggleBasePop(); };
  $('#baseGrid').onclick = (e) => { const b = e.target.closest('[data-base]'); if (!b) return; M.setBase(b.dataset.base); syncChrome(); saveMapPrefs(); };
  $('#refChk').onchange = (e) => { M.setRef(e.target.checked); saveMapPrefs(); };
  $('#hillChk').onchange = (e) => { M.setHillshade(e.target.checked); saveMapPrefs(); };
  $('#t3dChk').onchange = (e) => { M.setTerrain(e.target.checked); syncChrome(); saveMapPrefs(); };
  $('#exagRng').oninput = (e) => { M.setExaggeration(+e.target.value); $('#exagOut').textContent = (+e.target.value).toFixed(1) + '×'; saveMapPrefs(); };
  $('#terrainBtn').onclick = () => { M.setTerrain(!M.terrainOn()); syncChrome(); saveMapPrefs(); };
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#basePop, #baseBtn')) toggleBasePop(false); });
  M.onMapState(syncChrome);

  $('#dropBtn').onclick = () => setDropMode(true);
  $('#routeBtn').onclick = () => { popup?.remove(); setDropMode(false); if (isPhone()) closePanel(); R.start(); };
  $('#dropCancel').onclick = () => { setDropMode(false); if (app.pickHandler) { app.pickHandler = null; $('#app').classList.remove('pick-mode'); } };
  M.map.on('moveend', saveMapPrefs);
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.closest('.modal-x')) requestClose(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { requestClose(); setDropMode(false); toggleBasePop(false); if (R.drawing()) R.stop(); } });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const { act, id } = b.dataset;
    if (act === 'edit-spot') (await import('./views/log.js?v=20261113164651-0306e63')).openSpotForm(store.spots.find((s) => s.id === id));
    if (act === 'drop-here') { popup?.remove(); (await import('./views/log.js?v=20261113164651-0306e63')).openSpotForm({ lat: +b.dataset.lat, lon: +b.dataset.lon, wmu: b.dataset.wmu || '' }); }
    if (act === 'wmu') { e.preventDefault(); popup?.remove(); M.selectWmu(b.dataset.mu); openWmu(b.dataset.mu, b.dataset.region); }
    if (act === 'fc-here') { e.preventDefault(); popup?.remove(); popup = null; const I = views.insights || (views.insights = await viewModules.insights());
      I.openForecast({ lat: +b.dataset.lat, lng: +b.dataset.lon, label: b.dataset.label || '' }); await showTab('insights'); }
    if (act === 'trip-here') { e.preventDefault(); popup?.remove(); (await import('./views/trips.js?v=20261113164651-0306e63')).openTripForm({ lat: +b.dataset.lat, lon: +b.dataset.lon, wmu: b.dataset.wmu || '' }); }
  });
  document.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-wmuform]')) return; e.preventDefault();
    const mu = normMU(e.target.mu.value); if (mu) { popup?.remove(); openWmu(mu); }
  });

  M.onMapClick(async (e) => {
    if (R.drawing()) { R.add(e.lngLat); return; }
    // A tap while a popup is open just closes it (like iHunter) instead of opening another one.
    if (popup?.isOpen() && !app.dropMode && !app.pickHandler) { popup.remove(); popup = null; return; }
    // Tapping outside the highlighted unit clears the highlight.
    if (selEl && !selEl.classList.contains('hidden')) {
      const inSel = M.map.queryRenderedFeatures(e.point, { layers: ['wmu-sel'] }).some((f) => f.state?.sel) || M.map.queryRenderedFeatures(e.point, { layers: ['sel-fill'] }).length > 0;
      if (!inSel) clearSelection();
    }
    if (app.dropMode) {
      setDropMode(false);
      const { openSpotForm } = await import('./views/log.js?v=20261113164651-0306e63');
      const form = openSpotForm({ lat: e.lngLat.lat, lon: e.lngLat.lng });
      const res = await M.identify(e.lngLat, ['wmu']);
      const w = M.wmuFromIdentify(res); if (w && form?.wmu && !form.wmu.value) form.wmu.value = w;
      return;
    }
    if (app.pickHandler) { const h = app.pickHandler; app.pickHandler = null; $('#dropHint').classList.add('hidden'); $('#app').classList.remove('pick-mode'); h(e.lngLat); return; }
    const hit = (layers, r) => M.map.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]], { layers })[0];
    const f = hit(['spots-dot'], 4) || hit(['tracks-line'], 10);
    if (f?.layer.id === 'spots-dot') {
      const s = store.spots.find((x) => x.id === f.properties.id);
      if (s) { showPopup(e.lngLat, M.spotPopupHTML(s)); return; }
    }
    if (f?.layer.id === 'tracks-line') {
      const t = store.tracks.find((x) => x.id === f.properties.id);
      if (t) { popup?.remove(); R.openRoute(t); return; }
    }
    if (app.tab === 'tags' && panelOpen() && M.map.getLayer('lehf-fill')) {
      const fs = M.map.queryRenderedFeatures(e.point, { layers: ['lehf-fill', 'lehf-mu-fill'] });
      if (fs.length) {
        const T = views.tags; const hs = T.huntsAt(fs);
        if (hs.length === 1) { T.pickHunt(hs[0].code); return; }
        if (hs.length > 1) {
          showPopup(e.lngLat, `<div class="popup"><h4>${hs.length} LEH hunts here</h4><div class="leh-pop">${hs.slice(0, 12).map((h) => `<button data-lehpop="${h.code}"><b class="tnum">${h.code}</b><span>${esc(h.sp)} · ${esc(h.class)}</span><span class="muted">${esc(h.dates)}</span></button>`).join('')}</div>${hs.length > 12 ? `<p class="muted">+${hs.length - 12} more in the list</p>` : ''}</div>`);
          return;
        }
      }
    }
    identifyPopup(e.lngLat);
  });
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-lehpop]'); if (!b) return; popup?.remove(); popup = null; views.tags?.pickHunt(b.dataset.lehpop); });
}

export function pickOnMap(msg = 'Tap the map to pick a location') {
  return new Promise((res) => {
    app.pickHandler = res; $('#dropHint .msg').textContent = msg; $('#dropHint').classList.remove('hidden'); $('#app').classList.add('pick-mode');
    if (isPhone()) closePanel();
  });
}

function setDropMode(on) {
  app.dropMode = on; $('#app').classList.toggle('drop-mode', on);
  $('#dropHint .msg').textContent = 'Tap the map to place a waypoint';
  $('#dropHint').classList.toggle('hidden', !on);
  if (on) { popup?.remove(); if (isPhone()) closePanel(); }
}

let popup;
function showPopup(lngLat, htmlStr) {
  popup?.remove();
  popup = new maplibregl.Popup({ maxWidth: `${Math.min(360, innerWidth - 24)}px`, className: 'has-close', focusAfterOpen: false, closeOnClick: false }).setLngLat(lngLat).setHTML(htmlStr).addTo(M.map);
  fitPopup(popup);
  return popup;
}

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
async function weather(lat, lng) {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh`);
    if (!r.ok) return '';
    const c = (await r.json()).current;
    return `${Math.round(c.temperature_2m)} °C · wind ${Math.round(c.wind_speed_10m)} km/h from ${DIRS[Math.round(c.wind_direction_10m / 45) % 8]}`;
  } catch { return ''; }
}

const BIG_RE = /deer|moose|elk|goat|sheep|caribou|bison/i;
function fitPopup(p) {
  requestAnimationFrame(() => {
    const r = p.getElement()?.getBoundingClientRect(); if (!r) return;
    const top = 64, bottom = innerHeight - (isPhone() && panelOpen() ? innerHeight * 0.5 : 90);
    const left = (!isPhone() && panelOpen() ? 400 : 0) + 10, right = innerWidth - (isPhone() ? 10 : 64);
    const dy = r.bottom > bottom ? Math.min(r.bottom - bottom, r.top - top) : r.top < top ? r.top - top : 0;
    const dx = r.left < left ? r.left - left : r.right > right ? Math.min(r.right - right, r.left - left) : 0;
    if (dx || dy) M.map.panBy([dx, dy], { duration: M.reducedMotion() ? 0 : 250 });
  });
}

const ico = (name, cls = '') => `<span class="pop-ico ${cls}">${icon(name, { size: 17 })}</span>`;
async function identifyPopup(lngLat) {
  const { lat, lng } = lngLat;
  const head = (wx, wmu = '') => `<div class="pop-head"><div><div class="coords">${lat.toFixed(6)}, ${lng.toFixed(6)}</div><div class="wx">${wx}</div></div>
    <button data-act="drop-here" data-lat="${lat}" data-lon="${lng}" data-wmu="${esc(wmu)}" aria-label="Drop a waypoint here">${icon('pinPlus', { size: 16 })}Waypoint</button></div>`;
  const p = showPopup(lngLat, `<div class="popup">${head('&nbsp;')}<div class="pop-row">${ico('grid', 'wmu')}<div class="t"><div class="skeleton" style="width:60%"></div><div class="skeleton" style="width:85%;margin-top:6px"></div></div></div></div>`);
  const wxP = weather(lat, lng);
  const res = await M.identify(lngLat);
  const wx = await Promise.race([wxP, new Promise((r) => setTimeout(() => r(''), 1500))]);
  if (!p.isOpen()) return;
  const date = app.date || todayISO();
  const wmuF = res.results.wmu?.feats?.[0];
  const wmu = normMU(M.wmuFromIdentify(res) || '');
  const region = wmuF?.REGION_RESPONSIBLE_NAME || (wmu && seasonsFor(wmu)[0]?.r) || '';
  let h = `<div class="popup">${head(esc(wx) || '&nbsp;', wmu)}`;
  if (!res.ok || !wmu) h += `<div class="pop-row">${ico('info')}<div class="t"><span class="muted">${res.ok ? 'No WMU here.' : 'BC map layers didn’t answer.'} Enter a WMU:</span>
    <form class="row" data-wmuform style="margin-top:6px"><input name="mu" placeholder="e.g. 4-24" style="width:100px" inputmode="text"><button class="small primary">Seasons</button></form></div></div>`;
  if (wmu) {
    const open = seasonsFor(wmu).filter((r) => openRange(r, date));
    const sp = [...new Set(open.filter((r) => BIG_RE.test(r.sp)).map((r) => r.sp.replace(/ \(.*\)/, '')))];
    const when = date === todayISO() ? 'today' : esc(date);
    h += `<a href="#" class="pop-row link" data-act="wmu" data-mu="${esc(wmu)}" data-region="${esc(region)}" style="color:inherit;text-decoration:none">${ico('deer', 'wmu')}
      <div class="t"><b>WMU ${esc(wmu)}</b><span class="muted">${esc(region)} · ${open.length ? `${open.length} open ${when}${sp.length ? ': ' + esc(sp.slice(0, 3).join(', ')) + (sp.length > 3 ? '…' : '') : ''}` : 'nothing open (general seasons)'}</span></div>${icon('chevR', { size: 18, cls: 'chev' })}</a>`;
  }
  const row = (i, title, sub, cls = '') => `<div class="pop-row">${ico(i, cls)}<div class="t"><b>${title}</b>${sub ? `<span class="muted">${sub}</span>` : ''}</div></div>`;
  for (const [id, r] of Object.entries(res.results)) {
    if (id.startsWith('leh')) for (const f of r.feats) h += row('target', 'LEH ' + esc(f.LTD_ENTRY_HUNTING_ZONE_LABEL || f.LIMITED_ENTRY_HUNTING_ZONE || 'zone'), esc(f.LTD_ENTRY_HUNTING_ZONE_TYPE || ''));
    if (id.startsWith('mv_')) for (const f of r.feats) {
      const st = mvprStatus(f, date);
      h += `<div class="pop-row">${ico('ban', st.closed === false ? 'ok' : 'bad')}<div class="t"><b>${esc(f.PROHIBITION_TYPE || r.layer.name)}</b>${mvprSummary(f, date)}</div></div>`;
    }
  }
  for (const f of res.results.parks?.feats || []) h += row('tree', esc(f.PROTECTED_LANDS_NAME || 'Park / protected area'), esc(f.PROTECTED_LANDS_DESIGNATION || 'Check park hunting rules'));
  for (const f of res.results.reserves?.feats || []) h += row('fence', esc(f.ENGLISH_NAME || 'First Nations reserve'), 'Reserve land: no hunting without permission', 'bad');
  for (const f of res.results.private?.feats || []) h += row('home', 'Private land', esc(f.PID_FORMATTED || f.PID || ''));
  const cap = (x) => (x ? String(x).charAt(0).toUpperCase() + String(x).slice(1) : '');
  for (const id of ['rd_main', 'rd_gravel', 'rd_rough', 'rd_over']) for (const f of (res.results[id]?.feats || []).slice(0, 2)) h += row('route', esc(f.ROAD_NAME_FULL || cap(f.ROAD_CLASS) + ' road'), esc([cap(f.ROAD_SURFACE), f.ROAD_CLASS && f.ROAD_NAME_FULL ? f.ROAD_CLASS : ''].filter(Boolean).join(', ')));
  for (const f of (res.results.fsr?.feats || []).slice(0, 2)) h += row('route', esc(f.MAP_LABEL || f.ROAD_SECTION_NAME || 'Forest service road'), 'Forest service road' + (f.GEOGRAPHIC_DISTRICT_NAME ? ', ' + esc(f.GEOGRAPHIC_DISTRICT_NAME.replace(' Natural Resource District', '')) : ''));
  for (const f of (res.results.rec_trails?.feats || []).slice(0, 2)) h += row('route', esc(f.PROJECT_NAME || 'Recreation trail'), 'Recreation trail');
  for (const f of (res.results.rec_sites?.feats || []).slice(0, 2)) h += row('tree', esc(f.PROJECT_NAME || 'Recreation site'), esc([f.NUM_CAMP_SITES ? f.NUM_CAMP_SITES + ' campsites' : '', f.MAINTAIN_STD_DESC].filter(Boolean).join(', ')));
  for (const f of (res.results.cutblocks?.feats || []).slice(0, 1)) h += row('tree', `Cutblock, logged ${esc(f.HARVEST_START_YEAR_CALENDAR || '')}`, f.AREA_HA ? `${Math.round(f.AREA_HA)} ha` : '');
  for (const f of (res.results.burns?.feats || []).slice(0, 1)) h += row('alert', `Wildfire burn, ${esc(f.FIRE_YEAR || '')}`, f.FIRE_SIZE_HECTARES ? `${Math.round(f.FIRE_SIZE_HECTARES).toLocaleString('en-CA')} ha` : '');
  for (const f of res.results.gmz?.feats || []) h += row('grid', 'GMZ ' + esc(f.GAME_MANAGEMENT_ZONE_NAME || f.GAME_MANAGEMENT_ZONE_ID || ''), '');
  for (const [id, r] of Object.entries(res.results)) if (id.startsWith('custom_')) for (const f of r.feats) h += row('layers', esc(r.layer.name), esc(Object.entries(f).filter(([k]) => !/SHAPE|GEOMETRY|OBJECTID/i.test(k)).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(' · ')));
  const s = sunInfo(new Date(date + 'T12:00'), lat, lng);
  h += row('sun', `Legal light ${s.legalStart} – ${s.legalEnd}`, `Sunrise ${s.sunrise} · sunset ${s.sunset} · ${esc(s.moonName)} ${s.moonPct}%`);
  h += `<div class="pop-foot"><a href="#" data-act="fc-here" data-lat="${lat}" data-lon="${lng}">Forecast here</a><a href="#" data-act="trip-here" data-lat="${lat}" data-lon="${lng}" data-wmu="${esc(wmu)}">Log a hunt here</a>
    <a href="${REGS_URL}" target="_blank" rel="noopener">In-season changes</a></div></div>`;
  p.setHTML(h);
  fitPopup(p);
}

// The app is a fixed full-screen surface; never let the document itself scroll (phones do this on focus/scrollIntoView).
// Browsers scroll overflow:hidden boxes to reveal a popup near the edge, which shifts the whole map and its
// controls off-screen. Pin the page, the app and the map container at 0,0.
addEventListener('scroll', (e) => {
  if (scrollY || scrollX) scrollTo(0, 0);
  for (const el of [document.getElementById('app'), document.getElementById('map'), document.querySelector('.maplibregl-canvas-container')]) if (el && (el.scrollTop || el.scrollLeft)) { el.scrollTop = 0; el.scrollLeft = 0; }
}, { passive: true, capture: true });
// iOS browsers ignore user-scalable=no, so a pinch that misses the map zooms the whole page and pushes the
// buttons off the edges. Block page-level pinch/double-tap zoom (the map handles its own gestures).
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 && !e.target.closest('#map')) e.preventDefault(); }, { passive: false });
let lastTouch = 0;
document.addEventListener('touchend', (e) => { const now = Date.now(); if (now - lastTouch < 300 && !e.target.closest('#map, input, textarea, select')) e.preventDefault(); lastTouch = now; }, { passive: false });
// If the page did get zoomed or shifted (visual viewport offset), snap it back.
window.visualViewport?.addEventListener('resize', () => { if (visualViewport.scale > 1.01) { const m = document.querySelector('meta[name=viewport]'); const c = m.content; m.content = c + ',x=1'; requestAnimationFrame(() => (m.content = c)); } });
// GitHub Pages can serve an old copy of a file for a few minutes after a deploy, under the new URL.
// That mixes versions (old CSS, a second copy of a module with empty data). Detect it and heal once.
function checkFresh() {
  const VER = new URL(import.meta.url).searchParams.get('v'); if (!VER) return;
  const css = getComputedStyle(document.documentElement).getPropertyValue('--build').replace(/["']/g, '').trim();
  const stale = performance.getEntriesByType('resource').map((r) => r.name).filter((u) => u.startsWith(location.origin) && /[?&]v=/.test(u) && new URL(u).searchParams.get('v') !== VER);
  if (!stale.length && css === VER) { try { sessionStorage.removeItem('hunthq_heal'); } catch {} return; }
  let tries = 0; try { tries = +sessionStorage.getItem('hunthq_heal') || 0; } catch {}
  if (tries >= 2) { toast('A new version is still rolling out. Reload in a minute if anything looks off.', 6000); return; }
  try { sessionStorage.setItem('hunthq_heal', tries + 1); } catch {}
  const urls = [...new Set(performance.getEntriesByType('resource').map((r) => r.name).filter((u) => u.startsWith(location.origin) && /[?&]v=/.test(u))), location.href.split('#')[0]];
  Promise.allSettled(urls.map((u) => fetch(u, { cache: 'reload' }))).then(() => location.reload());
}
boot();
addEventListener('load', () => setTimeout(checkFresh, 2500));
