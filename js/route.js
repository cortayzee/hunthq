// Draw a route by tapping the map: live distance / climb / time / difficulty, elevation profile, save as a track.
import * as db from './db.js?v=20261114004928-4d6f117';
import { store } from './db.js?v=20261114004928-4d6f117';
import * as M from './map.js?v=20261114004928-4d6f117';
import { esc, toast, haversineKm, fmtDate, tip } from './util.js?v=20261114004928-4d6f117';
import { icon } from './icons.js?v=20261114004928-4d6f117';
import { profile, stats, MODES, fmtHours, fmtKm } from './elevation.js?v=20261114004928-4d6f117';
import * as V from './vis.js?v=20261114004928-4d6f117';

const st = { on: false, pts: [], mode: 'trail', prof: [], seq: 0, hist: [], sel: null, edit: null, eatClick: false };
let bar = null;
const lineFC = (pts) => ({ type: 'FeatureCollection', features: pts.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } }] : [] });
const ptsFC = (pts) => ({ type: 'FeatureCollection', features: pts.map((c, i) => ({ type: 'Feature', properties: { i, end: i === pts.length - 1 ? 1 : 0, sel: i === st.sel ? 1 : 0 }, geometry: { type: 'Point', coordinates: c } })) });
// Handles halfway along each segment: drag one to insert a point there.
const midFC = (pts) => ({ type: 'FeatureCollection', features: pts.slice(1).map((c, i) => ({ type: 'Feature', properties: { i }, geometry: { type: 'Point', coordinates: [(pts[i][0] + c[0]) / 2, (pts[i][1] + c[1]) / 2] } })) });
const flatKm = (pts) => pts.slice(1).reduce((a, c, i) => a + haversineKm(pts[i], c), 0);
const round = (ll) => [+ll.lng.toFixed(6), +ll.lat.toFixed(6)];

export const drawing = () => st.on;
// start(mode, existing points, track being edited)
export function start(mode = st.mode, pts = [], edit = null) {
  M.setRoutePreview(null);
  st.on = true; st.pts = pts.map((c) => [c[0], c[1]]); st.prof = []; st.mode = mode; st.hist = []; st.sel = null; st.edit = edit;
  M.map.doubleClickZoom.disable();
  document.getElementById('app').classList.add('draw-mode');
  if (!bar) { bar = document.createElement('div'); bar.className = 'route-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Route drawing'); document.getElementById('app').append(bar); }
  wireDrag(true); addEventListener('keydown', onKey, true);
  drawBar(); redraw();
  if (st.pts.length > 1) M.fitTo(st.pts);
}
export function stop() {
  st.on = false; M.map.doubleClickZoom.enable(); document.getElementById('app').classList.remove('draw-mode');
  wireDrag(false); removeEventListener('keydown', onKey, true);
  bar?.remove(); bar = null; M.setDraw(lineFC([]), ptsFC([]), midFC([]));
}
const change = (pts, sel = null) => { st.hist.push(st.pts.map((c) => c.slice())); if (st.hist.length > 100) st.hist.shift(); st.pts = pts; st.sel = sel; redraw(); };
export function add(ll) {
  if (st.eatClick) { st.eatClick = false; return; } // the tap that ended a drag / selected a point
  if (st.sel != null) { st.sel = null; redraw(); return; } // first tap elsewhere just deselects
  change([...st.pts, round(ll)]);
}
function undo() { if (!st.hist.length) return; st.pts = st.hist.pop(); st.sel = null; redraw(); }
function removePoint() {
  if (!st.pts.length) return;
  const i = st.sel ?? st.pts.length - 1;
  change(st.pts.filter((_, j) => j !== i), null);
}

