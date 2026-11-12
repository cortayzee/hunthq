import * as db from '../db.js';
import { store, hunters } from '../db.js';
import { KINDS, SPECIES, WEAPONS, SEXES, kindColor } from '../config.js';
import { esc, opts, modal, closeModal, requestClose, markDirty, toast, formData, localDT, fmtDT, earthLink, parseLatLon, parseCSV, yearOf } from '../util.js';
import * as M from '../map.js';
import { normMU } from '../seasons.js';
import { pickOnMap } from '../main.js';
import { exportKML, exportGPX, exportCSV } from '../exporters.js';
import { glyphSVG, animalFor, sexTerms, hasPoints, autoName, spotLabel } from '../animals.js';

const PICK = [['Moose', 'moose'], ['Elk', 'elk'], ['Mule Deer', 'deer'], ['White-tailed Deer', 'deer'], ['Black Bear', 'bear'], ['Grizzly Bear', 'bear'],
  ['Bighorn Sheep', 'sheep'], ['Mountain Goat', 'goat'], ['Caribou', 'caribou'], ['Cougar', 'cougar'], ['Wolf', 'wolf'], ['Coyote', 'wolf'],
  ['Ruffed Grouse', 'grouse'], ['Turkey', 'turkey'], ['Ducks', 'duck'], ['Geese', 'duck'], ['Snowshoe Hare', 'hare']];
const KIND_GLYPH = { kill: null, sighting: null, stand: 'stand', camp: 'camp', trailcam: 'trailcam', access: 'access', note: 'note' };

export const hunterDatalist = () => `<datalist id="hunterList">${hunters().map((h) => `<option value="${esc(h)}">`).join('')}</datalist>`;
export const speciesDatalist = () => `<datalist id="speciesList">${SPECIES.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>`;

const flt = { q: '', kind: '', hunter: '', year: '', species: '' };
export function filteredSpots() {
  const q = flt.q.toLowerCase();
  return store.spots.filter((s) => (!flt.kind || s.kind === flt.kind) && (!flt.hunter || s.hunter === flt.hunter) && (!flt.species || s.species === flt.species)
    && (!flt.year || String(yearOf(s.observed_at)) === flt.year) && (!q || [s.name, s.notes, s.species, s.wmu, s.hunter].join(' ').toLowerCase().includes(q)));
}

export function render(v) {
  const years = [...new Set(store.spots.map((s) => yearOf(s.observed_at)).filter(Boolean))].sort((a, b) => b - a);
  const species = [...new Set(store.spots.map((s) => s.species).filter(Boolean))].sort();
  v.innerHTML = `<h2>Waypoints</h2>
  <div class="row"><button class="primary" id="newSpot">＋ New</button><button id="bulkSpot">Bulk entry</button>
  <button id="expKml">Export KML</button><button id="expGpx">GPX</button><button id="expCsv">CSV</button></div>
  <div class="grid2" style="margin-top:8px">
    <input id="fq" placeholder="Search…" value="${esc(flt.q)}" class="span2">
    <select id="fkind"><option value="">All kinds</option>${opts(KINDS, flt.kind)}</select>
    <select id="fhunter"><option value="">All hunters</option>${opts(hunters(), flt.hunter)}</select>
    <select id="fyear"><option value="">All years</option>${opts(years.map(String), flt.year)}</select>
    <select id="fsp"><option value="">All species</option>${opts(species, flt.species)}</select>
  </div>
  <div class="row" style="margin-top:6px"><label style="color:var(--ink)"><input type="checkbox" id="fmap"> Show only these on map</label></div>
  <div id="spotList"></div>`;
  const draw = () => {
    const rows = filteredSpots().sort((a, b) => String(b.observed_at || b.created_at).localeCompare(String(a.observed_at || a.created_at)));
    v.querySelector('#spotList').innerHTML = `<p class="muted">${rows.length} of ${store.spots.length}</p><div class="scroll-x"><table><thead><tr><th></th><th>Name / species</th><th>When</th><th>Hunter</th><th>WMU</th><th></th></tr></thead><tbody>${rows.slice(0, 500).map((s) => `
      <tr><td><span class="swatch" style="background:${kindColor(s.kind)};border-radius:50%"></span></td>
      <td><a href="#" data-fly="${s.id}">${esc(spotLabel(s))}</a><div class="muted">${esc([s.species, s.sex, s.weapon].filter(Boolean).join(' · '))}</div></td>
      <td>${esc(fmtDT(s.observed_at))}</td><td>${esc(s.hunter || '')}</td><td>${esc(s.wmu || '')}</td>
      <td><button class="small" data-act="edit-spot" data-id="${s.id}">Edit</button></td></tr>`).join('')}</tbody></table></div>${rows.length > 500 ? '<p class="muted">Showing first 500.</p>' : ''}`;
    if (v.querySelector('#fmap').checked) { const ids = new Set(rows.map((r) => r.id)); M.setSpotFilter((s) => ids.has(s.id)); }
  };
  const read = () => Object.assign(flt, { q: v.querySelector('#fq').value, kind: v.querySelector('#fkind').value, hunter: v.querySelector('#fhunter').value, year: v.querySelector('#fyear').value, species: v.querySelector('#fsp').value });
  v.querySelectorAll('select,#fq').forEach((el) => el.addEventListener('input', () => { read(); draw(); }));
  v.querySelector('#fmap').onchange = (e) => { if (!e.target.checked) M.setSpotFilter(null); draw(); };
  v.querySelector('#spotList').onclick = (e) => {
    const id = e.target.dataset.fly; if (!id) return; e.preventDefault();
    const s = store.spots.find((x) => x.id === id); M.flyTo(s.lon, s.lat, 14);
  };
  v.querySelector('#newSpot').onclick = async () => { const ll = await pickOnMap('Tap the map where the waypoint goes'); openSpotForm({ lat: ll.lat, lon: ll.lng }, true); };
  v.querySelector('#bulkSpot').onclick = () => bulkSpots();
  v.querySelector('#expKml').onclick = () => exportKML(filteredSpots(), flt.hunter || flt.kind ? [] : store.tracks);
  v.querySelector('#expGpx').onclick = () => exportGPX(filteredSpots(), flt.hunter || flt.kind ? [] : store.tracks);
  v.querySelector('#expCsv').onclick = () => exportCSV(filteredSpots());
  draw();
  render.redraw = draw;
}
export function onData(what) { if (what === 'spots' || what === 'all') render.redraw?.(); }

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
  form.querySelector('.cancel-btn').onclick = () => requestClose();
  refresh();
  if (lookupWmu && d.lat != null && !d.wmu) M.identify({ lng: d.lon, lat: d.lat }, ['wmu']).then((r) => { const w = M.wmuFromIdentify(r); if (w && !form.wmu.value) form.wmu.value = w; });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const o = formData(form); o.lat = +o.lat; o.lon = +o.lon; o.wmu = normMU(o.wmu) || null;
    const pts = form.querySelector('.pts-field').classList.contains('hidden') ? null : +o.points || null; delete o.points;
    o.extra = { ...(s.extra || {}), points: pts || undefined }; if (!pts) delete o.extra.points;
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
