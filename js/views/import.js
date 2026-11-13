import * as db from '../db.js?v=20261113160653-ee55c68';
import { store } from '../db.js?v=20261113160653-ee55c68';
import { KINDS, SPECIES } from '../config.js?v=20261113160653-ee55c68';
import { esc, opts, toast, parseCSV, haversineKm, localDT } from '../util.js?v=20261113160653-ee55c68';
import { hunterDatalist, speciesDatalist } from './log.js?v=20261113160653-ee55c68';
import { icon } from '../icons.js?v=20261113160653-ee55c68';
import * as M from '../map.js?v=20261113160653-ee55c68';

let items = []; let tracks = [];

export function render(v) {
  v.innerHTML = `<button class="back-link" data-back>${icon('chevL', { size: 16 })}More</button><div class="page-h"><h2>Import</h2></div>
  <p class="lede">Add waypoints and tracks from onX (KML or GPX) or iHunter (KML or KMZ). You review everything before it's saved. Duplicates are skipped.</p>
  <div class="grid2"><label>Source <select id="iSrc"><option value="onx">onX</option><option value="ihunter">iHunter</option><option value="gps">GPS / other</option></select></label>
  <label>Hunter <input id="iHunter" list="hunterList" value="Me"></label></div>
  <label class="drop-zone" for="iFile">${icon('upload', { size: 22 })}<b>Choose files</b><span>KML, KMZ, GPX, GeoJSON or CSV</span></label><input type="file" id="iFile" class="visually-hidden" multiple accept=".kml,.kmz,.gpx,.geojson,.json,.csv">
  <div id="iPrev"></div>${hunterDatalist()}${speciesDatalist()}`;
  v.querySelector('[data-back]').onclick = () => import('../main.js?v=20261113160653-ee55c68').then((m) => m.showTabPublic('more'));
  v.querySelector('#iFile').onchange = async (e) => {
    items = []; tracks = [];
    for (const file of e.target.files) {
      try { const fc = await parseFile(file); collect(fc, file.name); } catch (err) { toast(`${file.name}: ${err.message}`, 5000); console.error(err); }
    }
    dedupe(); preview(v);
  };
}

export async function parseFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.kmz')) {
    const zip = await JSZip.loadAsync(file); const k = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith('.kml'));
    if (!k) throw new Error('No KML inside KMZ'); return kmlToGeo(await zip.files[k].async('string'));
  }
  const text = await file.text();
  if (name.endsWith('.kml')) return kmlToGeo(text);
  if (name.endsWith('.gpx')) return toGeoJSON.gpx(new DOMParser().parseFromString(text, 'text/xml'));
  if (name.endsWith('.csv')) return csvToGeo(text);
  const j = JSON.parse(text); return j.type === 'FeatureCollection' ? j : j.type === 'Feature' ? { type: 'FeatureCollection', features: [j] } : { type: 'FeatureCollection', features: [] };
}
function kmlToGeo(text) {
  const dom = new DOMParser().parseFromString(text, 'text/xml');
  // Remember each placemark's folder name (onX/iHunter often group by folder), keyed by order.
  const folders = [...dom.getElementsByTagName('Placemark')].map((p) => { const f = p.parentNode; const n = f && f.getElementsByTagName ? [...f.children].find((c) => c.tagName === 'name') : null; return n?.textContent || ''; });
  const fc = toGeoJSON.kml(dom);
  fc.features.forEach((f, i) => { if (folders[i] && !f.properties.folder) f.properties.folder = folders[i]; });
  return fc;
}
function csvToGeo(text) {
  const rows = parseCSV(text);
  const key = (r, re) => Object.keys(r).find((k) => re.test(k));
  return { type: 'FeatureCollection', features: rows.map((r) => {
    const la = key(r, /^(lat|latitude|y)$/i), lo = key(r, /^(lon|lng|long|longitude|x)$/i);
    if (!la || !lo || isNaN(+r[la]) || isNaN(+r[lo])) return null;
    const nm = key(r, /^(name|title|label)$/i), ds = key(r, /desc|notes?|comment/i), dt = key(r, /date|time|created/i);
    return { type: 'Feature', properties: { ...r, name: nm ? r[nm] : '', description: ds ? r[ds] : '', time: dt ? r[dt] : '' }, geometry: { type: 'Point', coordinates: [+r[lo], +r[la]] } };
  }).filter(Boolean) };
}

