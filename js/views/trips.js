import * as db from '../db.js?v=20261113044037-e97d428';
import { store, hunters } from '../db.js?v=20261113044037-e97d428';
import { WEAPONS, RESULTS, kindColor } from '../config.js?v=20261113044037-e97d428';
import { esc, opts, modal, closeModal, requestClose, toast, formData, todayISO, num, parseCSV, yearOf } from '../util.js?v=20261113044037-e97d428';
import { normMU } from '../seasons.js?v=20261113044037-e97d428';
import { hunterDatalist, speciesDatalist, spotRow, dateSpan, openSpotForm } from './log.js?v=20261113044037-e97d428';
import { exportCSV } from '../exporters.js?v=20261113044037-e97d428';
import { pickOnMap, closePanel, openPanel } from '../main.js?v=20261113044037-e97d428';
import * as M from '../map.js?v=20261113044037-e97d428';
import * as V from '../vis.js?v=20261113044037-e97d428';
import { tripTitle, tripSpots, harvested } from '../vis.js?v=20261113044037-e97d428';
import { icon, hydrateIcons } from '../icons.js?v=20261113044037-e97d428';
import { glyphSVG, animalFor } from '../animals.js?v=20261113044037-e97d428';

// A hunt = one outing (a day or a multi-day trip). Its kills & sightings are waypoints linked by extra.trip_id.
const ui = { year: '' };
const days = (t) => (t.date_end ? Math.round((new Date(t.date_end) - new Date(t.date_start)) / 864e5) + 1 : 1);
const party = (t) => (t.extra?.party?.length ? t.extra.party : [t.hunter || 'Me']);
const initials = (n) => (n === 'Me' ? 'Me' : n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase());

function tripCard(t) {
  const sp = tripSpots(t); const kills = sp.filter((s) => s.kind === 'kill'); const sights = sp.filter((s) => s.kind === 'sighting');
  const on = V.shown('trips', t.id); const g = animalFor(t.species);
  return `<article class="trip-card ${on ? '' : 'off'}" data-trip="${t.id}" tabindex="0">
    <div class="tc-top"><span class="tc-ico">${g ? glyphSVG(g, { size: 26 }) : icon('route', { size: 22 })}</span>
      <div class="t"><b>${esc(tripTitle(t))}</b><span class="muted">${esc(dateSpan(t))} · ${days(t)} day${days(t) > 1 ? 's' : ''}${t.wmu ? ' · WMU ' + esc(t.wmu) : ''}</span></div>
      <label class="switch" title="Show this hunt's waypoints on the map"><input type="checkbox" data-vtrip="${t.id}" ${on ? 'checked' : ''} aria-label="Show on map"></label></div>
    <div class="tc-stats">
      ${harvested(t) ? `<span class="stat ok">${icon('check', { size: 15 })}${kills.length || 1} harvest${kills.length > 1 ? 's' : ''}</span>` : `<span class="stat">No harvest</span>`}
      ${sights.length ? `<span class="stat">${sights.length} sighting${sights.length > 1 ? 's' : ''}</span>` : ''}
      ${t.animals_seen ? `<span class="stat">${t.animals_seen} animals seen</span>` : ''}
      ${t.hours ? `<span class="stat">${t.hours} h</span>` : ''}
      <span class="party">${party(t).map((p) => `<span class="av" title="${esc(p)}">${esc(initials(p))}</span>`).join('')}</span>
    </div>
    ${kills.length ? `<div class="tc-kills">${kills.map((s) => `<span class="kill-pill"><span class="spot-badge" style="width:20px;height:20px;background:${kindColor('kill')}">${glyphSVG(animalFor(s.species) || 'deer', { size: 14, color: '#fff', bg: kindColor('kill') })}</span>${esc(s.name || 'Kill')}${s.extra?.points ? ` · ${s.extra.points} pt` : ''}<span class="muted"> · ${esc(s.hunter || 'Me')}</span></span>`).join('')}</div>` : ''}
  </article>`;
}

