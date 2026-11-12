import * as db from '../db.js?v=20261112230233-4f3bcaf';
import { store, hunters } from '../db.js?v=20261112230233-4f3bcaf';
import { KINDS, SPECIES, WEAPONS, SEXES, kindColor } from '../config.js?v=20261112230233-4f3bcaf';
import { esc, opts, modal, closeModal, requestClose, markDirty, toast, formData, localDT, fmtDT, earthLink, parseLatLon, parseCSV, yearOf } from '../util.js?v=20261112230233-4f3bcaf';
import * as M from '../map.js?v=20261112230233-4f3bcaf';
import { normMU } from '../seasons.js?v=20261112230233-4f3bcaf';
import { pickOnMap, closePanel } from '../main.js?v=20261112230233-4f3bcaf';
import { exportKML, exportGPX, exportCSV } from '../exporters.js?v=20261112230233-4f3bcaf';
import { glyphSVG, glyphFor, animalFor, sexTerms, hasPoints, autoName, spotLabel } from '../animals.js?v=20261112230233-4f3bcaf';
import * as V from '../vis.js?v=20261112230233-4f3bcaf';
import { tripOf, groupOf, tripTitle, spotYear } from '../vis.js?v=20261112230233-4f3bcaf';
import { icon } from '../icons.js?v=20261112230233-4f3bcaf';

const PICK = [['Moose', 'moose'], ['Elk', 'elk'], ['Mule Deer', 'deer'], ['White-tailed Deer', 'deer'], ['Black Bear', 'bear'], ['Grizzly Bear', 'bear'],
  ['Bighorn Sheep', 'sheep'], ['Mountain Goat', 'goat'], ['Caribou', 'caribou'], ['Cougar', 'cougar'], ['Wolf', 'wolf'], ['Coyote', 'wolf'],
  ['Ruffed Grouse', 'grouse'], ['Turkey', 'turkey'], ['Ducks', 'duck'], ['Geese', 'duck'], ['Snowshoe Hare', 'hare']];
const KIND_GLYPH = { kill: null, sighting: null, stand: 'stand', camp: 'camp', trailcam: 'trailcam', access: 'access', service: 'service', note: 'note' };

export const hunterDatalist = () => `<datalist id="hunterList">${hunters().map((h) => `<option value="${esc(h)}">`).join('')}</datalist>`;
export const speciesDatalist = () => `<datalist id="speciesList">${SPECIES.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>`;