const KIND_RULES = [['kill', /\b(kill|harvest|shot|dead|down|recovered|gut pile)\b/i], ['stand', /\b(stand|blind|tree ?stand|perch|glass(ing)?( spot| point)?)\b/i], ['camp', /\b(camp|cabin|tent)\b/i],
  ['trailcam', /\b(cam|camera|trail ?cam|tc)\b/i], ['access', /\b(truck|park(ing)?|gate|access|trail ?head|road|atv|quad)\b/i],
  ['sighting', /\b(saw|seen|sighting|spotted|bull|buck|doe|cow|calf|ram|ewe|billy|nanny|bear|moose|elk|deer|sign|rub|scrape|wallow|track|bed)\b/i]];
const SPECIES_RULES = [['Moose', /moose/i], ['Elk', /\belk\b|wapiti/i], ['White-tailed Deer', /white ?tail|\bwt\b|whitetail/i], ['Mule Deer', /mule|\bmd\b|muley|blacktail|black-tail/i],
  ['Black Bear', /black bear|\bbear\b/i], ['Grizzly Bear', /griz/i], ['Mountain Goat', /goat/i], ['Bighorn Sheep', /bighorn|sheep/i], ['Caribou', /caribou/i], ['Cougar', /cougar|lion/i],
  ['Wolf', /wolf/i], ['Coyote', /coyote/i], ['Ruffed Grouse', /ruffed|grouse/i], ['Turkey', /turkey/i]];
export const guessKind = (t) => (KIND_RULES.find(([, re]) => re.test(t)) || ['note'])[0];
export const guessSpecies = (t) => (SPECIES_RULES.find(([, re]) => re.test(t)) || [''])[0];
const textOf = (p) => [p.name, p.description, p.desc, p.folder, p.styleUrl, p.type, p.icon, p.sym].filter((x) => typeof x === 'string').join(' ');

function collect(fc, file) {
  for (const f of fc.features || []) {
    const g = f.geometry; if (!g) continue; const p = f.properties || {};
    if (g.type === 'Point') {
      const t = textOf(p); const when = p.time || p.timestamp || p.when || p.TimeStamp || '';
      const d = when && !isNaN(new Date(when)) ? new Date(when).toISOString() : null;
      items.push({ inc: true, file, name: p.name || '', kind: guessKind(t), species: guessSpecies(t), sex: /\b(bull|buck|ram|billy|boar)\b/i.test(t) ? 'M' : /\b(cow|doe|ewe|nanny|sow)\b/i.test(t) ? 'F' : '',
        lat: g.coordinates[1], lon: g.coordinates[0], ele: g.coordinates[2], observed_at: d, notes: (typeof p.description === 'string' ? p.description.replace(/<[^>]+>/g, ' ').trim() : '') || null, folder: p.folder || '' });
    } else if (g.type === 'LineString' || g.type === 'MultiLineString') {
      const lines = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
      const times = p.coordinateProperties?.times;
      const coords = lines.flat().map((c, i) => [c[0], c[1], c[2] ?? null, (Array.isArray(times?.[0]) ? times.flat() : times)?.[i] || null]);
      let km = 0; for (let i = 1; i < coords.length; i++) km += haversineKm(coords[i - 1], coords[i]);
      tracks.push({ inc: true, file, name: p.name || 'Track', coords, distance_km: +km.toFixed(2), started_at: coords[0]?.[3] || p.time || null });
    }
  }
}
function dedupe() {
  const seen = [];
  for (const it of items) {
    const near = (a) => haversineKm([a.lon, a.lat], [it.lon, it.lat]) < 0.015 && ((a.name || '') === (it.name || '') || haversineKm([a.lon, a.lat], [it.lon, it.lat]) < 0.004);
    it.dup = store.spots.some(near) ? 'existing' : seen.some(near) ? 'in file' : '';
    if (it.dup) it.inc = false; seen.push(it);
  }
  for (const t of tracks) { t.dup = store.tracks.some((x) => x.name === t.name && Math.abs((+x.distance_km || 0) - t.distance_km) < 0.05) ? 'existing' : ''; if (t.dup) t.inc = false; }
}