// Drag a vertex to move it; drag a midpoint handle to insert a vertex. Works with mouse and touch.
let dragging = null;
function onDown(e) {
  const f = e.features?.[0]; if (!f) return;
  e.preventDefault(); st.eatClick = true;
  const before = st.pts.map((c) => c.slice());
  let i = f.properties.i;
  if (f.layer.id === 'draw-mid') { st.pts.splice(i + 1, 0, round(e.lngLat)); i += 1; }
  dragging = { i, before, x: e.point.x, y: e.point.y, moved: f.layer.id === 'draw-mid', mid: f.layer.id === 'draw-mid' };
  M.map.dragPan.disable(); M.map.getCanvas().style.cursor = 'grabbing';
}
function onMove(e) {
  if (!dragging) return;
  if (Math.abs(e.point.x - dragging.x) + Math.abs(e.point.y - dragging.y) > 3) dragging.moved = true;
  if (!dragging.moved) return;
  st.pts[dragging.i] = round(e.lngLat); st.sel = dragging.i;
  M.setDraw(lineFC(st.pts), ptsFC(st.pts), midFC(st.pts));
}
function onUp() {
  if (!dragging) return;
  const d = dragging; dragging = null; M.map.dragPan.enable(); M.map.getCanvas().style.cursor = '';
  if (d.moved) { st.hist.push(d.before); st.sel = d.i; redraw(); }
  else { st.sel = st.sel === d.i ? null : d.i; redraw(); } // a plain tap selects / deselects the point
  setTimeout(() => { st.eatClick = false; }, 350);
}
const hover = (on) => () => { if (!dragging) M.map.getCanvas().style.cursor = on ? 'grab' : ''; };
function wireDrag(on) {
  const m = M.map; const f = on ? 'on' : 'off';
  for (const l of ['draw-pts', 'draw-mid']) {
    m[f]('mousedown', l, onDown); m[f]('touchstart', l, onDown);
    m[f]('mouseenter', l, hoverOn); m[f]('mouseleave', l, hoverOff);
  }
  m[f]('mousemove', onMove); m[f]('touchmove', onMove); m[f]('mouseup', onUp); m[f]('touchend', onUp);
}
const hoverOn = hover(true), hoverOff = hover(false);
function onKey(e) {
  if (!st.on || e.target.closest?.('input, textarea, select')) return;
  if ((e.key === 'Backspace' || e.key === 'Delete') && st.pts.length) { e.preventDefault(); removePoint(); }
  else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  else if (e.key === 'Escape' && st.sel != null) { e.stopImmediatePropagation(); st.sel = null; redraw(); }
  else if (e.key === 'Enter' && st.pts.length > 1) { e.preventDefault(); finish(); }
}

let profT;
function redraw() {
  M.setDraw(lineFC(st.pts), ptsFC(st.pts), midFC(st.pts));
  drawBar();
  clearTimeout(profT); const seq = ++st.seq;
  if (st.pts.length > 1) profT = setTimeout(async () => { const p = await profile(st.pts); if (seq === st.seq) { st.prof = p; drawBar(); } }, 250);
  else st.prof = [];
}
function statLine(s, km) {
  return `<div class="rb-stats"><div><b class="tnum">${fmtKm(km)}</b><span>distance</span></div>
    <div><b class="tnum">${s ? '↑' + Math.round(s.up) + ' m' : '…'}</b><span>${s ? '↓' + Math.round(s.down) + ' m' : 'climb'}</span></div>
    <div><b class="tnum">${s ? fmtHours(s.hours) : '…'}</b><span>${MODES[st.mode].foot ? 'on foot' : 'driving'}</span></div>
    <div><b>${s ? esc(s.difficulty.split(',')[0]) : '…'}</b><span>difficulty</span></div></div>`;
}
async function finish() {
  const pts = st.pts.slice(); const mode = st.mode; const prof = st.prof.length ? st.prof : await profile(pts); const edit = st.edit;
  stop();
  openRoute(edit ? { ...edit, coords: pts, extra: { ...(edit.extra || {}), mode }, _edited: true } : { coords: pts.map((c) => [c[0], c[1]]), extra: { mode } }, prof);
}
function drawBar() {
  if (!bar) return;
  const km = flatKm(st.pts); const s = st.prof.length ? stats(st.prof, st.mode) : null;
  const help = 'Tap the map to add points. Drag a point to move it. Drag a small dot between two points to add one there. Tap a point to select it, then Delete point. Keys: Backspace deletes, Ctrl/Cmd+Z undoes, Enter finishes.';
  bar.innerHTML = `${st.pts.length < 2 ? `<div class="rb-hint">${icon('route', { size: 18 })}<span>Tap the map to add points along the trail or road</span>${tip(help, 'How to edit the line')}</div>` : statLine(s, km)}
    <div class="rb-modes" role="radiogroup" aria-label="Travel mode">${Object.entries(MODES).map(([id, m]) => `<button role="radio" aria-checked="${st.mode === id}" data-mode="${id}" style="--k:${m.color}">${esc(m.name.split(' (')[0].replace(' / side-by-side', ''))}</button>`).join('')}${st.pts.length >= 2 ? tip(help, 'How to edit the line') : ''}</div>
    <div class="rb-actions">
      <button id="rbUndo" ${st.hist.length ? '' : 'disabled'} aria-label="Undo">${icon('history', { size: 18 })}<span>Undo</span></button>
      <button id="rbDel" ${st.pts.length ? '' : 'disabled'}>${icon('trash', { size: 18 })}<span>${st.sel != null ? 'Delete point' : 'Remove last'}</span></button>
      <span style="flex:1"></span>
      <button id="rbCancel">Cancel</button>
      <button class="primary" id="rbDone" ${st.pts.length > 1 ? '' : 'disabled'}>${st.edit ? 'Done editing' : 'Done'}</button></div>`;
  bar.onclick = async (e) => {
    const m = e.target.closest('[data-mode]'); if (m) { st.mode = m.dataset.mode; drawBar(); return; }
    if (e.target.closest('#rbUndo')) undo();
    if (e.target.closest('#rbDel')) removePoint();
    if (e.target.closest('#rbCancel')) { if (st.edit) { const t = st.edit; stop(); openRoute(t); } else if (st.pts.length < 3 || confirm('Discard this route?')) stop(); }
    if (e.target.closest('#rbDone')) finish();
  };
}

