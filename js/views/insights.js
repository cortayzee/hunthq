import { store, hunters, localNote } from '../db.js?v=20261113062851-c4a0a29';
import { esc, opts, yearOf, groupBy, fmtTime } from '../util.js?v=20261113062851-c4a0a29';
import * as M from '../map.js?v=20261113062851-c4a0a29';
import { RUT, RUT_SPECIES, rutStatus, fmtMD, moonSVG, moonDay, MOON_TIPS } from '../rut.js?v=20261113062851-c4a0a29';
import { harvested } from '../vis.js?v=20261113062851-c4a0a29';

const f = { hunter: '', species: '', from: '', to: '' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PHASES = ['New', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
export const phaseIdx = (d) => Math.round(SunCalc.getMoonIllumination(d).phase * 8) % 8;
const hourBucket = (h) => (h < 5 ? 'Night (0–5)' : h < 8 ? 'Dawn (5–8)' : h < 11 ? 'Morning (8–11)' : h < 14 ? 'Midday (11–14)' : h < 17 ? 'Afternoon (14–17)' : h < 21 ? 'Dusk (17–21)' : 'Night (21–24)');
const BUCKETS = ['Dawn (5–8)', 'Morning (8–11)', 'Midday (11–14)', 'Afternoon (14–17)', 'Dusk (17–21)', 'Night (21–24)', 'Night (0–5)'];

const ui = (() => { try { return { sub: 'rut', ...JSON.parse(localStorage.getItem('hunthq_ins') || '{}'), stage: null, day: 0 }; } catch { return { sub: 'rut', stage: null, day: 0 }; } })();
const saveUi = () => { try { localStorage.setItem('hunthq_ins', JSON.stringify({ sub: ui.sub, sp: ui.sp })); } catch {} };
let pos = null;

export function render(v) {
  render.v = v;
  v.innerHTML = `<h2>Insights</h2>${localNote()}
  <div class="seg" role="tablist" style="margin-bottom:12px"><button data-sub="rut" class="${ui.sub === 'rut' ? 'on' : ''}">Rut &amp; moon</button><button data-sub="mine" class="${ui.sub === 'mine' ? 'on' : ''}">My hunts</button></div><div id="iBody"></div>`;
  v.querySelector('.seg').onclick = (e) => { const b = e.target.closest('[data-sub]'); if (b) { ui.sub = b.dataset.sub; saveUi(); render(v); } };
  const body = v.querySelector('#iBody');
  if (ui.sub === 'rut') return renderRut(body);
  const sp = [...new Set([...store.trips, ...store.spots].map((x) => x.species).filter(Boolean))].sort();
  const years = [...new Set([...store.trips.map((t) => yearOf(t.date_start)), ...store.spots.map((s) => yearOf(s.observed_at))].filter(Boolean))].sort();
  body.innerHTML = `<div class="grid2"><select id="ih"><option value="">All hunters</option>${opts(hunters(), f.hunter)}</select>
  <select id="is"><option value="">All species</option>${opts(sp, f.species)}</select>
  <select id="if"><option value="">From year</option>${opts(years.map(String), f.from)}</select>
  <select id="it"><option value="">To year</option>${opts(years.map(String), f.to)}</select></div><div id="iOut"></div>`;
  body.querySelectorAll('select').forEach((s) => (s.onchange = () => { Object.assign(f, { hunter: v.querySelector('#ih').value, species: v.querySelector('#is').value, from: v.querySelector('#if').value, to: v.querySelector('#it').value }); draw(v); }));
  draw(v);
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
  const c = pos || M.map.getCenter(); const mu = wmuAt(c.lng, c.lat); const now = new Date();
  const r = rutStatus(ui.sp, now);
  const sel = r.stages[ui.stage ?? -1] || r.cur || r.peak;
  const span = r.stages.reduce((a, s) => a + (s.e - s.s + 1), 0);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return { d, m: moonDay(d, c.lat, c.lng) }; });
  const md = days[ui.day] || days[0];
  const tm = (d) => fmtTime(d).replace(/^0/, ''); const tmS = (d) => tm(d).replace(/\s?([ap])\.?m\.?/i, '$1');
  const win = (w) => `${tm(w.s)}–${tm(w.e)}`;
  body.innerHTML = `
  <div class="rut-loc"><span>For <b class="tnum">${c.lat.toFixed(3)}, ${c.lng.toFixed(3)}</b>${mu ? ` · WMU ${esc(mu)}` : ''}</span>
    <span class="row" style="gap:6px"><button class="small" data-loc="center">Map centre</button><button class="small" data-loc="gps">GPS</button></span></div>
  <div class="rut-sps">${RUT_SPECIES.map((s) => { const st = rutStatus(s, now); const on = !!st.cur; const pk = st.cur === st.peak;
    return `<button class="rut-sp ${pk ? 'peak' : on ? 'on' : ''}" data-rsp="${esc(s)}" aria-pressed="${s === ui.sp}"><b>${esc(short(s))}</b><span>${on ? esc(st.cur.name) : 'Off season'}</span></button>`; }).join('')}</div>
  <div class="card rut-card">
    <div class="rut-head"><b>${esc(short(ui.sp))}</b><span>${esc(r.headline)}</span></div>
    <div class="rut-bar" role="list">${r.stages.map((s) => `<button role="listitem" class="seg-${s === r.peak ? 'peak' : 'x'} ${s === r.cur ? 'cur' : ''} ${s === sel ? 'sel' : ''}" data-stage="${s.i}" style="flex:${s.e - s.s + 1}" aria-label="${esc(s.name)}, ${fmtMD(s.a)} to ${fmtMD(s.b)}">
      ${s === r.cur ? `<i class="rut-now" style="left:${(((r.t - s.s) + 0.5) / (s.e - s.s + 1)) * 100}%"></i>` : ''}</button>`).join('')}</div>
    <div class="rut-labels">${r.stages.map((s) => `<span style="flex:${s.e - s.s + 1}" class="${s === sel ? 'sel' : ''}">${esc(s.name)}<em class="tnum">${fmtMD(s.a)}–${fmtMD(s.b)}</em></span>`).join('')}</div>
    <div class="rut-stage">
      <div class="rut-stage-h"><b>${esc(sel.name)}</b><span class="muted tnum">${fmtMD(sel.a)} – ${fmtMD(sel.b)}${sel === r.cur ? ' · now' : ''}</span></div>
      <div class="rut-cols"><div><h4>What they're doing</h4><ul>${sel.does.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div><h4>How to hunt it</h4><ul>${sel.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
      <p class="muted fine">Tap a stage on the bar to read it. ${esc(r.note)} Dates are typical and move with elevation, latitude and the year.</p>
    </div>
  </div>
  <div class="card">
    <h3 style="margin:0 0 2px">Moon &amp; solunar</h3><p class="muted fine" style="margin:0 0 10px">Next 7 days. Best window = a solunar period during legal light, favouring dawn and dusk.</p>
    <div class="moon-days">${days.map(({ d, m }, i) => `<button class="moon-day ${i === ui.day ? 'sel' : ''}" data-day="${i}">
      <span class="dn">${i === 0 ? 'Today' : d.toLocaleDateString('en-CA', { weekday: 'short' })}</span>${moonSVG(m.phase, 34)}<b class="tnum">${m.pct}%</b>
      <span class="stars" aria-label="Rating ${m.score} of 4">${'●'.repeat(m.score)}<i>${'●'.repeat(4 - m.score)}</i></span>
      <span class="bw tnum">${m.best ? tmS(m.best.s) : '—'}</span></button>`).join('')}</div>
    <div class="moon-detail">
      <div class="row" style="gap:10px;align-items:center">${moonSVG(md.m.phase, 52)}<div><b>${esc(md.m.name)}</b> · <span class="tnum">${md.m.pct}% lit</span><div class="muted fine" style="margin:2px 0 0">${md.d.toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric' })} · sunrise ${tm(md.m.sunrise)} · sunset ${tm(md.m.sunset)}</div></div></div>
      ${md.m.best ? `<p style="margin:10px 0 6px"><b>Best window ${win(md.m.best)}</b> <span class="muted">(${md.m.best.what})</span></p>` : '<p style="margin:10px 0 6px"><b>No solunar period in legal light.</b> <span class="muted">Hunt first and last light as usual.</span></p>'}
      ${md.m.wins.length > 1 ? `<p class="muted fine" style="margin:0 0 8px">Also: ${md.m.wins.filter((w) => w !== md.m.best).map((w) => `${win(w)} ${w.what}`).join(' · ')}</p>` : ''}
      <ul class="moon-tips">${MOON_TIPS[md.m.name].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="muted fine">Solunar theory says animals move more when the moon is overhead, underfoot, rising or setting, and most around new and full moons. Evidence is mixed, so use it as a tiebreaker. The rut, weather and hunting pressure matter more.</p>
    </div>
  </div>`;
  body.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.rsp) { ui.sp = b.dataset.rsp; ui.stage = null; saveUi(); renderRut(body); }
    else if (b.dataset.stage != null) { ui.stage = +b.dataset.stage; renderRut(body); }
    else if (b.dataset.day != null) { ui.day = +b.dataset.day; renderRut(body); }
    else if (b.dataset.loc === 'center') { pos = null; renderRut(body); }
    else if (b.dataset.loc === 'gps') navigator.geolocation?.getCurrentPosition((p) => { pos = { lat: p.coords.latitude, lng: p.coords.longitude }; renderRut(body); }, (er) => alert(er.message));
  };
}
export function onData() { if (render.v?.isConnected && ui.sub === 'mine') render(render.v); }

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
