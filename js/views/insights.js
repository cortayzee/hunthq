import { store, hunters, localNote } from '../db.js?v=20261113160307-dfd309d';
import { icon } from '../icons.js?v=20261113160307-dfd309d';
import { esc, opts, yearOf, groupBy, fmtTime, tip } from '../util.js?v=20261113160307-dfd309d';
import * as M from '../map.js?v=20261113160307-dfd309d';
import { RUT, RUT_SPECIES, rutStatus, fmtMD, moonSVG, moonDay, MOON_TIPS } from '../rut.js?v=20261113160307-dfd309d';
import * as W from '../weather.js?v=20261113160307-dfd309d';
import { harvested } from '../vis.js?v=20261113160307-dfd309d';

const f = { hunter: '', species: '', from: '', to: '' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PHASES = ['New', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
export const phaseIdx = (d) => Math.round(SunCalc.getMoonIllumination(d).phase * 8) % 8;
const hourBucket = (h) => (h < 5 ? 'Night (0–5)' : h < 8 ? 'Dawn (5–8)' : h < 11 ? 'Morning (8–11)' : h < 14 ? 'Midday (11–14)' : h < 17 ? 'Afternoon (14–17)' : h < 21 ? 'Dusk (17–21)' : 'Night (21–24)');
const BUCKETS = ['Dawn (5–8)', 'Morning (8–11)', 'Midday (11–14)', 'Afternoon (14–17)', 'Dusk (17–21)', 'Night (21–24)', 'Night (0–5)'];

const ui = (() => { try { return { sub: 'rut', ...JSON.parse(localStorage.getItem('hunthq_ins') || '{}'), stage: null, day: 0 }; } catch { return { sub: 'rut', stage: null, day: 0 }; } })();
const saveUi = () => { try { localStorage.setItem('hunthq_ins', JSON.stringify({ sp: ui.sp })); } catch {} };
// The forecast spot stays put (saved per browser) until you change it.
const FKEY = 'hunthq_fpos';
let pos = (() => { try { const p = JSON.parse(localStorage.getItem(FKEY)); return p && isFinite(p.lat) && isFinite(p.lng) ? p : null; } catch { return null; } })();
export function setForecastPos(p) { pos = p; try { localStorage.setItem(FKEY, JSON.stringify(p)); } catch {} }
export function openForecast(p) { if (p) setForecastPos(p); }
export function onLeave() { M.setForecastPin(null); }
const FC_KINDS = ['camp', 'stand', 'trailcam', 'glass', 'feed', 'water', 'bedding', 'wallow', 'trailhead', 'access'];
function mySpots() {
  const out = [];
  for (const t of store.trips) if (t.lat != null && t.lon != null) out.push({ v: 't:' + t.id, label: t.name || t.area || 'Hunt', lat: +t.lat, lng: +t.lon, grp: 'Hunts' });
  for (const s of store.spots) if (FC_KINDS.includes(s.kind)) out.push({ v: 's:' + s.id, label: s.name || s.kind, lat: +s.lat, lng: +s.lon, grp: 'Waypoints', sub: (store.prefs.groups || []).find((g) => g.id === s.extra?.group_id)?.name });
  return out;
}

// Forecast page (weather, movement, rut, moon). Hunt stats live under Hunts > Stats (renderStats below).
export function render(v) {
  render.v = v;
  v.innerHTML = `<div class="page-h"><h2>Forecast</h2></div><div id="iBody"></div>`;
  renderRut(v.querySelector('#iBody'));
}
export function renderStats(body) {
  renderStats.el = body;
  const sp = [...new Set([...store.trips, ...store.spots].map((x) => x.species).filter(Boolean))].sort();
  const years = [...new Set([...store.trips.map((t) => yearOf(t.date_start)), ...store.spots.map((s) => yearOf(s.observed_at))].filter(Boolean))].sort();
  body.innerHTML = `<div class="filters"><select id="ih" aria-label="Hunter"><option value="">All hunters</option>${opts(hunters(), f.hunter)}</select>
  <select id="is" aria-label="Species"><option value="">All species</option>${opts(sp, f.species)}</select>
  <select id="if" aria-label="From year"><option value="">From year</option>${opts(years.map(String), f.from)}</select>
  <select id="it" aria-label="To year"><option value="">To year</option>${opts(years.map(String), f.to)}</select></div><div id="iOut"></div>`;
  body.querySelectorAll('select').forEach((s) => (s.onchange = () => { Object.assign(f, { hunter: body.querySelector('#ih').value, species: body.querySelector('#is').value, from: body.querySelector('#if').value, to: body.querySelector('#it').value }); draw(body); }));
  draw(body);
}

// ---- Rut & moon ----
function wmuAt(lon, lat) {
  const inRing = (r) => { let o = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) o = !o; } return o; };
  for (const f of M.WMU_GEO?.features || []) {
    const g = f.geometry; const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    if (polys.some((p) => inRing(p[0]) && !p.slice(1).some(inRing))) return f.properties.id;
  }
  return null;
}
function defaultSp() {
  const n = new Map(); for (const t of store.trips) if (RUT[t.species]) n.set(t.species, (n.get(t.species) || 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Mule Deer';
}
const short = (sp) => sp.replace('White-tailed', 'Whitetail').replace('Black-tailed', 'Blacktail').replace('Mountain ', '');
function renderRut(body) {
  if (!RUT[ui.sp]) ui.sp = defaultSp();
  if (!pos) { const m = M.map.getCenter(); setForecastPos({ lat: +m.lat.toFixed(5), lng: +m.lng.toFixed(5), label: '' }); }
  const c = pos; const mu = wmuAt(c.lng, c.lat); const now = new Date();
  M.setForecastPin(c);
  const spots = mySpots();
  const r = rutStatus(ui.sp, now);
  const sel = r.stages[ui.stage ?? -1] || r.cur || r.peak;
  const span = r.stages.reduce((a, s) => a + (s.e - s.s + 1), 0);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return { d, m: moonDay(d, c.lat, c.lng) }; });
  const md = days[ui.day] || days[0];
  const tm = (d) => fmtTime(d).replace(/^0/, ''); const tmS = (d) => tm(d).replace(/\s?([ap])\.?m\.?/i, '$1');
  const win = (w) => `${tm(w.s)}–${tm(w.e)}`;
  body.innerHTML = `
  <div class="fc-loc">
    <button class="fc-where" data-loc="show" title="Show on map"><span class="fc-dot"></span><span class="t"><b>${esc(c.label || (mu ? `Pin in WMU ${mu}` : 'Dropped pin'))}</b><span class="muted tnum">${mu && c.label ? `WMU ${esc(mu)}, ` : ''}${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}</span></span></button>
    <details class="fc-change"><summary class="small-btn">Change</summary>
      <div class="fc-menu" role="menu">
        ${spots.length ? `<div class="fc-menu-h">My spots</div>${spots.map((x) => `<button role="menuitem" data-spot="${x.v}"><span>${esc(x.label)}</span>${x.sub ? `<span class="muted">${esc(x.sub)}</span>` : ''}</button>`).join('')}<div class="fc-menu-sep"></div>` : ''}
        <button role="menuitem" data-loc="pick">${icon('pin', { size: 16 })}Pick on the map</button>
        <button role="menuitem" data-loc="center">${icon('target', { size: 16 })}Use the map centre</button>
        <button role="menuitem" data-loc="gps">${icon('globe', { size: 16 })}Use my location</button>
      </div></details>
  </div>
  <div class="rut-sps" role="group" aria-label="Species">${RUT_SPECIES.map((s) => { const st = rutStatus(s, now); const on = !!st.cur; const pk = st.cur === st.peak;
    return `<button class="rut-sp ${pk ? 'peak' : on ? 'on' : ''}" data-rsp="${esc(s)}" aria-pressed="${s === ui.sp}"><b>${esc(short(s))}</b><span>${on ? esc(st.cur.name) : 'Off season'}</span></button>`; }).join('')}</div>
  <div class="card wx-card" id="wxCard"><div class="wx-load muted">Loading weather…</div></div>
  <div class="card rut-card">
    <div class="rut-head"><b class="tip-h">${esc(short(ui.sp))}${tip(`${r.note} Tap a stage on the bar to read it. Dates are typical and shift with elevation, latitude and the year.`, 'About these rut dates')}</b><span>${esc(r.headline)}</span></div>
    <div class="rut-bar" role="list">${r.stages.map((s) => `<button role="listitem" class="seg-${s === r.peak ? 'peak' : 'x'} ${s === r.cur ? 'cur' : ''} ${s === sel ? 'sel' : ''}" data-stage="${s.i}" style="flex:${s.e - s.s + 1}" aria-label="${esc(s.name)}, ${fmtMD(s.a)} to ${fmtMD(s.b)}">
      ${s === r.cur ? `<i class="rut-now" style="left:${(((r.t - s.s) + 0.5) / (s.e - s.s + 1)) * 100}%"></i>` : ''}</button>`).join('')}</div>
    <div class="rut-labels">${r.stages.map((s) => `<span style="flex:${s.e - s.s + 1}" class="${s === sel ? 'sel' : ''}">${esc(s.name)}<em class="tnum">${fmtMD(s.a)}–${fmtMD(s.b)}</em></span>`).join('')}</div>
    <div class="rut-stage">
      <div class="rut-stage-h"><b>${esc(sel.name)}</b><span class="muted tnum">${fmtMD(sel.a)} – ${fmtMD(sel.b)}${sel === r.cur ? ' · now' : ''}</span></div>
      <div class="rut-cols"><div><h4>What they're doing</h4><ul>${sel.does.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div><h4>How to hunt it</h4><ul>${sel.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
    </div>
  </div>
  <div class="card">
    <h3 class="tip-h" style="margin:0 0 10px">Moon &amp; solunar${tip('Solunar theory says animals move more when the moon is overhead, underfoot, rising or setting, and around new and full moons. The best window is a solunar period in legal light, ideally near dawn or dusk. The evidence is mixed, so treat it as a tiebreaker: the rut, weather and pressure matter more.', 'About solunar')}</h3>
    <div class="moon-days">${days.map(({ d, m }, i) => `<button class="moon-day ${i === ui.day ? 'sel' : ''}" data-day="${i}">
      <span class="dn">${i === 0 ? 'Today' : d.toLocaleDateString('en-CA', { weekday: 'short' })}</span>${moonSVG(m.phase, 34)}<b class="tnum">${m.pct}%</b>
      <span class="stars" aria-label="Rating ${m.score} of 4">${'●'.repeat(m.score)}<i>${'●'.repeat(4 - m.score)}</i></span>
      <span class="bw tnum">${m.best ? tmS(m.best.s) : '—'}</span></button>`).join('')}</div>
    <div class="moon-detail">
      <div class="row" style="gap:10px;align-items:center">${moonSVG(md.m.phase, 52)}<div><b>${esc(md.m.name)}</b> · <span class="tnum">${md.m.pct}% lit</span><div class="muted fine" style="margin:2px 0 0">${md.d.toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric' })} · sunrise ${tm(md.m.sunrise)} · sunset ${tm(md.m.sunset)}</div></div></div>
      ${md.m.best ? `<p style="margin:10px 0 6px"><b>Best window ${win(md.m.best)}</b> <span class="muted">(${md.m.best.what})</span></p>` : '<p style="margin:10px 0 6px"><b>No solunar period in legal light.</b> <span class="muted">Hunt first and last light as usual.</span></p>'}
      ${md.m.wins.length > 1 ? `<p class="muted fine" style="margin:0 0 8px">Also: ${md.m.wins.filter((w) => w !== md.m.best).map((w) => `${win(w)} ${w.what}`).join(' · ')}</p>` : ''}
      <ul class="moon-tips">${MOON_TIPS[md.m.name].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <button class="small" data-sun style="margin-top:4px">${icon('sun', { size: 15 })}Sun &amp; moon times, 14 days</button></div>
  </div>`;
  fillWx(body.querySelector('#wxCard'), c);
  const curSp = body.querySelector('.rut-sp[aria-pressed="true"]'); if (curSp) { const box = curSp.parentElement; box.scrollLeft = Math.max(0, curSp.offsetLeft - box.offsetLeft - 16); }
  body.onclick = (e) => {
    const dd = body.querySelector('.fc-change'); if (dd?.open && (!e.target.closest('.fc-change') || e.target.closest('.fc-menu button'))) dd.removeAttribute('open');
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.wx) { ui.wx = b.dataset.wx; fillWx(body.querySelector('#wxCard'), c); return; }
    if (b.dataset.wday != null) { ui.wday = ui.wday === +b.dataset.wday ? -1 : +b.dataset.wday; fillWx(body.querySelector('#wxCard'), c); return; }
    if (b.dataset.hday != null) { ui.wx = 'hourly'; ui.hday = b.dataset.hday; fillWx(body.querySelector('#wxCard'), c, true); return; }
    if (b.dataset.spot) { const x = spots.find((y) => y.v === b.dataset.spot); if (x) { setForecastPos({ lat: x.lat, lng: x.lng, label: x.label }); M.flyTo(x.lng, x.lat, 11); renderRut(body); } return; }
    if (b.dataset.sun != null) { import('../main.js?v=20261113160307-dfd309d').then((m) => m.showTabPublic('sun')); return; }
    if (b.dataset.rsp) { ui.sp = b.dataset.rsp; ui.stage = null; saveUi(); renderRut(body); }
    else if (b.dataset.stage != null) { ui.stage = +b.dataset.stage; renderRut(body); }
    else if (b.dataset.day != null) { ui.day = +b.dataset.day; renderRut(body); }
    else if (b.dataset.loc === 'center') { const m = M.map.getCenter(); setForecastPos({ lat: m.lat, lng: m.lng, label: '' }); renderRut(body); }
    else if (b.dataset.loc === 'show') M.flyTo(c.lng, c.lat, 11);
    else if (b.dataset.loc === 'pick') {
      import('../main.js?v=20261113160307-dfd309d').then(async (mm) => { const ll = await mm.pickOnMap('Tap the map where you want the forecast'); setForecastPos({ lat: ll.lat, lng: ll.lng, label: '' }); mm.openPanel(); if (render.v?.isConnected) render(render.v); });
    }
    else if (b.dataset.loc === 'gps') navigator.geolocation?.getCurrentPosition((p) => { setForecastPos({ lat: p.coords.latitude, lng: p.coords.longitude, label: 'My location' }); renderRut(body); }, (er) => alert(er.message));
  };
}
export function onData() { if (renderStats.el?.isConnected) renderStats(renderStats.el); }