export function render(v) {
  render.v = v; render.detail = null;
  const years = [...new Set(store.trips.map((t) => String(yearOf(t.date_start))))].sort((a, b) => b - a);
  if (ui.year && !years.includes(ui.year)) ui.year = '';
  const list = store.trips.filter((t) => !ui.year || String(yearOf(t.date_start)) === ui.year).sort((a, b) => String(b.date_start).localeCompare(String(a.date_start)));
  const kills = list.reduce((n, t) => n + Math.max(tripSpots(t).filter((s) => s.kind === 'kill').length, t.result === 'harvest' ? 1 : 0), 0);
  const dayCount = list.reduce((n, t) => n + days(t), 0); const succ = list.filter(harvested).length;
  v.innerHTML = `<div class="page-h"><h2>Hunts</h2>
    <div class="row"><button class="primary" id="newTrip">${icon('plus', { size: 18 })}New hunt</button>
    <details class="menu"><summary class="icon-btn" aria-label="More">${icon('dots')}</summary><div class="menu-pop">
      <button data-m="bulk">${icon('list', { size: 18 })}Bulk entry (past seasons)</button><button data-m="csv">${icon('upload', { size: 18 })}Export CSV</button></div></details></div></div>
  ${years.length > 1 ? `<div class="seg" role="group" aria-label="Year" style="margin-bottom:12px"><button data-y="" class="${!ui.year ? 'on' : ''}">All</button>${years.map((y) => `<button data-y="${y}" class="${ui.year === y ? 'on' : ''}">${y}</button>`).join('')}</div>` : ''}
  ${list.length ? `<div class="kpis compact"><div class="kpi"><b>${list.length}</b><span>hunts</span></div><div class="kpi"><b>${dayCount}</b><span>days out</span></div>
    <div class="kpi"><b>${kills}</b><span>harvests</span></div><div class="kpi"><b>${Math.round((succ / list.length) * 100)}%</b><span>hunts with a harvest</span></div></div>` : ''}
  <div class="trip-list">${list.map(tripCard).join('') || `<div class="empty">${icon('route', { size: 22 })}<b>No hunts logged yet</b><span class="muted">Add one, or bulk-enter past seasons from the ⋯ menu.</span></div>`}</div>`;
  v.onchange = (e) => { const id = e.target.dataset.vtrip; if (id) { V.setShown('trips', id, e.target.checked); e.target.closest('.trip-card').classList.toggle('off', !e.target.checked); } };
  v.onclick = (e) => {
    if (e.target.closest('.switch')) return;
    const y = e.target.closest('[data-y]'); if (y) { ui.year = y.dataset.y; render(v); return; }
    const m = e.target.closest('[data-m]')?.dataset.m;
    if (m) { e.target.closest('details.menu')?.removeAttribute('open'); if (m === 'bulk') bulkTrips(); if (m === 'csv') exportCSV(list, 'hunts'); return; }
    const c = e.target.closest('[data-trip]'); if (c) openTrip(c.dataset.trip);
  };
  v.onkeydown = (e) => { const c = e.target.closest?.('[data-trip]'); if (c && e.key === 'Enter') openTrip(c.dataset.trip); };
  v.querySelector('#newTrip').onclick = () => openTripForm({});
}
export function onData(w) {
  if (!['trips', 'spots', 'all', 'prefs'].includes(w) || !render.v?.isConnected) return;
  render.detail ? openTrip(render.detail) : render(render.v);
}