// ---- Waypoints page: what's on the map (types / years / hunters), then Groups, Hunts and ungrouped lists ----
const ui = { q: '', open: new Set(['groups', 'hunts', 'loose']) };
const fmtShort = (d) => (d ? new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Vancouver' }) : '');
export const spotBadge = (s, size = 30) => `<span class="spot-badge" style="width:${size}px;height:${size}px;background:${kindColor(s.kind)}">${glyphSVG(glyphFor(s), { size: Math.round(size * 0.66), color: '#fff', bg: kindColor(s.kind) })}</span>`;
export function spotRow(s, { showTrip = false } = {}) {
  const t = tripOf(s);
  const when = s.observed_at ? fmtShort(s.observed_at) : s.extra?.date_range ? 'During hunt' : '';
  const sub = [when, s.hunter && s.hunter !== 'Me' ? s.hunter : '', showTrip && t ? tripTitle(t) : '', s.wmu ? 'WMU ' + s.wmu : ''].filter(Boolean).join(' · ');
  return `<div class="wp-row ${V.isVisible(s) ? '' : 'off'}" data-fly="${s.id}">${spotBadge(s)}<div class="t"><b>${esc(spotLabel(s))}</b><span class="muted">${esc(sub)}</span></div>
    <button class="icon-btn" data-act="edit-spot" data-id="${s.id}" aria-label="Edit ${esc(spotLabel(s))}">${icon('chevR', { size: 18 })}</button></div>`;
}
const chip = (kind, key, label, count, extra = '') => `<button class="f-chip" data-vk="${kind}" data-vkey="${esc(key)}" aria-pressed="${V.shown(kind, key)}">${extra}<span>${esc(label)}</span><span class="n tnum">${count}</span></button>`;

export function filteredSpots() {
  const q = ui.q.toLowerCase();
  return store.spots.filter((s) => !q || [spotLabel(s), s.notes, s.species, s.wmu, s.hunter, tripOf(s) && tripTitle(tripOf(s)), groupOf(s)?.name].join(' ').toLowerCase().includes(q));
}

export function render(v) {
  const all = store.spots; const list = filteredSpots();
  const years = [...new Set(all.map(spotYear))].sort((a, b) => (a === 'none' ? 1 : b === 'none' ? -1 : b - a));
  const kinds = KINDS.filter((k) => all.some((s) => (s.kind || 'note') === k.id));
  const hs = [...new Set(all.map((s) => s.hunter || 'Me'))];
  const grps = V.groups(); const trips = store.trips.filter((t) => list.some((s) => s.extra?.trip_id === t.id)).sort((a, b) => String(b.date_start).localeCompare(String(a.date_start)));
  const loose = list.filter((s) => !groupOf(s) && !tripOf(s));
  const sec = (id, title, body, count, actions = '') => `<details class="wp-sec" data-sec="${id}" ${ui.open.has(id) || ui.q ? 'open' : ''}><summary>${icon('chevR', { size: 16 })}<h3>${title}</h3><span class="muted tnum">${count}</span>${actions}</summary>${body}</details>`;
  const block = (key, kind, title, color, spots, meta) => `<div class="wp-group ${V.shown(kind, key) ? '' : 'off'}">
      <div class="wp-group-h"><label class="switch" title="Show on map"><input type="checkbox" data-vk="${kind}" data-vkey="${esc(key)}" ${V.shown(kind, key) ? 'checked' : ''} aria-label="Show ${esc(title)} on map"></label>
      <span class="dot" style="background:${color}"></span><div class="t"><b>${esc(title)}</b><span class="muted">${meta}</span></div>
      ${kind === 'groups' ? `<button class="icon-btn" data-grp-menu="${esc(key)}" aria-label="Group options">${icon('dots', { size: 18 })}</button>` : `<button class="icon-btn" data-open-trip="${esc(key)}" aria-label="Open hunt">${icon('chevR', { size: 18 })}</button>`}</div>
      ${spots.map((s) => spotRow(s)).join('') || '<p class="muted small-pad">No waypoints yet. Pick this group when you add or edit one.</p>'}</div>`;

  v.innerHTML = `<div class="page-h"><h2>Waypoints</h2>
    <div class="row"><button class="primary" id="newSpot">${icon('pinPlus', { size: 18 })}New</button>
    <details class="menu"><summary class="icon-btn" aria-label="More">${icon('dots')}</summary><div class="menu-pop">
      <button data-m="bulk">${icon('list', { size: 18 })}Bulk entry</button><button data-m="group">${icon('plus', { size: 18 })}New group</button>
      <button data-m="kml">${icon('globe', { size: 18 })}Export KML (Google Earth)</button><button data-m="gpx">${icon('route', { size: 18 })}Export GPX</button><button data-m="csv">${icon('upload', { size: 18 })}Export CSV</button></div></details></div></div>
  <input id="fq" type="search" placeholder="Search waypoints" value="${esc(ui.q)}" style="width:100%" aria-label="Search waypoints">
  <div class="vis-box">
    <div class="vis-h"><b>Show on map</b>${V.anyHidden() ? '<button class="link" id="showAll">Show everything</button>' : ''}</div>
    <div class="f-row">${kinds.map((k) => chip('kinds', k.id, k.name.replace(' / blind', '').replace(' / parking', ''), all.filter((s) => (s.kind || 'note') === k.id).length, `<span class="spot-badge" style="width:20px;height:20px;background:${k.color}"></span>`)).join('')}</div>
    ${years.length > 1 || years[0] !== 'none' ? `<div class="f-row">${years.map((y) => chip('years', y, y === 'none' ? 'No date' : y, all.filter((s) => spotYear(s) === y).length)).join('')}</div>` : ''}
    ${hs.length > 1 ? `<div class="f-row">${hs.map((h) => chip('hunters', h, h, all.filter((s) => (s.hunter || 'Me') === h).length)).join('')}</div>` : ''}
  </div>
  ${!all.length ? `<div class="empty">${icon('pin', { size: 22 })}<b>No waypoints yet</b><span class="muted">Tap “Drop waypoint” on the map, or import from onX / iHunter.</span></div>` : ''}
  ${grps.length || all.length ? sec('groups', 'Groups', `<p class="muted sec-help">Permanent spots: camps, stands, cams, access. They stay on the map no matter which years or hunts are hidden.</p>
    ${grps.map((g) => { const sp = list.filter((s) => s.extra?.group_id === g.id); return block(g.id, 'groups', g.name, g.color, sp, `${sp.length} waypoint${sp.length === 1 ? '' : 's'}`); }).join('')}
    <button class="small" data-m="group">${icon('plus', { size: 16 })}New group</button>`, grps.length) : ''}
  ${trips.length ? sec('hunts', 'Hunts', trips.map((t) => { const sp = list.filter((s) => s.extra?.trip_id === t.id); return block(t.id, 'trips', tripTitle(t), '#d4661c', sp, `${dateSpan(t)} · ${sp.length} waypoint${sp.length === 1 ? '' : 's'}`); }).join(''), trips.length) : ''}
  ${loose.length ? sec('loose', 'Not grouped', loose.sort((a, b) => String(b.observed_at || b.created_at).localeCompare(String(a.observed_at || a.created_at))).map((s) => spotRow(s, { showTrip: true })).join(''), loose.length) : ''}`;

  v.querySelector('#fq').oninput = (e) => { ui.q = e.target.value; const pos = e.target.selectionStart; render(v); const i = v.querySelector('#fq'); i.focus(); i.setSelectionRange(pos, pos); };
  v.addEventListener('toggle', (e) => { const id = e.target.dataset?.sec; if (id && !ui.q) e.target.open ? ui.open.add(id) : ui.open.delete(id); }, true);
  v.onchange = (e) => { const el = e.target; if (el.dataset.vk) { V.setShown(el.dataset.vk, el.dataset.vkey, el.checked); render(v); } };
  v.onclick = async (e) => {
    const c = e.target.closest('button.f-chip'); if (c) { V.setShown(c.dataset.vk, c.dataset.vkey, c.getAttribute('aria-pressed') !== 'true'); render(v); return; }
    if (e.target.closest('#showAll')) { V.showAll(); render(v); return; }
    const m = e.target.closest('[data-m]')?.dataset.m;
    if (m) {
      e.target.closest('details.menu')?.removeAttribute('open');
      if (m === 'bulk') bulkSpots();
      if (m === 'group') { const n = prompt('Group name (e.g. Camps, Stands, Palliser River)'); if (n?.trim()) { await V.addGroup(n); ui.open.add('groups'); render(v); } }
      if (m === 'kml') exportKML(store.spots.filter((s) => V.isVisible(s)), store.tracks);
      if (m === 'gpx') exportGPX(store.spots.filter((s) => V.isVisible(s)), store.tracks);
      if (m === 'csv') exportCSV(store.spots);
      return;
    }
    const gm = e.target.closest('[data-grp-menu]')?.dataset.grpMenu;
    if (gm) {
      const g = V.groups().find((x) => x.id === gm); const a = prompt(`Rename “${g.name}”, or type DELETE to remove the group (its waypoints are kept):`, g.name);
      if (a === 'DELETE') await V.deleteGroup(gm); else if (a?.trim() && a !== g.name) await V.renameGroup(gm, a.trim());
      render(v); return;
    }
    const ot = e.target.closest('[data-open-trip]')?.dataset.openTrip; if (ot) { (await import('./trips.js?v=20261112230233-4f3bcaf')).openTrip(ot); return; }
    if (e.target.closest('[data-act]')) return;
    const row = e.target.closest('[data-fly]');
    if (row) { const s = store.spots.find((x) => x.id === row.dataset.fly); if (s) { if (!V.isVisible(s)) toast('That waypoint is hidden by a filter above'); M.flyTo(s.lon, s.lat, 14); if (innerWidth <= 760) closePanel(); } }
  };
  v.querySelector('#newSpot').onclick = async () => { const ll = await pickOnMap('Tap the map where the waypoint goes'); openSpotForm({ lat: ll.lat, lon: ll.lng }, true); };
  render.v = v;
}
export function onData(what) { if (['spots', 'all', 'trips'].includes(what) && render.v?.isConnected) render(render.v); }
export const dateSpan = (t) => {
  const a = new Date(t.date_start + 'T12:00'), b = t.date_end ? new Date(t.date_end + 'T12:00') : a;
  const o = { month: 'short', day: 'numeric' };
  if (+a === +b) return a.toLocaleDateString('en-CA', { ...o, year: 'numeric' });
  return `${a.toLocaleDateString('en-CA', o)} – ${b.toLocaleDateString('en-CA', a.getMonth() === b.getMonth() ? { day: 'numeric' } : o)}, ${b.getFullYear()}`;
};

// ---- Single waypoint form (new or edit) ----
let lastDefaults = { hunter: 'Me', kind: 'sighting' };
export function openSpotForm(s = {}, lookupWmu = false) {
  const isNew = !s.id;
  const d = isNew ? { ...lastDefaults, observed_at: new Date().toISOString(), ...s } : s;
  const body = modal(`<h3>${isNew ? 'New waypoint' : 'Edit waypoint'}</h3>
  <form id="spotForm" class="grid2">
    <input type="hidden" name="kind" value="${esc(d.kind || 'sighting')}">
    <div class="span2"><div class="pick-label">Type</div><div class="kind-pick" role="radiogroup">${KINDS.map((k) => `<button type="button" role="radio" data-kind="${k.id}" aria-checked="${(d.kind || 'sighting') === k.id}" style="--k:${k.color}">
      <span class="kb">${KIND_GLYPH[k.id] ? glyphSVG(KIND_GLYPH[k.id], { size: 18, color: '#fff', bg: k.color }) : ''}</span>${esc(k.name.replace(' / blind', '').replace(' / parking', ''))}</button>`).join('')}</div></div>
    <div class="span2"><div class="pick-label">Animal</div><div class="animal-pick" role="radiogroup">${PICK.map(([sp, g]) => `<button type="button" role="radio" data-sp="${esc(sp)}" aria-checked="${(d.species || '') === sp}">${glyphSVG(g, { size: 34 })}<span>${esc(sp.replace(' Deer', ' deer').replace('White-tailed deer', 'Whitetail'))}</span></button>`).join('')}</div></div>
    <label>Species <input name="species" list="speciesList" value="${esc(d.species || '')}" placeholder="or type one"></label>
    <label>Sex <select name="sex"></select></label>
    <label class="pts-field">Points <input name="points" type="number" min="1" max="20" inputmode="numeric" value="${esc(d.extra?.points ?? '')}" placeholder="e.g. 4"></label>
    <label>Name <input name="name" value="${esc(d.name || '')}" placeholder="Filled in for you"></label>
    <label>Hunter <input name="hunter" list="hunterList" value="${esc(d.hunter || 'Me')}"></label>
    <label>Hunt <select name="trip_id"><option value="">None</option>${[...store.trips].sort((a, b) => String(b.date_start).localeCompare(String(a.date_start))).map((t) => `<option value="${t.id}" ${d.extra?.trip_id === t.id ? 'selected' : ''}>${esc(tripTitle(t))} (${esc(dateSpan(t))})</option>`).join('')}</select></label>
    <label>Group <select name="group_id"><option value="">None</option>${V.groups().map((g) => `<option value="${g.id}" ${d.extra?.group_id === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}<option value="__new">New group…</option></select></label>
    <label>Date/time <input type="datetime-local" name="observed_at" value="${d.observed_at ? localDT(d.observed_at) : ''}"></label>
    <label>WMU <input name="wmu" value="${esc(d.wmu || '')}" placeholder="3-15"></label>
    <label>Weapon <select name="weapon">${opts(WEAPONS, d.weapon, { blank: true })}</select></label>
    <label>Latitude <input name="lat" type="number" step="any" required value="${d.lat != null && d.lat !== '' ? (+d.lat).toFixed(6) : ''}"></label>
    <label>Longitude <input name="lon" type="number" step="any" required value="${d.lon != null && d.lon !== '' ? (+d.lon).toFixed(6) : ''}"></label>
    <label class="span2">Notes <textarea name="notes">${esc(d.notes || '')}</textarea></label>
    <div class="row span2">
      <button type="button" id="pickBtn" class="small">Move on map</button>
      ${d.lat != null ? `<a href="${earthLink(d.lat, d.lon)}" target="_blank" rel="noopener">Google Earth</a>` : ''}
    </div>
    <div class="form-foot span2">
      ${isNew ? '' : '<button type="button" class="danger" id="delSpot">Delete</button>'}
      <span class="dirty-note muted">Unsaved changes</span>
      <button type="button" class="cancel-btn">Cancel</button>
      <button class="primary" type="submit">${isNew ? 'Save waypoint' : 'Save changes'}</button>
    </div>
  </form>${hunterDatalist()}${speciesDatalist()}`);
  const form = body.querySelector('#spotForm');
  const syncPick = () => {
    form.querySelectorAll('[data-kind]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.kind === form.kind.value)));
    form.querySelectorAll('[data-sp]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.sp.toLowerCase() === (form.species.value || '').toLowerCase())));
  };
  // Sex labels follow the species (Bull/Cow, Buck/Doe…); points only for antlered animals; name auto-fills until you type your own.
  let auto = !d.name || d.name === autoName(d);
  const refresh = () => {
    const [m, f] = sexTerms(form.species.value); const cur = form.sex.value || d.sex || '';
    form.sex.innerHTML = `<option value="">Unknown</option><option value="M">${m}</option><option value="F">${f}</option>`; form.sex.value = cur;
    form.querySelector('.pts-field').classList.toggle('hidden', !(hasPoints(form.species.value) && ['kill', 'sighting'].includes(form.kind.value) && form.sex.value !== 'F'));
    if (auto) form.name.value = autoName({ kind: form.kind.value, species: form.species.value, sex: form.sex.value });
  };
  form.name.addEventListener('input', () => { auto = !form.name.value; });
  form.addEventListener('click', (e) => {
    const k = e.target.closest('[data-kind]'); if (k) { form.kind.value = k.dataset.kind; syncPick(); refresh(); markDirty(); }
    const a = e.target.closest('[data-sp]'); if (a) { form.species.value = a.dataset.sp; if (!['kill', 'sighting'].includes(form.kind.value)) form.kind.value = 'sighting'; syncPick(); refresh(); markDirty(); }
  });
  form.species.addEventListener('input', () => { syncPick(); refresh(); });
  form.sex.addEventListener('change', refresh);
  form.group_id.addEventListener('change', async () => {
    if (form.group_id.value !== '__new') return;
    const n = prompt('New group name'); if (!n?.trim()) { form.group_id.value = ''; return; }
    const g = await V.addGroup(n); form.group_id.insertAdjacentHTML('beforeend', ''); const o = new Option(g.name, g.id, true, true); form.group_id.insertBefore(o, form.group_id.lastElementChild);
  });
  form.querySelector('.cancel-btn').onclick = () => requestClose();
  refresh();
  if (lookupWmu && d.lat != null && !d.wmu) M.identify({ lng: d.lon, lat: d.lat }, ['wmu']).then((r) => { const w = M.wmuFromIdentify(r); if (w && !form.wmu.value) form.wmu.value = w; });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const o = formData(form); o.lat = +o.lat; o.lon = +o.lon; o.wmu = normMU(o.wmu) || null;
    const pts = form.querySelector('.pts-field').classList.contains('hidden') ? null : +o.points || null; delete o.points;
    o.extra = { ...(s.extra || {}), points: pts || undefined }; if (!pts) delete o.extra.points;
    for (const k of ['trip_id', 'group_id']) { if (o[k]) o.extra[k] = o[k]; else delete o.extra[k]; delete o[k]; }
    if (!o.name) o.name = autoName(o);
    o.observed_at = o.observed_at ? new Date(o.observed_at).toISOString() : null;
    try {
      if (isNew) { o.source = 'manual'; await db.insert('spots', o); lastDefaults = { hunter: o.hunter, kind: o.kind, species: o.species, weapon: o.weapon }; }
      else await db.update('spots', s.id, o);
      closeModal(); toast('Saved');
    } catch (err) { toast('Save failed: ' + err.message, 5000); }
  };
  body.querySelector('#pickBtn').onclick = async () => {
    const keep = formData(form); closeModal();
    const ll = await pickOnMap();
    openSpotForm({ ...s, ...keep, observed_at: keep.observed_at ? new Date(keep.observed_at).toISOString() : null, lat: ll.lat, lon: ll.lng, wmu: '' }, true);
  };
  body.querySelector('#delSpot')?.addEventListener('click', async () => {
    if (!confirm('Delete this waypoint?')) return;
    await db.remove('spots', s.id); closeModal(); toast('Deleted');
  });
  return form;
}

// ---- Bulk entry grid (fast entry of past seasons) ----
const BULK_COLS = ['kind', 'date', 'time', 'species', 'sex', 'hunter', 'wmu', 'weapon', 'coords', 'name', 'notes'];
function bulkSpots() {
  const body = modal(`<h3>Bulk waypoint entry</h3>
  <p class="muted">One row per waypoint. Coords as “lat, lon” (paste from Google Maps/onX) or click 📍 to pick on the map. Blank cells repeat the row above when “carry down” is on. Or paste CSV/TSV with headers (${BULK_COLS.join(', ')}; or lat & lon columns).</p>
  <div class="row"><label style="color:var(--ink)"><input type="checkbox" id="carry" checked> Carry down blanks</label>
  <button id="add10">+10 rows</button><button id="pasteBtn">Paste CSV…</button></div>
  <div class="scroll-x" style="max-height:55vh;overflow:auto;margin-top:8px"><table id="bulkT"><thead><tr>${BULK_COLS.map((c) => `<th>${c}</th>`).join('')}<th></th></tr></thead><tbody></tbody></table></div>
  <div class="row" style="margin-top:10px"><button class="primary" id="bulkSave">Save all</button><span id="bulkMsg" class="muted"></span></div>
  ${hunterDatalist()}${speciesDatalist()}`, { wide: true });
  const tb = body.querySelector('tbody');
  const addRow = (r = {}) => {
    const tr = document.createElement('tr');
    tr.innerHTML = BULK_COLS.map((c) => {
      if (c === 'kind') return `<td><select data-c="kind">${opts(KINDS, r.kind || (tb.children.length ? '' : 'kill'), { blank: true })}</select></td>`;
      if (c === 'sex') return `<td><select data-c="sex">${opts(SEXES, r.sex)}</select></td>`;
      if (c === 'weapon') return `<td><select data-c="weapon">${opts(WEAPONS, r.weapon, { blank: true })}</select></td>`;
      if (c === 'date') return `<td><input type="date" data-c="date" value="${esc(r.date || '')}"></td>`;
      if (c === 'time') return `<td><input type="time" data-c="time" value="${esc(r.time || '')}"></td>`;
      const list = c === 'hunter' ? 'list="hunterList"' : c === 'species' ? 'list="speciesList"' : '';
      return `<td><input data-c="${c}" ${list} value="${esc(r[c] || '')}" ${c === 'coords' ? 'placeholder="49.5, -119.6" style="min-width:150px"' : ''}></td>`;
    }).join('') + '<td><button class="small" data-pick title="Pick on map">📍</button></td>';
    tb.append(tr);
  };
  for (let i = 0; i < 10; i++) addRow();
  body.querySelector('#add10').onclick = () => { for (let i = 0; i < 10; i++) addRow(); };
  tb.onclick = async (e) => {
    if (!e.target.closest('[data-pick]')) return;
    const tr = e.target.closest('tr'); const m = body.closest('.modal'); m.classList.add('hidden');
    const ll = await pickOnMap('Tap the map for this row'); m.classList.remove('hidden');
    tr.querySelector('[data-c=coords]').value = `${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}`;
  };
  body.querySelector('#pasteBtn').onclick = () => {
    const t = prompt('Paste CSV or TSV (with a header row):'); if (!t) return;
    const rows = parseCSV(t);
    const lc = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase().trim(), v]));
    // drop empty rows at the end before appending
    [...tb.children].forEach((tr) => { if (![...tr.querySelectorAll('input')].some((i) => i.value)) tr.remove(); });
    rows.map(lc).forEach((r) => addRow({ ...r, coords: r.coords || (r.lat && r.lon ? `${r.lat}, ${r.lon}` : r.latitude ? `${r.latitude}, ${r.longitude}` : ''), date: r.date && /^\d{4}-\d{2}-\d{2}/.test(r.date) ? r.date.slice(0, 10) : r.date, kind: (r.kind || '').toLowerCase() }));
  };
  body.querySelector('#bulkSave').onclick = async () => {
    const carry = body.querySelector('#carry').checked; let prev = {}; const out = []; const skipped = [];
    [...tb.children].forEach((tr, i) => {
      const r = {}; tr.querySelectorAll('[data-c]').forEach((el) => (r[el.dataset.c] = el.value.trim()));
      const any = ['date', 'species', 'coords', 'name', 'notes'].some((k) => r[k]); if (!any) return;
      if (carry) for (const k of ['kind', 'date', 'species', 'hunter', 'wmu', 'weapon']) if (!r[k] && prev[k]) r[k] = prev[k];
      prev = r;
      const ll = parseLatLon(r.coords); if (!ll) { skipped.push(i + 1); return; }
      out.push({ kind: r.kind || 'note', name: r.name || null, species: r.species || null, sex: r.sex || null, hunter: r.hunter || 'Me', wmu: normMU(r.wmu) || null, weapon: r.weapon || null, notes: r.notes || null,
        lat: ll.lat, lon: ll.lon, observed_at: r.date ? new Date(`${r.date}T${r.time || '12:00'}`).toISOString() : null, source: 'bulk', extra: r.time ? {} : { time_unknown: true } });
    });
    if (skipped.length && !confirm(`Rows ${skipped.join(', ')} have no valid coordinates and will be skipped. Continue?`)) return;
    try { await db.insert('spots', out); closeModal(); toast(`Saved ${out.length} waypoints`); } catch (e) { toast('Save failed: ' + e.message, 5000); }
  };
}