// ---- Route detail (new or saved track) ----
export async function openRoute(track, prof) {
  const { openPanel } = await import('./main.js?v=20261114004928-4d6f117');
  openPanel();
  const v = document.getElementById('view'); v.scrollTop = 0;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.remove('active'));
  const isNew = !track.id; const coords = (track.coords || []).map((c) => [c[0], c[1]]);
  let mode = track.extra?.mode || 'trail';
  M.setRoutePreview(null);
  v.innerHTML = `<div class="detail-h"><button class="small" id="rBack">${icon('chevL', { size: 16 })}Back</button><div class="row"><button class="small" id="rEditLine">${icon('ruler', { size: 16 })}Edit line</button>${isNew ? '' : '<button class="small danger" id="rDel">Delete</button>'}</div></div>
    <h2 style="margin-bottom:2px">${isNew ? 'New route' : esc(track.name || 'Route')}</h2>
    <div class="muted">${isNew ? 'Check the numbers, then save it to your map.' : esc([track.hunter, track.started_at && fmtDate(track.started_at), track.source && track.source !== 'drawn' ? 'imported' : ''].filter(Boolean).join(' · '))}</div>
    <div class="rb-modes" id="rModes" style="margin:14px 0 6px">${Object.entries(MODES).map(([id, m]) => `<button role="radio" aria-checked="${mode === id}" data-mode="${id}" style="--k:${m.color}">${esc(m.name)}</button>`).join('')}</div>
    <div id="rStats"><div class="skeleton" style="height:60px;border-radius:12px"></div></div>
    <div class="prof-wrap"><svg id="rProf" class="prof" viewBox="0 0 600 170" role="img" aria-label="Elevation profile"></svg><div id="rRead" class="prof-read muted">Elevation. Drag across it to find the spot on the map.</div></div>
    <form id="rForm" class="grid2" style="margin-top:14px">
      <label class="span2">Name <input name="name" value="${esc(track.name || '')}" placeholder="e.g. Ridge trail to glassing knob" required></label>
      <label>Hunt <select name="trip_id"><option value="">None</option>${[...store.trips].sort((a, b) => String(b.date_start).localeCompare(String(a.date_start))).map((t) => `<option value="${t.id}" ${track.extra?.trip_id === t.id ? 'selected' : ''}>${esc(V.tripTitle(t))}</option>`).join('')}</select></label>
      <label>Group <select name="group_id"><option value="">None</option>${V.groups().map((g) => `<option value="${g.id}" ${track.extra?.group_id === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>
      <label class="span2">Notes <textarea name="notes" placeholder="Water, deadfall, where the trail fades…">${esc(track.extra?.notes || '')}</textarea></label>
      <div class="span2 row"><button class="primary" type="submit">${isNew ? 'Save route' : 'Save changes'}</button><button type="button" id="rFit">${icon('pin', { size: 16 })}Show on map</button></div>
    </form>`;
  // Imported GPS tracks carry their own elevations; drawn routes re-sample the DEM densely.
  if (!prof) prof = track.source !== 'drawn' && track.coords?.filter((c) => c[2] != null).length > track.coords.length * 0.8 ? fromGps(track.coords) : await profile(coords);
  const draw = () => {
    const s = stats(prof, mode);
    v.querySelector('#rStats').innerHTML = `<div class="kpis route-kpis">
      <div class="kpi"><b class="tnum">${fmtKm(s.dist)}</b><span>distance</span></div>
      <div class="kpi"><b class="tnum">${fmtHours(s.hours)}</b><span class="tip-h">${MODES[mode].foot ? 'on foot' : 'drive time'}${tip(`Estimated with Tobler's hiking function, which slows on climbs and steep descents${MODES[mode].foot ? '' : '. Vehicles use an average speed plus time for climbing'}. Rest stops and glassing aren't included.`, 'How time is estimated')}</span></div>
      <div class="kpi"><b class="tnum">↑ ${Math.round(s.up)} m</b><span>elevation gain</span></div>
      <div class="kpi"><b class="tnum">↓ ${Math.round(s.down)} m</b><span>elevation loss</span></div>
      <div class="kpi"><b class="tnum">${s.lo != null ? Math.round(s.lo) + '–' + Math.round(s.hi) + ' m' : '—'}</b><span>low – high</span></div>
      <div class="kpi"><b class="tnum">${Math.round(s.maxGrade * 100)}%</b><span>steepest grade</span></div></div>
      <div class="diff diff-${['Easy', 'Moderate', 'Hard', 'Very hard'].indexOf(s.difficulty)}">${esc(s.difficulty)}${MODES[mode].foot ? ` <span class="muted">· ${esc(MODES[mode].name.toLowerCase())}</span>` : ''}</div>
`;
    chart(v.querySelector('#rProf'), prof, MODES[mode].color, v.querySelector('#rRead'));
  };
  draw();
  v.querySelector('#rModes').onclick = (e) => { const b = e.target.closest('[data-mode]'); if (!b) return; mode = b.dataset.mode; v.querySelectorAll('#rModes button').forEach((x) => x.setAttribute('aria-checked', String(x === b))); draw(); };
  v.querySelector('#rBack').onclick = async () => { M.setCursor(null); (await import('./main.js?v=20261114004928-4d6f117')).rerender(); };
  v.querySelector('#rFit').onclick = () => { M.fitTo(coords); if (innerWidth <= 760) import('./main.js?v=20261114004928-4d6f117').then((m) => m.closePanel()); };
  // Edit the line any time: keeps the name / hunt / notes typed so far.
  v.querySelector('#rEditLine').addEventListener('click', async () => {
    const f = v.querySelector('#rForm');
    const draft = { ...track, name: f.name.value, extra: { ...(track.extra || {}), mode, notes: f.notes.value || undefined, trip_id: f.trip_id.value || undefined, group_id: f.group_id.value || undefined } };
    M.setRoutePreview(null);
    if (innerWidth <= 760) (await import('./main.js?v=20261114004928-4d6f117')).closePanel();
    start(mode, coords, draft);
  });
  // Until it's saved (or while it differs from the saved copy), draw the line so you can see what you're about to save.
  const showPrev = () => (isNew || track._edited) && M.setRoutePreview(coords, { color: MODES[mode]?.color || '#ffd23f', label: [v.querySelector('#rForm')?.name.value.trim() || (isNew ? 'New route' : track.name || 'Route'), fmtKm(flatKm(coords))].join(' · ') });
  showPrev(); v.querySelector('#rForm [name=name]')?.addEventListener('input', showPrev);
  v.querySelector('#rModes')?.addEventListener('click', () => setTimeout(showPrev, 0));
  v.querySelector('#rDel')?.addEventListener('click', async () => { if (!confirm('Delete this route?')) return; await db.remove('tracks', track.id); M.setCursor(null); (await import('./main.js?v=20261114004928-4d6f117')).rerender(); });
  v.querySelector('#rForm').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target; const s = stats(prof, mode);
    const extra = { ...(track.extra || {}), mode, notes: f.notes.value || undefined, up: Math.round(s.up), down: Math.round(s.down), hours: +s.hours.toFixed(2), difficulty: s.difficulty };
    for (const k of ['trip_id', 'group_id']) { if (f[k].value) extra[k] = f[k].value; else delete extra[k]; }
    const row = { name: f.name.value.trim(), extra, distance_km: +s.dist.toFixed(3) };
    try {
      if (isNew) { row.coords = prof.length ? sampleCoords(coords, prof) : coords; row.hunter = 'Me'; row.source = 'drawn'; row.started_at = null; const [saved] = await db.insert('tracks', row); track = saved; }
      else { if (track._edited) row.coords = prof.length ? sampleCoords(coords, prof) : coords; const saved = await db.update('tracks', track.id, row); track = { ...saved }; }
      toast('Route saved'); openRoute(track, prof);
    } catch (err) { toast('Save failed: ' + err.message, 5000); }
  };
}
// Keep the user's vertices, with DEM elevation attached to each.
function sampleCoords(coords, prof) {
  return coords.map((c) => { let best = prof[0]; for (const p of prof) if (Math.abs(p.lon - c[0]) + Math.abs(p.lat - c[1]) < Math.abs(best.lon - c[0]) + Math.abs(best.lat - c[1])) best = p; return [c[0], c[1], best.e != null ? Math.round(best.e) : null]; });
}
// GPS tracks already carry elevation.
function fromGps(coords) { let d = 0; return coords.map((c, i) => { if (i) d += haversineKm(coords[i - 1], c); return { d, e: c[2], lon: c[0], lat: c[1] }; }); }

function chart(svg, prof, color, read) {
  const ok = prof.filter((p) => p.e != null); if (ok.length < 2) { svg.innerHTML = ''; read.textContent = 'No elevation data for this line.'; return; }
  const W = Math.max(280, Math.round(svg.getBoundingClientRect().width) || 600), H = 170, P = { l: 40, r: 8, t: 10, b: 22 };
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const dist = prof[prof.length - 1].d || 1; let lo = Math.min(...ok.map((p) => p.e)), hi = Math.max(...ok.map((p) => p.e));
  const pad = Math.max(20, (hi - lo) * 0.12); lo -= pad; hi += pad;
  const x = (d) => P.l + (d / dist) * (W - P.l - P.r), y = (e) => P.t + (1 - (e - lo) / (hi - lo)) * (H - P.t - P.b);
  const line = ok.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)} ${y(p.e).toFixed(1)}`).join(' ');
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad].map((e) => Math.round(e / 10) * 10);
  svg.innerHTML = `<defs><linearGradient id="pg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".45"/><stop offset="1" stop-color="${color}" stop-opacity=".04"/></linearGradient></defs>
    ${ticks.map((e) => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(e)}" y2="${y(e)}" class="pg-grid"/><text x="${P.l - 6}" y="${y(e) + 4}" class="pg-lbl" text-anchor="end">${e}</text>`).join('')}
    <path d="${line} L${x(ok[ok.length - 1].d)} ${H - P.b} L${x(ok[0].d)} ${H - P.b} Z" fill="url(#pg)"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2.4" vector-effect="non-scaling-stroke"/>
    <text x="${P.l}" y="${H - 6}" class="pg-lbl">0</text><text x="${W - P.r}" y="${H - 6}" class="pg-lbl" text-anchor="end">${fmtKm(dist)}</text>
    <line id="pgCur" y1="${P.t}" y2="${H - P.b}" class="pg-cur" style="display:none"/>`;
  const cur = svg.querySelector('#pgCur');
  const move = (ev) => {
    const r = svg.getBoundingClientRect(); const cx = ((ev.clientX - r.left) / r.width) * W; const d = Math.max(0, Math.min(dist, ((cx - P.l) / (W - P.l - P.r)) * dist));
    let p = prof[0]; for (const q of prof) if (Math.abs(q.d - d) < Math.abs(p.d - d)) p = q;
    cur.setAttribute('x1', x(p.d)); cur.setAttribute('x2', x(p.d)); cur.style.display = '';
    read.innerHTML = `<b class="tnum">${fmtKm(p.d)}</b> in · <b class="tnum">${p.e != null ? Math.round(p.e) + ' m' : '—'}</b> elevation`;
    M.setCursor(p.lon, p.lat);
  };
  svg.onpointermove = move; svg.onpointerdown = (e) => { svg.setPointerCapture?.(e.pointerId); move(e); };
}
