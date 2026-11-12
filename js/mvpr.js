// Motor-vehicle prohibition popups. The layer schema isn't hard-coded: we show the descriptive fields and try to
// work out whether the closure applies on the chosen date from date fields or "Sep 1 - Dec 31"-style text.
import { esc } from './util.js';

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const SKIP = /SHAPE|GEOMETRY|OBJECTID|FEATURE_AREA|FEATURE_LENGTH|SE_ANNO|^AREA_SQM|^LENGTH_M|FEATURE_CODE/i;
const pad = (n) => String(n).padStart(2, '0');

function mdFrom(text) {
  const m = String(text).match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})/);
  if (!m) return null; const mo = MONTHS[m[1].slice(0, 4).toLowerCase()] || MONTHS[m[1].slice(0, 3).toLowerCase()];
  return mo ? `${pad(mo)}-${pad(+m[2])}` : null;
}
function rangesFromText(t) {
  const out = []; const re = /([A-Za-z]{3,9}\.?\s+\d{1,2})\s*(?:-|–|to|through)\s*([A-Za-z]{3,9}\.?\s+\d{1,2})/gi; let m;
  while ((m = re.exec(t))) { const a = mdFrom(m[1]), b = mdFrom(m[2]); if (a && b) out.push([a, b]); }
  return out;
}
const inMD = (md, [a, b]) => (a <= b ? md >= a && md <= b : md >= a || md <= b);

export function mvprStatus(props, iso) {
  const md = iso.slice(5);
  const text = Object.values(props).filter((v) => typeof v === 'string').join(' ');
  if (/year[- ]round|all year|at all times/i.test(text)) return { closed: true, why: 'year-round' };
  // explicit date fields
  const keys = Object.keys(props);
  const sKey = keys.find((k) => /(START|FROM|OPEN|BEGIN).*(DATE|DAY)|DATE.*(START|FROM)/i.test(k));
  const eKey = keys.find((k) => /(END|TO|CLOSE|FINISH).*(DATE|DAY)|DATE.*(END|TO)/i.test(k));
  if (sKey && eKey && props[sKey] && props[eKey]) {
    const s = String(props[sKey]), e = String(props[eKey]);
    const toMD = (v) => (/^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(5, 10) : /^\d{2}-\d{2}$/.test(v) ? v : mdFrom(v));
    const a = toMD(s), b = toMD(e);
    if (a && b) return { closed: inMD(md, [a, b]), why: `${s.slice(0, 10)} – ${e.slice(0, 10)}` };
  }
  const ranges = rangesFromText(text);
  if (ranges.length) { const hit = ranges.find((r) => inMD(md, r)); return { closed: !!hit, why: ranges.map((r) => r.join('→')).join(', ') }; }
  return { closed: null, why: '' };
}

export function mvprSummary(props, iso) {
  const st = mvprStatus(props, iso);
  const chip = st.closed === true ? `<span class="chip bad">In effect ${esc(iso)}</span>` : st.closed === false ? `<span class="chip ok">Not in effect ${esc(iso)}</span>` : '<span class="chip warn">Dates: see details</span>';
  const fields = Object.entries(props).filter(([k, v]) => !SKIP.test(k) && v !== null && v !== '').slice(0, 10);
  return `<div style="margin:3px 0">${chip} ${st.why ? `<span class="muted">${esc(st.why)}</span>` : ''}<dl>${fields.map(([k, v]) => `<dt>${esc(k.replace(/_/g, ' ').toLowerCase())}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>`;
}
