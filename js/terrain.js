// Terrain tools (right-hand map controls): sun & shadow for any date/time, slope direction (aspect) and steepness.
// Both read the same free elevation tiles the 3D view uses. Slopes are computed in the browser per tile.
import * as M from './map.js?v=20261117165301-ebeb5b2';
import * as db from './db.js?v=20261117165301-ebeb5b2';
import { store } from './db.js?v=20261117165301-ebeb5b2';
import { TERRAIN_TILES } from './config.js?v=20261117165301-ebeb5b2';
import { $, $$, esc, todayISO, tip } from './util.js?v=20261117165301-ebeb5b2';

export const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const DIR_COLORS = { N: '#2f6fd6', NE: '#1fa7b8', E: '#4fb35a', SE: '#c9c227', S: '#f08a24', SW: '#e0443a', W: '#c1449e', NW: '#7357d6' };
const DIR_NAMES = { N: 'north', NE: 'northeast', E: 'east', SE: 'southeast', S: 'south', SW: 'southwest', W: 'west', NW: 'northwest' };
// Steepness bands (degrees).
export const STEEP = [[0, 10, null, 'Under 10°'], [10, 20, '#58b368', '10–20°'], [20, 30, '#e3cf3a', '20–30°'], [30, 35, '#f08a24', '30–35°'], [35, 45, '#e0443a', '35–45°'], [45, 91, '#8e3fbf', '45°+']];

const T = { sun: false, slope: 'off', dirs: [...DIRS], min: 5, max: 90, op: 0.55, date: todayISO(), mins: null };
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ---- Slope tiles: a custom protocol turns an elevation tile into a coloured slope tile ----
let protoAdded = false;
function addProtocol() {
  if (protoAdded) return; protoAdded = true;
  maplibregl.addProtocol('rlslope', async (params, ctl) => {
    const u = new URL(params.url.replace('rlslope://t/', 'https://x/'));
    const [z, x, y] = u.pathname.split('/').filter(Boolean).map(Number);
    const mode = u.searchParams.get('m'), dirs = new Set((u.searchParams.get('d') || '').split(',')), lo = +u.searchParams.get('lo'), hi = +u.searchParams.get('hi');
    const r = await fetch(TERRAIN_TILES.replace('{z}', z).replace('{x}', x).replace('{y}', y), { signal: ctl.signal });
    if (!r.ok) throw new Error('elevation ' + r.status);
    const bmp = await createImageBitmap(await r.blob());
    const W = bmp.width, H = bmp.height;
    const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
    const src = g.getImageData(0, 0, W, H).data; const E = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) E[i] = src[i * 4] * 256 + src[i * 4 + 1] + src[i * 4 + 2] / 256 - 32768;
    const out = g.createImageData(W, H); const o = out.data;
    const n = 2 ** z; const dcol = DIRS.map((d) => hex(DIR_COLORS[d])); const scol = STEEP.map((b) => (b[2] ? hex(b[2]) : null));
    const at = (cx, cy) => E[Math.min(H - 1, Math.max(0, cy)) * W + Math.min(W - 1, Math.max(0, cx))];
    for (let py = 0; py < H; py++) {
      const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + (py + 0.5) / H)) / n)));
      const cell = (40075016.686 * Math.cos(lat)) / (W * n); // metres per pixel
      for (let px = 0; px < W; px++) {
        // Horn's method on the 3×3 neighbourhood.
        const a = at(px - 1, py - 1), b = at(px, py - 1), c = at(px + 1, py - 1), d = at(px - 1, py), f = at(px + 1, py), gg = at(px - 1, py + 1), h = at(px, py + 1), ii = at(px + 1, py + 1);
        const dzdx = ((c + 2 * f + ii) - (a + 2 * d + gg)) / (8 * cell); // rise to the east
        const dzdy = ((gg + 2 * h + ii) - (a + 2 * b + c)) / (8 * cell); // rise to the south (image y grows south)
        const slope = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
        const k = (py * W + px) * 4;
        if (slope < lo || slope > hi) continue;
        let col = null;
        if (mode === 'aspect') {
          // The way the slope faces = downhill direction: (-dz/dx east, +dz/dy_img north).
          const az = ((Math.atan2(-dzdx, dzdy) * 180) / Math.PI + 360) % 360;
          const s = Math.round(az / 45) % 8; if (dirs.has(DIRS[s])) col = dcol[s];
        } else {
          const bi = STEEP.findIndex((bb) => slope >= bb[0] && slope < bb[1]); col = scol[bi];
        }
        if (col) { o[k] = col[0]; o[k + 1] = col[1]; o[k + 2] = col[2]; o[k + 3] = 255; }
      }
    }
    g.putImageData(out, 0, 0);
    const blob = cv.convertToBlob ? await cv.convertToBlob({ type: 'image/png' }) : await new Promise((res) => cv.toBlob(res, 'image/png'));
    return { data: await blob.arrayBuffer() };
  });
}
function slopeUrl() { return `rlslope://t/{z}/{x}/{y}?m=${T.slope}&d=${T.dirs.join(',')}&lo=${T.slope === 'aspect' ? T.min : 10}&hi=${T.slope === 'aspect' ? T.max : 91}`; }
function applySlope() {
  const map = M.map; if (!map) return;
  if (T.slope === 'off' || (T.slope === 'aspect' && !T.dirs.length)) { if (map.getLayer('slope')) map.removeLayer('slope'); if (map.getSource('slope')) map.removeSource('slope'); return; }
  addProtocol();
  if (map.getSource('slope')) { map.getSource('slope').setTiles([slopeUrl()]); map.setPaintProperty('slope', 'raster-opacity', T.op); return; }
  map.addSource('slope', { type: 'raster', tiles: [slopeUrl()], tileSize: 256, minzoom: 8, maxzoom: 15 });
  const before = map.getStyle().layers.find((l) => !['base', 'hillshade', 'sunshade'].includes(l.id) && !l.id.startsWith('ref') && !l.id.startsWith('wms-'))?.id;
  map.addLayer({ id: 'slope', type: 'raster', source: 'slope', minzoom: 8, paint: { 'raster-opacity': T.op, 'raster-resampling': 'linear', 'raster-fade-duration': 0 } }, before);
}