const okY = (y) => (!f.from || y >= +f.from) && (!f.to || y <= +f.to);
function draw(v) {
  const trips = store.trips.filter((t) => (!f.hunter || t.hunter === f.hunter) && (!f.species || t.species === f.species) && okY(yearOf(t.date_start)));
  const spots = store.spots.filter((s) => (!f.hunter || s.hunter === f.hunter) && (!f.species || s.species === f.species) && (!s.observed_at || okY(yearOf(s.observed_at))));
  const kills = spots.filter((s) => s.kind === 'kill');
  const hrs = trips.reduce((a, t) => a + (+t.hours || 0), 0), harv = trips.filter((t) => harvested(t)).length;
  const dayN = (t) => (t.date_end && t.date_end >= t.date_start ? Math.round((new Date(t.date_end) - new Date(t.date_start)) / 864e5) + 1 : 1);
  const days = trips.reduce((a, t) => a + dayN(t), 0);
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
    <div class="kpi"><b>${trips.length}</b><span>hunts</span></div><div class="kpi"><b>${days}</b><span>days out</span></div>
    <div class="kpi"><b>${kills.length}</b><span>animals taken</span></div>
    <div class="kpi"><b>${trips.length ? (harv / trips.length * 100).toFixed(0) + '%' : '—'}</b><span>hunts with a harvest</span></div>
    <div class="kpi"><b>${kills.length ? (days / kills.length).toFixed(1) : '—'}</b><span>days / animal</span></div>
    ${hrs ? `<div class="kpi"><b>${hrs.toFixed(0)}</b><span>hours</span></div><div class="kpi"><b>${(seen / hrs).toFixed(2)}</b><span>animals seen / hr</span></div>` : ''}
  </div>
  ${!trips.length && !spots.length ? '<p class="muted">Log hunts and waypoints to see your patterns here.</p>' : ''}
  ${table('Success by WMU', tripStats((t) => t.wmu || null))}
  ${table('Success by species', tripStats((t) => t.species || null))}
  ${table('Success by month', tripStats((t) => MONTHS[+t.date_start.slice(5, 7) - 1]), MONTHS)}
  ${table('Success by moon phase', tripStats((t) => PHASES[phaseIdx(new Date(t.date_start + 'T12:00'))]), PHASES)}
  ${table('Success by weapon', tripStats((t) => t.weapon || null))}
  ${table('Success by hunter', tripStats((t) => t.hunter || null))}
  ${countBars('Kills & sightings by time of day', groupBy(timed, (s) => hourBucket(new Date(s.observed_at).getHours())), BUCKETS, `<p class="muted">${timed.filter((s) => s.kind === 'kill').length} kills, ${timed.filter((s) => s.kind === 'sighting').length} sightings with known times.</p>`)}
  ${countBars('Kills by moon phase', groupBy(kills.filter((s) => s.observed_at), (s) => PHASES[phaseIdx(new Date(s.observed_at))]), PHASES)}
  ${countBars('Kills by WMU', groupBy(kills, (s) => s.wmu || null))}
  <div class="card"><h3 style="margin-top:0">Hotspots (5 km grid)</h3>
  <p class="muted"><span class="chip ok">productive</span> kills · <span class="chip bad">cold</span> ≥10 h hunted, no kills · <span class="chip warn">under-scouted</span> sightings but &lt;5 h hunted</p>
  <div class="row"><button id="hotOn" class="primary">Show on map</button><button id="hotOff">Hide</button></div><div id="hotT"></div></div>`;
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

// ---- Weather & movement ----
async function fillWx(el, c, scrollHours = false) {
  if (!el) return; ui.wx = ui.wx || 'week'; if (ui.wday == null) ui.wday = 0;
  let wx; try { wx = await W.fetchWx(c.lat, c.lng); } catch (e) { el.innerHTML = `<p class="muted" style="margin:0">Weather unavailable right now (${esc(e.message)}).</p>`; return; }
  if (!el.isConnected) return;
  const mu = wmuAt(c.lng, c.lat);
  const hv = await import('../wildlife.js?v=20261113160307-dfd309d').then((m) => m.harvest()).catch(() => null); if (!el.isConnected) return;
  const ab = W.abundance(hv, ui.sp, mu);
  const tz = wx.tz, mv = W.movement(wx, ui.sp, c.lat, c.lng, ab), best = W.bestByDay(mv, tz), now = Date.now();
  const abLine = ab ? `<div class="wx-ab ${ab.f < 0.5 ? 'low' : ''}"><span>${esc(short(ui.sp))} here</span><b>${esc(ab.label)}</b>${tip(`From BC hunter survey harvest density in WMU ${mu}, compared with every other unit in BC. Fewer animals means a lower movement %.${ab.f < 0.5 ? ' Few or none are taken here, so you may not see any.' : ''}`, 'How local numbers are set')}</div>` : '';
  const todayK = W.dayKey(new Date(), tz);
  const nowH = mv.find((h) => h.t <= now && +h.t + 36e5 > now) || mv.find((h) => h.t > now);
  const ring = (p, sz = 40) => { const r = sz / 2 - 3, L = 2 * Math.PI * r; return `<svg class="mv-ring ${W.levelCls(p)}" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" aria-hidden="true"><circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" class="bg"/><circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" class="fg" stroke-dasharray="${(L * p) / 100} ${L}" transform="rotate(-90 ${sz / 2} ${sz / 2})"/></svg>`; };
  const tf = (d) => W.tFmt(d, tz), th = (d) => W.tFmt(d, tz, { h: true });
  const spName = short(ui.sp);
  const days = wx.days.filter((d) => W.dayKey(d.t, tz) >= todayK);
  const dayLabel = (d, i) => (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : W.dFmt(d.t, tz, { weekday: 'long' }));
  let body = '';
  if (ui.wx === 'now') {
    const n = wx.now, b0 = best.get(todayK);
    const p3 = wx.hours.find((h) => Math.abs(h.t - (n.t - 3 * 36e5)) < 18e5)?.hpa; const dp = p3 != null ? n.hpa - p3 : 0;
    body = `<div class="wx-now">${W.wxIcon(n.code, n.day, 56)}<div><div class="wx-big tnum">${Math.round(n.temp)}°</div><div>${W.wxName(n.code)} · feels ${Math.round(n.feels)}°</div></div>
      ${nowH ? `<div class="wx-mvnow">${ring(nowH.pct, 52)}<div><b>${nowH.pct}% ${W.level(nowH.pct)}</b><span class="muted">${esc(spName)} movement now</span></div></div>` : ''}</div>
      <div class="wx-grid">
        <div><span class="muted">Wind</span><b class="row" style="gap:4px">${W.windArrow(n.dir)}${Math.round(n.wind)} km/h ${W.dirName(n.dir)}</b><small class="muted">gusts ${Math.round(n.gust)}</small></div>
        <div><span class="muted">Pressure</span><b class="tnum">${Math.round(n.hpa)} hPa</b><small class="muted">${Math.abs(dp) < 0.6 ? 'steady' : dp > 0 ? 'rising' : 'falling'} (${dp > 0 ? '+' : ''}${dp.toFixed(1)} / 3 h)</small></div>
        <div><span class="muted">Humidity</span><b class="tnum">${Math.round(n.rh)}%</b><small class="muted">cloud ${Math.round(n.cloud)}%</small></div>
        <div><span class="muted">Precip</span><b class="tnum">${n.mm.toFixed(1)} mm</b><small class="muted">right now</small></div>
      </div>
      <p class="wx-tip"><b>Scent:</b> wind is coming <b>from the ${W.dirName(n.dir)}</b>. Approach and sit on the ${W.dirName((n.dir + 180) % 360)} side of where you expect animals${n.wind < 6 ? '; it is light and may swirl, especially in draws at dawn and dusk' : ''}.</p>
      ${b0 ? `<p class="wx-why"><b>Best today ${th(b0.best.t)}:</b> ${esc(b0.why)}</p>` : ''}`;
  } else if (ui.wx === 'hourly') {
    const start = mv.findIndex((h) => +h.t + 36e5 > now);
    const hrs = mv.slice(Math.max(0, start), start + 72); let last = '';
    body = `<div class="wx-hours" id="wxHours">${hrs.map((h) => { const sep = h.dk !== last; last = h.dk;
      return `<div class="wx-h ${h.legal ? '' : 'night'} ${sep ? 'first' : ''}" ${sep ? `data-dk="${h.dk}"` : ''}><span class="dd">${sep ? (h.dk === todayK ? 'Today' : W.dFmt(h.t, tz, { weekday: 'short', day: 'numeric' })) : '&nbsp;'}</span>
        <span class="hh">${th(h.t)}</span>${W.wxIcon(h.code, h.day, 26)}<b class="tnum">${Math.round(h.temp)}°</b>
        <span class="ww tnum">${W.windArrow(h.dir, 13)}${Math.round(h.wind)} ${W.dirName(h.dir)}</span>
        <span class="pp tnum">${h.pop ? h.pop + '%' : '&nbsp;'}</span>
        <span class="mv ${W.levelCls(h.pct)} tnum"><i style="height:${h.pct}%"></i>${h.pct}%</span></div>`; }).join('')}</div>`;
  } else {
    body = `<div class="wx-days">${days.map((d, i) => { const k = W.dayKey(d.t, tz), b = best.get(k); const open = ui.wday === i;
      const moonT = SunCalc.getMoonTimes(new Date(d.t.getTime() + 12 * 36e5), c.lat, c.lng);
      return `<div class="wx-day ${open ? 'open' : ''}"><button class="wx-dh" data-wday="${i}" aria-expanded="${open}">
        ${W.wxIcon(d.code, true, 34)}<span class="dn"><b>${dayLabel(d, i)}</b><span class="muted">${W.dFmt(d.t, tz, { month: 'short', day: 'numeric' })}</span><span class="tnum hl">↑ ${Math.round(d.hi)}° <span class="muted">↓ ${Math.round(d.lo)}°</span></span></span>
        ${b ? `<span class="mv-pill ${W.levelCls(b.best.pct)}">${ring(b.best.pct, 34)}<span><b>${b.best.pct}% ${W.level(b.best.pct)}</b><span>Best ${th(b.best.t)}</span></span></span>` : ''}
        <span class="chev">${icon('chevR', { size: 16 })}</span></button>
        ${open ? `<div class="wx-dd">
          <div class="wx-dl"><span>${W.windArrow(d.dir)} Wind</span><b>${Math.round(d.wind)} km/h ${W.dirName(d.dir)} <span class="muted">· gusts ${Math.round(d.gust)}</span></b></div>
          <div class="wx-dl"><span>Precip</span><b>${d.mm ? d.mm.toFixed(1) + ' mm' : 'None'}${d.snow ? ` <span class="muted">(${d.snow.toFixed(1)} cm snow)</span>` : ''} <span class="muted">· ${d.pop ?? 0}% chance</span></b></div>
          ${b ? `<div class="wx-dl"><span>${esc(spName)} movement</span><b>${b.min}% to ${b.max}%</b></div><p class="wx-why"><b>Why ${th(b.best.t)}:</b> ${esc(b.why)}</p>` : ''}
          <div class="wx-sun"><div><span class="muted">Sunrise</span><b>${tf(d.sunrise)}</b></div><div><span class="muted">Sunset</span><b>${tf(d.sunset)}</b></div>
            <div><span class="muted">Moonrise</span><b>${moonT.rise ? tf(moonT.rise) : '—'}</b></div><div><span class="muted">Moonset</span><b>${moonT.set ? tf(moonT.set) : '—'}</b></div></div>
          <button class="small" data-hday="${k}">Hour by hour ${icon('chevR', { size: 14 })}</button>
        </div>` : ''}</div>`; }).join('')}</div>`;
  }
  el.innerHTML = `<div class="wx-top"><h3 class="tip-h" style="margin:0">Weather &amp; movement${tip(`The % is a movement index for ${spName}: our estimate from how common they are in this WMU, first and last light, the rut stage, temperature drops, pressure changes around fronts, wind, rain and snow, and solunar periods. It isn't trained on trail-cam photos, so use it to compare days and hours rather than as a true probability. In Hourly, dimmed hours are outside legal light and blue % is the chance of rain or snow. Weather from Open-Meteo.`, 'How the movement index works')}</h3><span class="muted fine" style="margin:0">${Math.round(wx.elev)} m elevation</span></div>
    <div class="seg wx-seg" role="tablist">${[['now', 'Now'], ['hourly', 'Hourly'], ['week', '7 days']].map(([k, n]) => `<button data-wx="${k}" class="${ui.wx === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    ${abLine}${body}`;
  if (scrollHours && ui.hday) { const sep = el.querySelector(`.wx-h[data-dk="${ui.hday}"]`); if (sep) el.querySelector('#wxHours').scrollLeft = sep.offsetLeft - 8; }
}
