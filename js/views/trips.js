import * as db from '../db.js';
import { store, hunters } from '../db.js';
import { WEAPONS, RESULTS } from '../config.js';
import { esc, opts, modal, closeModal, toast, formData, todayISO, fmtDate, num, parseCSV, yearOf } from '../util.js';
import { normMU } from '../seasons.js';
import { hunterDatalist, speciesDatalist } from './log.js';
import { exportCSV } from '../exporters.js';
import { pickOnMap } from '../main.js';
import * as M from '../map.js';

const flt = { hunter: '', year: '', species: '' };
const RESULT_CHIP = { harvest: 'ok', missed: 'warn', seen: '', nothing: 'bad' };

export function render(v) {
  const years = [...new Set(store.trips.map((t) => yearOf(t.date_start)).filter(Boolean))].sort((a, b) => b - a);
  const species = [...new Set(store.trips.map((t) => t.species).filter(Boolean))].sort();
  v.innerHTML = `<h2>Hunt trips &amp; days</h2>
  <div class="row"><button class="primary" id="newTrip">＋ New trip</button><button id="bulkTrip">Bulk entry</button><button id="csvTrip">Export CSV</button></div>
  <div class="grid3" style="margin-top:8px">
    <select id="th"><option value="">All hunters</option>${opts(hunters(), flt.hunter)}</select>
    <select id="ty"><option value="">All years</option>${opts(years.map(String), flt.year)}</select>
    <select id="ts"><option value="">All species</option>${opts(species, flt.species)}</select>
  </div><div id="tripList"></div>`;
  const rows = () => store.trips.filter((t) => (!flt.hunter || t.hunter === flt.hunter) && (!flt.year || String(yearOf(t.date_start)) === flt.year) && (!flt.species || t.species === flt.species));
  const draw = () => {
    const rs = rows().sort((a, b) => String(b.date_start).localeCompare(String(a.date_start)));
    const hrs = rs.reduce((a, t) => a + (+t.hours || 0), 0), kills = rs.filter((t) => t.result === 'harvest').length;
    v.querySelector('#tripList').innerHTML = `<p class="muted">${rs.length} trips · ${hrs.toFixed(0)} h · ${kills} harvests${kills ? ` · ${(hrs / kills).toFixed(1)} h/harvest` : ''}</p>
    <div class="scroll-x"><table><thead><tr><th>Date</th><th>Species / WMU</th><th>Hunter</th><th>Hrs</th><th>Result</th><th></th></tr></thead><tbody>
    ${rs.slice(0, 500).map((t) => `<tr><td>${esc(fmtDate(t.date_start + 'T12:00'))}${t.date_end && t.date_end !== t.date_start ? `<div class="muted">→ ${esc(fmtDate(t.date_end + 'T12:00'))}</div>` : ''}</td>
      <td>${esc(t.species || '')}<div class="muted">${esc([t.wmu, t.area].filter(Boolean).join(' · '))}</div></td><td>${esc(t.hunter || '')}</td><td>${t.hours ?? ''}</td>
      <td><span class="chip ${RESULT_CHIP[t.result] || ''}">${esc(t.result || '')}</span>${t.animals_seen ? `<div class="muted">${t.animals_seen} seen</div>` : ''}</td>
      <td><button class="small" data-trip="${t.id}">Edit</button></td></tr>`).join('')}</tbody></table></div>`;
  };
  v.querySelectorAll('select').forEach((el) => el.addEventListener('change', () => { Object.assign(flt, { hunter: v.querySelector('#th').value, year: v.querySelector('#ty').value, species: v.querySelector('#ts').value }); draw(); }));
  v.querySelector('#tripList').onclick = (e) => { const id = e.target.dataset.trip; if (id) openTripForm(store.trips.find((t) => t.id === id)); };
  v.querySelector('#newTrip').onclick = () => openTripForm({});
  v.querySelector('#bulkTrip').onclick = bulkTrips;
  v.querySelector('#csvTrip').onclick = () => exportCSV(rows(), 'trips');
  draw(); render.redraw = draw;
}
export function onData(w) { if (w === 'trips' || w === 'all') render.redraw?.(); }