// ---- Sun ----
export function sunAt(date, lat, lon) {
  const p = SunCalc.getPosition(date, lat, lon);
  return { alt: (p.altitude * 180) / Math.PI, az: ((p.azimuth * 180) / Math.PI + 180 + 360) % 360 };
}
const when = () => { const [y, m, d] = T.date.split('-').map(Number); const t = new Date(y, m - 1, d); t.setMinutes(T.mins); return t; };
function applySun() {
  const map = M.map; if (!map) return;
  if (!T.sun) {
    if (map.getLayer('sunshade')) map.removeLayer('sunshade');
    if (map.getLayer('base')) map.setPaintProperty('base', 'raster-brightness-max', 1);
    return;
  }
  const c = map.getCenter(); const s = sunAt(when(), c.lat, c.lng);
  if (!map.getLayer('sunshade')) {
    const before = map.getStyle().layers.find((l) => !['base', 'hillshade'].includes(l.id) && !l.id.startsWith('ref'))?.id;
    map.addLayer({ id: 'sunshade', type: 'hillshade', source: 'hillshade-dem', paint: { 'hillshade-illumination-anchor': 'map', 'hillshade-shadow-color': '#05080a', 'hillshade-highlight-color': '#fff1cf', 'hillshade-accent-color': '#05080a' } }, before);
  }
  // Low sun = long, strong shading; high sun = little. Below the horizon the whole map goes dark.
  const up = Math.max(0, Math.min(1, s.alt / 50));
  map.setPaintProperty('sunshade', 'hillshade-illumination-direction', Math.round(s.az));
  map.setPaintProperty('sunshade', 'hillshade-exaggeration', s.alt > 0 ? 0.95 - 0.55 * up : 1);
  const night = s.alt >= 0 ? 1 : s.alt <= -8 ? 0.28 : 1 - (0.72 * -s.alt) / 8;
  map.setPaintProperty('base', 'raster-brightness-max', night);
  return s;
}

// ---- Panel ----
const fmtT = (m) => { const h = Math.floor(m / 60), mm = m % 60; return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
const minsOf = (d) => d.getHours() * 60 + d.getMinutes();
const compass = (az) => ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(az / 45) % 8];
function save() { clearTimeout(save.t); save.t = setTimeout(() => db.savePrefs({ terrain: { sun: T.sun, slope: T.slope, dirs: T.dirs, min: T.min, max: T.max, op: T.op } }).catch(() => {}), 1200); }
export const active = () => T.sun || T.slope !== 'off';

