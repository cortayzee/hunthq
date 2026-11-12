import { store, hunters } from '../db.js?v=20261112230742-8367d80';
import { esc, opts, yearOf, groupBy } from '../util.js?v=20261112230742-8367d80';
import * as M from '../map.js?v=20261112230742-8367d80';
import { harvested } from '../vis.js?v=20261112230742-8367d80';

const f = { hunter: '', species: '', from: '', to: '' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PHASES = ['New', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
export const phaseIdx = (d) => Math.round(SunCalc.getMoonIllumination(d).phase * 8) % 8;
const hourBucket = (h) => (h < 5 ? 'Night (0–5)' : h < 8 ? 'Dawn (5–8)' : h < 11 ? 'Morning (8–11)' : h < 14 ? 'Midday (11–14)' : h < 17 ? 'Afternoon (14–17)' : h < 21 ? 'Dusk (17–21)' : 'Night (21–24)');
const BUCKETS = ['Dawn (5–8)', 'Morning (8–11)', 'Midday (11–14)', 'Afternoon (14–17)', 'Dusk (17–21)', 'Night (21–24)', 'Night (0–5)'];

export function render(v) {
  const sp = [...new Set([...store.trips, ...store.spots].map((x) => x.species).filter(Boolean))].sort();
  const years = [...new Set([...store.trips.map((t) => yearOf(t.date_start)), ...store.spots.map((s) => yearOf(s.observed_at))].filter(Boolean))].sort();
  v.innerHTML = `<h2>Insights</h2>
  <div class="grid2"><select id="ih"><option value="">All hunters</option>${opts(hunters(), f.hunter)}</select>
  <select id="is"><option value="">All species</option>${opts(sp, f.species)}</select>
  <select id="if"><option value="">From year</option>${opts(years.map(String), f.from)}</select>
  <select id="it"><option value="">To year</option>${opts(years.map(String), f.to)}</select></div><div id="iOut"></div>`;
  v.querySelectorAll('select').forEach((s) => (s.onchange = () => { Object.assign(f, { hunter: v.querySelector('#ih').value, species: v.querySelector('#is').value, from: v.querySelector('#if').value, to: v.querySelector('#it').value }); draw(v); }));
  draw(v); render.v = v;
}
export function onData() { if (render.v?.isConnected) draw(render.v); }

const okY = (y) => (!f.from || y >= +f.from) && (!f.to || y <= +f.to);
function draw(v) {
  const trips = store.trips.filter((t) => (!f.hunter || t.hunter === f.hunter) && (!f.species || t.species === f.species) && okY(yearOf(t.date_start)));
  const spots = store.spots.filter((s) => (!f.hunter || s.hunter === f.hunter) && (!f.species || s.species === f.species) && (!s.observed_at || okY(yearOf(s.observed_at))));
  const kills = spots.filter((s) => s.kind === 'kill');
  const hrs = trips.reduce((a, t) => a + (+t.hours || 0), 0), harv = trips.filter((t) => harvested(t)).length;
  const seen = trips.reduce((a, t) => a + (+t.animals_seen || 0), 0);
  const tripStats = (key) => {
    const g = groupBy(trips, key);
    return [...g].map(([k, ts]) => { const h = ts.filter((t) => harvested(t)).length; const hr = ts.reduce((a, t) => a + (+t.hours || 0), 0); return { k, n: ts.length, h, rate: h / ts.length, hr, hph: h ? hr / h : null }; });
  };
  const table = (title, rows, order) => {
    if (!rows.length) return '';
    if (order) rows.sort((a, b) => order.indexOf(a.k) - order.indexOf(b.k)); else rows.sort((a, b) => b.rate - a.rate || b.n - a.n);
    return `<div class="card"><h3 style="margin-top:0">${title}</h3><div class="bars">${rows.map((r) => `<span>${esc(r.k)}</span><div class="bar"><span style="width:${(r.rate * 100).toFixed(0)}%"></span></div>
      <span class="muted">${(r.rate * 100).toFixed(0)}% · ${r.h}/${r.n}${r.hph ? ` · ${r.hph.toFixed(0)}h/kill` : ''}</span>`).join('')}</div></div>`;
  };
  const countBars = (title, m, order, note = '') => {
    const rows = [...m].map(([k, xs]) => ({ k, n: xs.length })); if (!rows.length) return '';
    if (order) rows.sort((a, b) => order.indexOf(a.k) - order.indexOf(b.k));
    const max = Math.max(...rows.map((r) => r.n));
    return `<div class="card"><h3 style="margin-top:0">${title}</h3>${note}<div class="bars">${rows.map((r) => `<span>${esc(r.k)}</span><div class="bar"><span style="width:${(r.n / max * 100).toFixed(0)}%"></span></div><span class="muted">${r.n}</span>`).join('')}</div></div>`;
  };
  const timed = spots.filter((s) => s.observed_at && !s.extra?.time_unknown && ['kill', 'sighting'].includes(s.kind));
  v.querySelector('#iOut').innerHTML = `
  <div class="kpis" style="margin:10px 0">
    <div class="kpi"><b>${trips.length}</b><span>trips / days</span></div><div class="kpi"><b>${hrs.toFixed(0)}</b><span>hours</span></div>
    <div class="kpi"><b>${harv}</b><span>trip harvests</span></div><div class="kpi"><b>${kills.length}</b><span>kill waypoints</span></div>
    <div class="kpi"><b>${trips.length ? (harv / trips.length * 100).toFixed(0) + '%' : '—'}</b><span>success / trip</span></div>
    <div class="kpi"><b>${harv ? (hrs / harv).toFixed(1) : '—'}</b><span>hours / harvest</span></div>
    <div class="kpi"><b>${hrs ? (seen / hrs).toFixed(2) : '—'}</b><span>animals seen / hr</span></div>
  </div>
  ${!trips.length && !spots.length ? '<p class="muted">Log trips and waypoints (or bulk-enter past seasons) to see patterns here.</p>' : ''}
  ${table('Success by WMU', tripStats((t) => t.wmu || null))}
  ${table('Success by species', tripStats((t) => t.species || null))}
  ${table('Success by month', tripStats((t) => MONTHS[+t.date_start.slice(5, 7) - 1]), MONTHS)}
  ${table('Success by moon phase', tripStats((t) => PHASES[phaseIdx(new Date(t.date_start + 'T12:00'))]), PHASES)}
  ${table('Success by weapon', tripStats((t) => t.weapon || null))}
  ${table('Success by hunter', tripStats((t) => t.hunter || null))}
  ${countBars('Kills & sightings by time of day', groupBy(timed, (s) => hourBucket(new Date(s.observed_at).getHours())), BUCKETS, `<p class="muted">${timed.filter((s) => s.kind === 'kill').length} kills, ${timed.filter((s) => s.kind === 'sighting').length} sightings with known times.</p>`)}
  ${countBars('Kills by moon phase', groupBy(kills.filter((s) => s.observed_at), (s) => PHASES[phaseIdx(new Date(s.observed_at))]), PHASES)}
  ${countBars('Kills by WMU', groupBy(kills, (s) => s.wmu || null))}
  <div class="card"><h3 style="margin-top:0">Hotspot grid (~5 km cells)</h3>
  <p class="muted"><span class="chip ok">productive</span> kills · <span class="chip bad">cold</span> ≥10 h hunted, no kills · <span class="chip warn">under-scouted</span> sightings but &lt;5 h hunted</p>
  <div class="row"><button id="hotOn" class="primary">Show on map</button><button id="hotOff">Hide</button></div><div id="hotT"></div></div>
  <p class="muted">For deeper “where should I hunt next” analysis, ask Claude to read the hunt_* tables via the Supabase MCP.</p>`;
  const cells = hotspots(trips, spots);
  v.querySelector('#hotT').innerHTML = `<table><thead><tr><th>Cell</th><th>Kills</th><th>Sightings</th><th>Hours</th><th>Class</th></tr></thead><tbody>${cells.slice(0, 25).map((c) => `<tr><td><a href="#" data-c="${c.lon},${c.lat}">${c.lat.toFixed(2)}, ${c.lon.toFixed(2)}</a>${c.wmu ? `<div class="muted">${esc(c.wmu)}</div>` : ''}</td><td>${c.kills}</td><td>${c.sight}</td><td>${c.hours.toFixed(0)}</td><td><span class="chip ${c.cls === 'productive' ? 'ok' : c.cls === 'cold' ? 'bad' : c.cls === 'under-scouted' ? 'warn' : ''}">${c.cls}</span></td></tr>`).join('')}</tbody></table>`;
  v.querySelector('#hotT').onclick = (e) => { const c = e.target.dataset.c; if (c) { e.preventDefault(); const [lo, la] = c.split(',').map(Number); M.flyTo(lo, la, 12); } };
  v.querySelector('#hotOn').onclick = () => { M.setHotspots(hotGeo(cells)); const pts = cells.map((c) => [c.lon, c.lat]); M.fitTo(pts); };
  v.querySelector('#hotOff').onclick = () => M.setHotspots(null);
}

const DLAT = 0.045, DLON = 0.07;
export function hotspots(trips, spots) {
  const m = new Map();
  const cell = (lat, lon) => { const i = Math.floor(lat / DLAT), j = Math.floor(lon / DLON), k = i + ':' + j;
    if (!m.has(k)) m.set(k, { i, j, lat: (i + 0.5) * DLAT, lon: (j + 0.5) * DLON, kills: 0, sight: 0, hours: 0, trips: 0, wmus: new Map() }); return m.get(k); };
  for (const s of spots) { const c = cell(s.lat, s.lon); if (s.kind === 'kill') c.kills++; if (s.kind === 'sighting') c.sight++; if (s.wmu) c.wmus.set(s.wmu, (c.wmus.get(s.wmu) || 0) + 1); }
  for (const t of trips) { if (t.lat == null || t.lon == null) continue; const c = cell(+t.lat, +t.lon); c.hours += +t.hours || 0; c.trips++; if (harvested(t) && !spots.some((s) => s.kind === 'kill')) c.kills++; c.sight += +t.animals_seen ? 1 : 0; }
  const out = [...m.values()].map((c) => ({ ...c, wmu: [...c.wmus].sort((a, b) => b[1] - a[1])[0]?.[0] || '',
    cls: c.kills > 0 ? 'productive' : c.hours >= 10 ? 'cold' : c.sight >= 2 && c.hours < 5 ? 'under-scouted' : 'neutral' }));
  return out.sort((a, b) => b.kills - a.kills || b.sight - a.sight || b.hours - a.hours);
}
function hotGeo(cells) {
  const col = { productive: '#2f9e44', cold: '#c92a2a', 'under-scouted': '#f2c200', neutral: '#868e96' };
  return { type: 'FeatureCollection', features: cells.map((c) => ({ type: 'Feature', properties: { color: col[c.cls] }, geometry: { type: 'Polygon', coordinates: [[[c.j * DLON, c.i * DLAT], [(c.j + 1) * DLON, c.i * DLAT], [(c.j + 1) * DLON, (c.i + 1) * DLAT], [c.j * DLON, (c.i + 1) * DLAT], [c.j * DLON, c.i * DLAT]]] } })) };
}