let last = { hunter: 'Me' };
export function openTripForm(t = {}) {
  const isNew = !t.id; const d = isNew ? { date_start: todayISO(), ...last, ...t } : t;
  const body = modal(`<h3>${isNew ? 'New trip / hunt day' : 'Edit trip'}</h3>
  <form id="tripForm" class="grid2">
    <label>Start <input type="date" name="date_start" required value="${esc(d.date_start || '')}"></label>
    <label>End <input type="date" name="date_end" value="${esc(d.date_end || '')}"></label>
    <label>Hunter <input name="hunter" list="hunterList" value="${esc(d.hunter || 'Me')}"></label>
    <label>Species <input name="species" list="speciesList" value="${esc(d.species || '')}"></label>
    <label>WMU <input name="wmu" value="${esc(d.wmu || '')}"></label>
    <label>Area <input name="area" value="${esc(d.area || '')}" placeholder="drainage, road…"></label>
    <label>Weapon <select name="weapon">${opts(WEAPONS, d.weapon, { blank: true })}</select></label>
    <label>Hours hunted <input type="number" step="0.5" name="hours" value="${d.hours ?? ''}"></label>
    <label>Result <select name="result">${opts(RESULTS, d.result || 'nothing')}</select></label>
    <label>Animals seen <input type="number" name="animals_seen" value="${d.animals_seen ?? ''}"></label>
    <label>Weather <input name="weather" value="${esc(d.weather || '')}" placeholder="clear, snow, rain…"></label>
    <label>Wind <input name="wind" value="${esc(d.wind || '')}" placeholder="NW 10"></label>
    <label>Temp °C <input type="number" step="any" name="temp_c" value="${d.temp_c ?? ''}"></label>
    <label>Lat <input type="number" step="any" name="lat" value="${d.lat ?? ''}"></label>
    <label>Lon <input type="number" step="any" name="lon" value="${d.lon ?? ''}"></label>
    <div style="align-self:end"><button type="button" id="tPick">Pick on map</button></div>
    <label class="span2">Notes <textarea name="notes">${esc(d.notes || '')}</textarea></label>
    <div class="row span2"><button class="primary" type="submit">Save</button>${isNew ? '' : '<button type="button" class="danger" id="tDel">Delete</button>'}</div>
  </form>${hunterDatalist()}${speciesDatalist()}`);
  const f = body.querySelector('form');
  f.onsubmit = async (e) => {
    e.preventDefault(); const o = formData(f);
    for (const k of ['hours', 'animals_seen', 'temp_c', 'lat', 'lon']) o[k] = num(o[k]);
    o.wmu = normMU(o.wmu) || null;
    try {
      if (isNew) { await db.insert('trips', o); last = { hunter: o.hunter, species: o.species, weapon: o.weapon, wmu: o.wmu }; } else await db.update('trips', t.id, o);
      closeModal(); toast('Trip saved');
    } catch (err) { toast('Save failed: ' + err.message, 5000); }
  };
  body.querySelector('#tPick').onclick = async () => {
    const keep = formData(f); closeModal(); const ll = await pickOnMap();
    const r = await M.identify(ll, ['wmu']);
    openTripForm({ ...t, ...keep, lat: +ll.lat.toFixed(6), lon: +ll.lng.toFixed(6), wmu: keep.wmu || M.wmuFromIdentify(r) || '' });
  };
  body.querySelector('#tDel')?.addEventListener('click', async () => { if (confirm('Delete trip?')) { await db.remove('trips', t.id); closeModal(); } });
}

const COLS = ['date_start', 'date_end', 'hunter', 'species', 'wmu', 'area', 'weapon', 'hours', 'result', 'animals_seen', 'weather', 'notes'];
function bulkTrips() {
  const body = modal(`<h3>Bulk trip entry</h3>
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
    try { await db.insert('trips', out); closeModal(); toast(`Saved ${out.length} trips`); } catch (e) { toast('Save failed: ' + e.message, 5000); }
  };
}