function drawSunInfo() {
  const el = $('#tSunInfo'); if (!el) return;
  const c = M.map.getCenter(); const day = when(); const st = SunCalc.getTimes(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12), c.lat, c.lng);
  const s = applySun() || sunAt(day, c.lat, c.lng);
  $('#tTime').textContent = fmtT(T.mins);
  el.innerHTML = s.alt > 0 ? `Sun ${Math.round(s.alt)}° up, shining from the <b>${compass(s.az)}</b>. Slopes facing ${compass(s.az)} are lit.` : s.alt > -6 ? 'Twilight: the sun is just below the horizon.' : 'Night: the sun is down.';
  const pct = (d) => (minsOf(d) / 1440) * 100;
  const rise = st.sunrise, set = st.sunset;
  if (!isNaN(rise) && !isNaN(set)) {
    $('#tDay').style.setProperty('--a', pct(rise) + '%'); $('#tDay').style.setProperty('--b', pct(set) + '%');
    $('#tMarks').innerHTML = `<span>Sunrise ${fmtT(minsOf(rise))}</span><span>Sunset ${fmtT(minsOf(set))}</span>`;
  }
}
function draw() {
  const pop = $('#terrPop'); if (!pop) return;
  const seg = (k, v, label) => `<button type="button" data-tslope="${v}" class="${T.slope === v ? 'on' : ''}" aria-pressed="${T.slope === v}">${label}</button>`;
  const rose = ['NW', 'N', 'NE', 'W', '', 'E', 'SW', 'S', 'SE'].map((d) => d ? `<button type="button" class="rose-d${T.dirs.includes(d) ? ' on' : ''}" data-tdir="${d}" aria-pressed="${T.dirs.includes(d)}" aria-label="${DIR_NAMES[d]}-facing" style="--c:${DIR_COLORS[d]}">${d}</button>`
    : `<button type="button" class="rose-all" data-tdir="*">${T.dirs.length === 8 ? 'None' : 'All'}</button>`).join('');
  pop.innerHTML = `<div class="t-head"><span class="pop-title" style="margin:0">Terrain</span><button type="button" class="icon-btn t-x" aria-label="Close terrain tools">✕</button></div>
    <label class="switch"><input type="checkbox" id="tSun" ${T.sun ? 'checked' : ''}><span>Sun &amp; shadow</span>${tip('Lights the terrain from where the sun is at the time you pick, for the middle of the map. Slopes facing the sun are bright, slopes facing away are dark. It shades by the way each slope faces; it doesn’t draw the shadow a ridge throws across the next valley.', 'About sun & shadow')}</label>
    <div class="t-sun ${T.sun ? '' : 'hidden'}">
      <div class="t-row"><input type="date" id="tDate" value="${esc(T.date)}" aria-label="Date"><button type="button" class="small" id="tNow">Now</button><output id="tTime" class="tnum"></output></div>
      <div class="t-day" id="tDay"><input type="range" id="tMins" min="0" max="1435" step="5" value="${T.mins}" aria-label="Time of day"></div>
      <div class="t-marks fine muted" id="tMarks"></div>
      <p class="t-info" id="tSunInfo"></p>
    </div>
    <div class="pop-sep"></div>
    <div class="t-lab">Slopes ${tip('Worked out from elevation data for each slope, about 5–10 m detail when zoomed in. Zoom in past the region view to see it.', 'About slopes')}</div>
    <div class="seg seg-full t-seg">${seg('slope', 'off', 'Off')}${seg('slope', 'aspect', 'Direction')}${seg('slope', 'steep', 'Steepness')}</div>
    <div class="t-aspect ${T.slope === 'aspect' ? '' : 'hidden'}">
      <div class="t-rose-wrap"><div class="t-rose" role="group" aria-label="Slope directions to show">${rose}</div>
        <div class="t-presets"><button type="button" class="chip" data-tpre="N">North-facing</button><button type="button" class="chip" data-tpre="S">South-facing</button><button type="button" class="chip" data-tpre="E">East-facing</button><button type="button" class="chip" data-tpre="W">West-facing</button></div></div>
      <div class="t-range"><span>Steepness</span><input type="range" id="tMin" min="0" max="45" step="1" value="${T.min}" aria-label="Minimum steepness"><output class="tnum" id="tMinO">${T.min}°+</output></div>
      <p class="fine muted t-hint">${T.dirs.length ? `Showing ${T.dirs.length === 8 ? 'every direction' : T.dirs.map((d) => DIR_NAMES[d]).join(', ') + '-facing slopes'}, ${T.min}° or steeper.` : 'Pick at least one direction.'}</p>
    </div>
    <div class="t-steep ${T.slope === 'steep' ? '' : 'hidden'}"><div class="t-legend">${STEEP.filter((b) => b[2]).map((b) => `<span><i style="background:${b[2]}"></i>${b[3]}</span>`).join('')}</div>
      <p class="fine muted">30°+ is hard going on foot and where snow can slide.</p></div>
    <div class="t-range ${T.slope === 'off' ? 'hidden' : ''}"><span>Opacity</span><input type="range" id="tOp" min="0.2" max="0.9" step="0.05" value="${T.op}" aria-label="Slope layer opacity"></div>
    <p class="fine muted t-zoom ${T.slope !== 'off' && M.map.getZoom() < 8 ? '' : 'hidden'}">Zoom in to see slopes.</p>`;
  if (T.sun) drawSunInfo();
}
function wire() {
  const pop = $('#terrPop');
  pop.addEventListener('click', (e) => {
    if (e.target.closest('.t-x')) { toggle(false); return; }
    const sl = e.target.closest('[data-tslope]'); if (sl) { T.slope = sl.dataset.tslope; applySlope(); draw(); save(); sync(); return; }
    const dr = e.target.closest('[data-tdir]');
    if (dr) { const d = dr.dataset.tdir; T.dirs = d === '*' ? (T.dirs.length === 8 ? [] : [...DIRS]) : T.dirs.includes(d) ? T.dirs.filter((x) => x !== d) : DIRS.filter((x) => x === d || T.dirs.includes(x)); applySlope(); draw(); save(); return; }
    const pr = e.target.closest('[data-tpre]');
    if (pr) { const i = DIRS.indexOf(pr.dataset.tpre); T.dirs = [DIRS[(i + 7) % 8], DIRS[i], DIRS[(i + 1) % 8]].sort((a, b) => DIRS.indexOf(a) - DIRS.indexOf(b)); applySlope(); draw(); save(); return; }
    if (e.target.id === 'tNow') { const n = new Date(); T.date = todayISO(); T.mins = Math.round(minsOf(n) / 5) * 5; $('#tDate').value = T.date; $('#tMins').value = T.mins; drawSunInfo(); }
  });
  pop.addEventListener('input', (e) => {
    if (e.target.id === 'tMins') { T.mins = +e.target.value; drawSunInfo(); }
    if (e.target.id === 'tOp') { T.op = +e.target.value; M.map.getLayer('slope') && M.map.setPaintProperty('slope', 'raster-opacity', T.op); save(); }
    if (e.target.id === 'tMin') { T.min = +e.target.value; $('#tMinO').textContent = T.min + '°+'; }
  });
  pop.addEventListener('change', (e) => {
    if (e.target.id === 'tSun') { T.sun = e.target.checked; applySun(); draw(); save(); sync(); }
    if (e.target.id === 'tDate' && e.target.value) { T.date = e.target.value; drawSunInfo(); }
    if (e.target.id === 'tMin') { applySlope(); draw(); save(); }
  });
  M.map.on('moveend', () => { if (T.sun) drawSunInfo(); $('.t-zoom')?.classList.toggle('hidden', !(T.slope !== 'off' && M.map.getZoom() < 8)); });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#terrPop, #terrBtn')) toggle(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
}
const sync = () => $('#terrBtn')?.setAttribute('aria-pressed', String(active()));
export function toggle(force) {
  const pop = $('#terrPop'); const show = force ?? pop.classList.contains('hidden');
  if (show) {
    if (T.mins == null) T.mins = Math.round(minsOf(new Date()) / 5) * 5;
    draw(); const r = $('#terrBtn').getBoundingClientRect();
    pop.style.top = `${r.top}px`; pop.style.right = `${innerWidth - r.left + 10}px`; pop.style.maxHeight = `${innerHeight - r.top - 16}px`;
  }
  pop.classList.toggle('hidden', !show); $('#terrBtn').setAttribute('aria-expanded', String(show));
}
export function init() {
  Object.assign(T, store.prefs.terrain || {});
  T.mins = Math.round(minsOf(new Date()) / 5) * 5; T.date = todayISO();
  if (!Array.isArray(T.dirs)) T.dirs = [...DIRS];
  wire(); applySlope(); applySun(); sync();
  $('#terrBtn').onclick = (e) => { e.stopPropagation(); toggle(); };
}
