// BC general open seasons (2026–2028 synopsis). See hunt-hq-handoff/data/SEASONS_QA.md for known gaps.
import { SEASONS_URL, SYNOPSIS_RANGE } from './config.js?v=20261113044049-2d0f958';

export let SEASONS = [];

// Map the synopsis's varied species names to filter groups (one row can belong to several groups).
export function speciesGroups(sp) {
  const s = sp.toLowerCase(); const g = [];
  if (s.includes('grouse')) {
    if (s.includes('sharp')) g.push('Sharp-tailed Grouse');
    if (s.includes('ruffed')) g.push('Ruffed Grouse');
    if (s.includes('spruce')) g.push('Spruce Grouse');
    if (/dusky|sooty|blue/.test(s)) g.push('Blue Grouse (Dusky/Sooty)');
    return g.length ? g : ['Grouse'];
  }
  if (s.includes('mule deer')) return ['Mule Deer (incl. Black-tailed)'];
  if (s.includes('partridge') && s.includes('gray')) return ['Gray (Hungarian) Partridge'];
  if (s.includes('pheasant')) return ['Pheasant'];
  if (s.includes('quail')) return ['Quail'];
  if (s.startsWith('geese')) return ['Geese', sp];
  if (sp === 'Raccoon, Skunk') return ['Raccoon', 'Skunk'];
  return [sp];
}
export const normQual = (q) => (q || '').replace(/^H(?=Youth)/, '').trim();

export async function loadSeasons() {
  const r = await fetch(SEASONS_URL); SEASONS = await r.json();
  const clean = (v) => String(v || '').replace(/[\u0080-\u009f\ue000-\uf8ff]/g, '').trim();
  SEASONS.forEach((row, i) => { row.i = i; for (const k of ['sp', 'c', 'q', 'b']) row[k] = clean(row[k]); row.c = row.c.replace(/^[A-Z] (?=\d)/, ''); /* stray PDF footnote symbol, e.g. 'S 6 Point Bulls' */ row.g = speciesGroups(row.sp); row.q = normQual(row.q); });
  return SEASONS;
}

export const allGroups = () => [...new Set(SEASONS.flatMap((r) => r.g))].sort();
export const allRegions = () => [...new Set(SEASONS.map((r) => r.r))];
export const allMUs = () => [...new Set(SEASONS.flatMap((r) => r.mu))].sort(muSort);
export function muSort(a, b) { const [a1, a2] = a.split('-').map(Number), [b1, b2] = b.split('-').map(Number); return a1 - b1 || a2 - b2; }

// Is `iso` (YYYY-MM-DD) inside range [a,b]? MM-DD ranges may wrap past Dec 31.
export function inRange(iso, [a, b]) {
  if (a.length === 10) return iso >= a && iso <= b;
  const md = iso.slice(5);
  return a <= b ? md >= a && md <= b : md >= a || md <= b;
}
export const openRange = (row, iso) => row.d.find((r) => inRange(iso, r));
export const outsideSynopsis = (iso) => iso < SYNOPSIS_RANGE[0] || iso > SYNOPSIS_RANGE[1];

export function openOn(iso, { group = '', mu = '', qual = 'all' } = {}) {
  mu = normMU(mu);
  return SEASONS.filter((r) => (!group || r.g.includes(group)) && (!mu || r.mu.includes(mu)) && qualOk(r, qual) && openRange(r, iso));
}
function qualOk(r, qual) {
  if (qual === 'all') return true;
  const q = r.q.toLowerCase();
  if (qual === 'general') return !q.includes('youth') && !q.includes('senior');
  if (qual === 'bow') return !q.includes('youth') && !q.includes('senior'); // general seasons are open to bows too
  if (qual === 'nobow') return !q.includes('youth') && !q.includes('senior') && !q.includes('bow');
  return true;
}
export function seasonsFor(mu, group = '') { mu = normMU(mu); return SEASONS.filter((r) => r.mu.includes(mu) && (!group || r.g.includes(group))); }

// "3-15" from "3-15", "315", "MU 3-15", "3_15"
export function normMU(s) {
  if (!s) return '';
  s = String(s).trim().toUpperCase().replace(/^MU\s*/, '');
  const m = s.match(/^(\d)\s*[-_ ]?\s*0*(\d{1,2})$/);
  return m ? `${m[1]}-${+m[2]}` : s;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtMD(s) {
  if (s.length === 10) { const [y, m, d] = s.split('-'); return `${MON[+m - 1]} ${+d}, ${y}`; }
  const [m, d] = s.split('-'); return `${MON[+m - 1]} ${+d}`;
}
export const fmtRange = (r) => `${fmtMD(r[0])} – ${fmtMD(r[1])}`;

export function rowLabel(r) {
  return [r.sp, r.c, r.q].filter(Boolean).join(' · ');
}