// ---- Hunt detail ----
export async function openTrip(id) {
  const t = store.trips.find((x) => x.id === id); if (!t) return;
  openPanel();
  const v = document.getElementById('view'); render.v = v; render.detail = id;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === 'trips'));
  const sp = tripSpots(t); const kills = sp.filter((s) => s.kind === 'kill'); const sights = sp.filter((s) => s.kind === 'sighting'); const other = sp.filter((s) => !['kill', 'sighting'].includes(s.kind));
  const on = V.shown('trips', t.id);
  const facts = [['Species', t.species], ['WMU', t.wmu], ['Area', t.area], ['Weapon', t.weapon], ['Hours', t.hours], ['Animals seen', t.animals_seen], ['Weather', t.weather], ['Wind', t.wind], ['Temp', t.temp_c != null ? t.temp_c + ' °C' : null]].filter(([, x]) => x != null && x !== '');
  const list = (title, arr) => (arr.length ? `<h3 class="sub-h">${title} <span class="muted tnum">${arr.length}</span></h3>${arr.map((s) => spotRow(s)).join('')}` : '');
  v.scrollTop = 0;
  v.innerHTML = `<div class="detail-h"><button class="small" id="tBack">${icon('chevL', { size: 16 })}Hunts</button>
    <div class="row"><button class="small" id="tEdit">Edit</button></div></div>
  <h2 style="margin-bottom:2px">${esc(tripTitle(t))}</h2>
  <div class="muted">${esc(dateSpan(t))} · ${days(t)} day${days(t) > 1 ? 's' : ''} · ${party(t).map(esc).join(', ')}</div>
  <div class="row" style="margin:12px 0">
    <label class="switch"><input type="checkbox" id="tVis" ${on ? 'checked' : ''}><span>Show on map</span></label>
    <button class="small" id="tFit" ${sp.length ? '' : 'disabled'}>${icon('pin', { size: 16 })}Zoom to hunt</button>
    <button class="small" id="tAdd">${icon('pinPlus', { size: 16 })}Add waypoint</button>
  </div>
  ${facts.length ? `<dl class="facts">${facts.map(([k, x]) => `<div><dt>${k}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl>` : ''}
  ${t.notes ? `<p class="trip-notes">${esc(t.notes)}</p>` : ''}
  ${list('Harvests', kills)}${list('Sightings', sights)}${list('Other spots', other)}
  ${!sp.length ? `<div class="empty">${icon('pin', { size: 22 })}<b>No waypoints on this hunt</b><span class="muted">Add kills and sightings, or set “Hunt” on an existing waypoint.</span></div>` : ''}`;
  hydrateIcons(v);
  v.querySelector('#tBack').onclick = () => render(v);
  v.querySelector('#tEdit').onclick = () => openTripForm(t);
  v.querySelector('#tVis').onchange = (e) => V.setShown('trips', t.id, e.target.checked);
  v.querySelector('#tFit').onclick = () => { if (!V.shown('trips', t.id)) { V.setShown('trips', t.id, true); v.querySelector('#tVis').checked = true; } M.fitTo(sp.map((s) => [s.lon, s.lat])); if (innerWidth <= 760) closePanel(); };
  v.querySelector('#tAdd').onclick = async () => { const ll = await pickOnMap('Tap the map where it was'); openSpotForm({ lat: ll.lat, lon: ll.lng, kind: 'sighting', species: t.species, wmu: t.wmu, extra: { trip_id: t.id } }, true); };
  v.onclick = (e) => {
    if (e.target.closest('[data-act]') || e.target.closest('button,label')) return;
    const row = e.target.closest('[data-fly]'); if (row) { const s = store.spots.find((x) => x.id === row.dataset.fly); if (s) { M.flyTo(s.lon, s.lat, 14); if (innerWidth <= 760) closePanel(); } }
  };
  v.onchange = null; v.onkeydown = null;
}

let last = { hunter: 'Me' };
export function openTripForm(t = {}) {
  const isNew = !t.id; const d = isNew ? { date_start: todayISO(), ...last, ...t } : t;
  const body = modal(`<h3>${isNew ? 'New hunt' : 'Edit hunt'}</h3>
  <form id="tripForm" class="grid2">
    <label class="span2">Name <input name="name" value="${esc(d.name || '')}" placeholder="e.g. Palliser River Elk"></label>
    <label>Start <input type="date" name="date_start" required value="${esc(d.date_start || '')}"></label>
    <label>End <input type="date" name="date_end" value="${esc(d.date_end || '')}"></label>
    <label>Target species <input name="species" list="speciesList" value="${esc(d.species || '')}"></label>
    <label>WMU <input name="wmu" value="${esc(d.wmu || '')}" placeholder="4-24"></label>
    <label class="span2">Who was there <input name="party" list="hunterList" value="${esc((d.extra?.party || [d.hunter || 'Me']).join(', '))}" placeholder="Me, Daniel"></label>
    <label>Result <select name="result">${opts(RESULTS.map((r) => ({ id: r, name: { harvest: 'Harvest', missed: 'Missed a shot', seen: 'Saw game, no harvest', nothing: 'Saw nothing' }[r] })), d.result || 'seen')}</select></label>
    <label>Animals seen <input type="number" name="animals_seen" inputmode="numeric" value="${d.animals_seen ?? ''}"></label>
    <label class="span2">Notes <textarea name="notes" placeholder="How it went, what you saw, what to try next time">${esc(d.notes || '')}</textarea></label>
    <details class="span2 more"><summary>More details</summary><div class="grid2" style="margin-top:8px">
      <label>Area <input name="area" value="${esc(d.area || '')}" placeholder="drainage, road…"></label>
      <label>Weapon <select name="weapon">${opts(WEAPONS, d.weapon, { blank: true })}</select></label>
      <label>Hours hunted <input type="number" step="0.5" name="hours" value="${d.hours ?? ''}"></label>
      <label>Temp °C <input type="number" step="any" name="temp_c" value="${d.temp_c ?? ''}"></label>
      <label>Weather <input name="weather" value="${esc(d.weather || '')}" placeholder="clear, snow, rain…"></label>
      <label>Wind <input name="wind" value="${esc(d.wind || '')}" placeholder="NW 10"></label>
      <label>Lat <input type="number" step="any" name="lat" value="${d.lat ?? ''}"></label>
      <label>Lon <input type="number" step="any" name="lon" value="${d.lon ?? ''}"></label>
      <div class="span2"><button type="button" class="small" id="tPick">Set location on map</button></div></div></details>
    <div class="form-foot span2">${isNew ? '' : '<button type="button" class="danger" id="tDel">Delete</button>'}<span class="dirty-note muted">Unsaved changes</span>
      <button type="button" class="cancel-btn">Cancel</button><button class="primary" type="submit">${isNew ? 'Save hunt' : 'Save changes'}</button></div>
  </form>${hunterDatalist()}${speciesDatalist()}`);
  const f = body.querySelector('form');
  f.querySelector('.cancel-btn').onclick = () => requestClose();
  f.onsubmit = async (e) => {
    e.preventDefault(); const o = formData(f);
    for (const k of ['hours', 'animals_seen', 'temp_c', 'lat', 'lon']) o[k] = num(o[k]);
    o.wmu = normMU(o.wmu) || null;
    const ppl = (o.party || '').split(',').map((x) => x.trim()).filter(Boolean); delete o.party;
    o.hunter = ppl[0] || 'Me'; o.extra = { ...(t.extra || {}), party: ppl.length ? ppl : ['Me'] };
    try {
      if (isNew) { await db.insert('trips', o); last = { species: o.species, weapon: o.weapon, wmu: o.wmu, extra: { party: o.extra.party } }; } else await db.update('trips', t.id, o);
      closeModal(); toast('Hunt saved');
    } catch (err) { toast('Save failed: ' + err.message, 5000); }
  };
  body.querySelector('#tPick').onclick = async () => {
    const keep = formData(f); closeModal(); const ll = await pickOnMap();
    const r = await M.identify(ll, ['wmu']);
    openTripForm({ ...t, ...keep, extra: { ...(t.extra || {}), party: (keep.party || '').split(',').map((x) => x.trim()).filter(Boolean) }, lat: +ll.lat.toFixed(6), lon: +ll.lng.toFixed(6), wmu: keep.wmu || M.wmuFromIdentify(r) || '' });
  };
  body.querySelector('#tDel')?.addEventListener('click', async () => {
    if (!confirm('Delete this hunt? Its waypoints are kept but unlinked.')) return;
    for (const s of tripSpots(t)) { const extra = { ...s.extra }; delete extra.trip_id; await db.update('spots', s.id, { extra }); }
    await db.remove('trips', t.id); closeModal(); if (render.v?.isConnected) render(render.v);
  });
}

const COLS = ['date_start', 'date_end', 'hunter', 'species', 'wmu', 'area', 'weapon', 'hours', 'result', 'animals_seen', 'weather', 'notes'];
function bulkTrips() {
  const body = modal(`<h3>Bulk hunt entry</h3>
  <p class="muted">For past seasons from memory: one row per hunt day or trip. Blank cells carry down from the row above (except notes). Or paste CSV/TSV with these headers: ${COLS.join(', ')}.</p>
  <div class="row"><button id="b10">+10 rows</button><button id="bPaste">Paste CSV…</button></div>
  <div class="scroll-x" style="max-height:55vh;overflow:auto;margin-top:8px"><table><thead><tr>${COLS.map((c) => `<th>${c.replace('_', ' ')}</th>`).join('')}</tr></thead><tbody></tbody></table></div>
  <div class="row" style="margin-top:10px"><button class="primary" id="bSave">Save all</button></div>${hunterDatalist()}${speciesDatalist()}`, { wide: true });
  const tb = body.querySelector('tbody');
  const add = (r = {}) => {
    const tr = document.createElement('tr');
    tr.innerHTML = COLS.map((c) => {
      if (c.startsWith('date')) return `<td><input type="date" data-c="${c}" value="${esc(r[c] || '')}"></td>`;
      if (c === 'weapon') return `<td><select data-c="weapon">${opts(WEAPONS, r.weapon, { blank: true })}</select></td>`;
      if (c === 'result') return `<td><select data-c="result">${opts(RESULTS, r.result, { blank: true })}</select></td>`;
      const t = ['hours', 'animals_seen'].includes(c) ? 'type="number" step="0.5" style="min-width:60px"' : '';
      return `<td><input data-c="${c}" ${t} ${c === 'hunter' ? 'list="hunterList"' : c === 'species' ? 'list="speciesList"' : ''} value="${esc(r[c] ?? '')}"></td>`;
    }).join(''); tb.append(tr);
  };
  for (let i = 0; i < 10; i++) add();
  body.querySelector('#b10').onclick = () => { for (let i = 0; i < 10; i++) add(); };
  body.querySelector('#bPaste').onclick = () => {
    const t = prompt('Paste CSV/TSV with header row:'); if (!t) return;
    [...tb.children].forEach((tr) => { if (![...tr.querySelectorAll('input')].some((i) => i.value)) tr.remove(); });
    parseCSV(t).forEach((r) => add(Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase().trim().replace(/\s+/g, '_'), v]))));
  };
  body.querySelector('#bSave').onclick = async () => {
    const out = []; let prev = {};
    for (const tr of tb.children) {
      const r = {}; tr.querySelectorAll('[data-c]').forEach((el) => (r[el.dataset.c] = el.value.trim() || null));
      if (!r.date_start && !r.species && !r.notes) continue;
      for (const k of ['date_start', 'hunter', 'species', 'wmu', 'area', 'weapon']) if (!r[k] && prev[k]) r[k] = prev[k];
      prev = r; if (!r.date_start) continue;
      out.push({ ...r, hunter: r.hunter || 'Me', wmu: normMU(r.wmu) || null, hours: num(r.hours), animals_seen: num(r.animals_seen), result: r.result || 'nothing' });
    }
    try { await db.insert('trips', out); closeModal(); toast(`Saved ${out.length} hunts`); } catch (e) { toast('Save failed: ' + e.message, 5000); }
  };
}
