// Elevation + route stats from the same free AWS Terrarium DEM tiles the 3D view uses (≈12 m pixels at BC latitudes).
import { TERRAIN_TILES } from './config.js?v=20261113060050-30af831';
import { haversineKm } from './util.js?v=20261113060050-30af831';

const Z = 13, TILE = 256;
const cache = new Map();
function loadTile(x, y) {
  const key = `${x}/${y}`;
  if (!cache.has(key)) cache.set(key, new Promise((res) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = TILE; const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0); res(ctx.getImageData(0, 0, TILE, TILE).data); };
    img.onerror = () => res(null);
    img.src = TERRAIN_TILES.replace('{z}', Z).replace('{x}', x).replace('{y}', y);
  }));
  return cache.get(key);
}
function tileXY(lon, lat) {
  const n = 2 ** Z, r = (lat * Math.PI) / 180;
  const fx = ((lon + 180) / 360) * n, fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return { x: Math.floor(fx), y: Math.floor(fy), px: Math.min(TILE - 1, Math.floor((fx % 1) * TILE)), py: Math.min(TILE - 1, Math.floor((fy % 1) * TILE)) };
}
export async function elevationAt(lon, lat) {
  const t = tileXY(lon, lat); const d = await loadTile(t.x, t.y); if (!d) return null;
  const i = (t.py * TILE + t.px) * 4; return d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768;
}

// Densify the line every `step` km and sample the DEM. Returns [{d (km), e (m), lon, lat}].
export async function profile(coords, step = 0.02) {
  if (coords.length < 2) return [];
  const pts = [];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i]; const seg = haversineKm(a, b); const n = Math.max(1, Math.ceil(seg / step));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  let d = 0; const out = [];
  const es = await Promise.all(pts.map((p) => elevationAt(p[0], p[1])));
  for (let i = 0; i < pts.length; i++) { if (i) d += haversineKm(pts[i - 1], pts[i]); out.push({ d, e: es[i], lon: pts[i][0], lat: pts[i][1] }); }
  // Light smoothing (5-sample moving average) so DEM pixel noise doesn't inflate climb totals.
  const raw = out.map((p) => p.e);
  out.forEach((p, i) => { const w = raw.slice(Math.max(0, i - 2), i + 3).filter((x) => x != null); p.e = w.length ? w.reduce((a, b) => a + b, 0) / w.length : null; });
  return out;
}

// Travel modes. Foot speeds use Tobler's hiking function (slope-aware); vehicles use a flat speed with a climb penalty.
export const MODES = {
  trail: { name: 'On trail', icon: 'foot', color: '#ff7a00', foot: true, factor: 1 },
  offtrail: { name: 'Off-trail / bush', icon: 'foot', color: '#e0262b', foot: true, factor: 0.6 },
  packout: { name: 'Packing out', icon: 'foot', color: '#9c27b0', foot: true, factor: 0.5 },
  atv: { name: 'ATV / side-by-side', icon: 'atv', color: '#1e88e5', kmh: 18 },
  truck: { name: 'Truck (forest road)', icon: 'truck', color: '#00897b', kmh: 35 },
};

export function stats(prof, modeId = 'trail') {
  const m = MODES[modeId] || MODES.trail;
  const dist = prof.length ? prof[prof.length - 1].d : 0;
  let up = 0, down = 0, maxGrade = 0, hours = 0, lo = Infinity, hi = -Infinity;
  const valid = prof.filter((p) => p.e != null);
  for (let i = 1; i < prof.length; i++) {
    const a = prof[i - 1], b = prof[i]; const dk = b.d - a.d; if (dk <= 0) continue;
    const dh = a.e != null && b.e != null ? b.e - a.e : 0;
    if (dh > 0) up += dh; else down -= dh;
    const slope = dh / (dk * 1000);
    if (m.foot) hours += dk / (6 * Math.exp(-3.5 * Math.abs(slope + 0.05)) * m.factor);
    else hours += dk / m.kmh + Math.max(0, dh) / 1000 / 2; // vehicles lose ~30 min per 1000 m climbed on rough roads
  }
  for (const p of valid) { lo = Math.min(lo, p.e); hi = Math.max(hi, p.e); }
  // Steepest sustained grade over ~60 m stretches (single DEM pixels are too noisy for short spans).
  for (let i = 0, j = 0; i < prof.length; i++) {
    while (j < prof.length && prof[j].d - prof[i].d < 0.06) j++;
    if (j >= prof.length) break;
    if (prof[i].e != null && prof[j].e != null) maxGrade = Math.max(maxGrade, Math.abs(prof[j].e - prof[i].e) / ((prof[j].d - prof[i].d) * 1000));
  }
  // Difficulty (on foot): "effort km" = distance + 1 km per 100 m climbed (Naismith-style), bumped for steep pitches.
  let difficulty = null;
  if (m.foot) {
    const effort = dist * (1 / m.factor) ** 0.5 + up / 100;
    let lvl = effort < 6 ? 0 : effort < 12 ? 1 : effort < 20 ? 2 : 3;
    if (maxGrade > 0.35 && lvl < 3) lvl++;
    difficulty = ['Easy', 'Moderate', 'Hard', 'Very hard'][lvl];
  } else difficulty = maxGrade > 0.18 ? 'Steep road — check traction' : maxGrade > 0.1 ? 'Some steep pitches' : 'Easy grade';
  return { dist, up, down, lo: valid.length ? lo : null, hi: valid.length ? hi : null, maxGrade, hours, difficulty, mode: modeId };
}

export const fmtHours = (h) => { if (!isFinite(h) || h <= 0) return '—'; const mins = Math.round(h * 60); return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`; };
export const fmtKm = (k) => (k < 1 ? `${Math.round(k * 1000)} m` : `${k.toFixed(k < 10 ? 2 : 1)} km`);