function preview(v) {
  const el = v.querySelector('#iPrev');
  if (!items.length && !tracks.length) { el.innerHTML = '<p class="muted">Nothing importable found.</p>'; return; }
  el.innerHTML = `<div class="card"><b>${items.length}</b> points (${items.filter((i) => i.dup).length} duplicates) · <b>${tracks.length}</b> tracks
  <div class="row" style="margin-top:6px"><span class="muted">Set ticked to:</span><select id="bKind"><option value="">kind…</option>${opts(KINDS, '')}</select>
  <input id="bSp" list="speciesList" placeholder="species…" style="width:130px"><button id="bAll" class="small">Tick all</button><button id="bNone" class="small">Untick all</button><button id="bShow" class="small">Show on map</button></div></div>
  <div class="scroll-x" style="max-height:50vh;overflow:auto"><table><thead><tr><th></th><th>Name</th><th>Kind</th><th>Species</th><th>Sex</th><th>When</th><th></th></tr></thead><tbody>
  ${items.map((it, i) => `<tr data-i="${i}"><td><input type="checkbox" data-f="inc" ${it.inc ? 'checked' : ''}></td><td><input data-f="name" value="${esc(it.name)}"><div class="muted">${esc(it.folder || it.file)}</div></td>
  <td><select data-f="kind">${opts(KINDS, it.kind)}</select></td><td><input data-f="species" list="speciesList" value="${esc(it.species)}"></td><td><select data-f="sex">${opts(['', 'M', 'F', 'Unknown'], it.sex)}</select></td>
  <td><input type="datetime-local" data-f="observed_at" value="${it.observed_at ? localDT(it.observed_at) : ''}"></td><td>${it.dup ? `<span class="chip warn">dup ${it.dup}</span>` : ''}</td></tr>`).join('')}
  ${tracks.map((t, i) => `<tr data-t="${i}"><td><input type="checkbox" data-f="inc" ${t.inc ? 'checked' : ''}></td><td colspan="4"><input data-f="name" value="${esc(t.name)}"><div class="muted">track · ${t.coords.length} pts · ${t.distance_km} km</div></td><td></td><td>${t.dup ? '<span class="chip warn">dup</span>' : ''}</td></tr>`).join('')}
  </tbody></table></div><div class="row" style="margin-top:10px"><button class="primary" id="iSave">Import ticked</button></div>`;
  el.oninput = (e) => {
    const tr = e.target.closest('tr'); const f = e.target.dataset.f; if (!tr || !f) return;
    const o = tr.dataset.i != null ? items[tr.dataset.i] : tracks[tr.dataset.t];
    o[f] = e.target.type === 'checkbox' ? e.target.checked : f === 'observed_at' ? (e.target.value ? new Date(e.target.value).toISOString() : null) : e.target.value;
  };
  el.querySelector('#bKind').onchange = (e) => { if (e.target.value) { items.forEach((it) => it.inc && (it.kind = e.target.value)); preview(v); } };
  el.querySelector('#bSp').onchange = (e) => { items.forEach((it) => it.inc && (it.species = e.target.value)); preview(v); };
  el.querySelector('#bAll').onclick = () => { items.forEach((x) => (x.inc = true)); tracks.forEach((x) => (x.inc = true)); preview(v); };
  el.querySelector('#bNone').onclick = () => { items.forEach((x) => (x.inc = false)); tracks.forEach((x) => (x.inc = false)); preview(v); };
  el.querySelector('#bShow').onclick = () => M.fitTo([...items.map((i) => [i.lon, i.lat]), ...tracks.flatMap((t) => t.coords.map((c) => [c[0], c[1]]))]);
  el.querySelector('#iSave').onclick = async () => {
    const src = v.querySelector('#iSrc').value, hunter = v.querySelector('#iHunter').value || 'Me';
    const sp = items.filter((i) => i.inc).map((i) => ({ kind: i.kind, name: i.name || null, species: i.species || null, sex: i.sex || null, hunter, lat: i.lat, lon: i.lon, observed_at: i.observed_at, notes: i.notes, source: src, extra: { file: i.file, folder: i.folder || undefined, ele: i.ele ?? undefined } }));
    const tr = tracks.filter((t) => t.inc).map((t) => ({ name: t.name, hunter, coords: t.coords, distance_km: t.distance_km, started_at: t.started_at && !isNaN(new Date(t.started_at)) ? new Date(t.started_at).toISOString() : null, source: src }));
    try {
      const a = await db.insert('spots', sp); const b = await db.insert('tracks', tr);
      toast(`Imported ${a.length} waypoints, ${b.length} tracks`); items = []; tracks = []; render(v);
      M.fitTo([...sp.map((s) => [s.lon, s.lat]), ...tr.flatMap((t) => t.coords.map((c) => [c[0], c[1]]))]);
    } catch (e) { toast('Import failed: ' + e.message, 6000); }
  };
}
