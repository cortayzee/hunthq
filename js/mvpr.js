// Motor-vehicle prohibition popups for WAA_MVPR_AREAS_SP / WAA_MVPR_ROUTES_SP.
// Areas: PROHIBITION_TYPE + EFFECTIVE_DESCRIPTION ("Closed Year Round", "Closed April 1 to June 30 and September 1 to ...",
// "Open December 1 to May 31", "Seasonal Closure Jan 1 to April 15"). Routes: ACCESS_STATUS / ACCESS_RANGE / ACCESS_DESCRIPTION.
import { esc } from './util.js?v=20261113160653-ee55c68';

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, '0');
const md = (mon, day) => { const m = MONTHS[mon.slice(0, 3).toLowerCase()]; return m ? `${pad(m)}-${pad(+day)}` : null; };
const MON_RE = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?\\s+(\\d{1,2})';
const RANGE_RE = new RegExp(`${MON_RE}\\s*(?:-|–|to|through)\\s*${MON_RE}`, 'gi');

export function parseRanges(text) {
  const out = []; let m; RANGE_RE.lastIndex = 0;
  while ((m = RANGE_RE.exec(text))) { const a = md(m[1], m[2]), b = md(m[3], m[4]); if (a && b) out.push([a, b]); }
  return out;
}
const inMD = (d, [a, b]) => (a <= b ? d >= a && d <= b : d >= a || d <= b);

// Returns { closed: true|false|null, why }
export function mvprStatus(p, iso) {
  if (p.EXPIRY_DATE && String(p.EXPIRY_DATE).slice(0, 10) < iso) return { closed: false, why: 'expired ' + String(p.EXPIRY_DATE).slice(0, 10) };
  if (p.EFFECTIVE_DATE && String(p.EFFECTIVE_DATE).slice(0, 10) > iso) return { closed: false, why: 'starts ' + String(p.EFFECTIVE_DATE).slice(0, 10) };
  const text = [p.EFFECTIVE_DESCRIPTION, p.ACCESS_STATUS, p.ACCESS_RANGE, p.ACCESS_DESCRIPTION].filter(Boolean).join('. ');
  if (!text) return { closed: null, why: '' };
  const isOpen = /^\s*(open|roads open)/i.test(p.EFFECTIVE_DESCRIPTION || p.ACCESS_STATUS || '');
  if (/year[- ]round/i.test(text)) return { closed: !isOpen, why: '' };
  const d = iso.slice(5); const ranges = parseRanges(text);
  if (!ranges.length) return { closed: null, why: '' };
  const hit = ranges.some((r) => inMD(d, r));
  return { closed: isOpen ? !hit : hit, why: /between \d/i.test(text) ? 'during set hours only' : '' };
}

export function mvprSummary(p, iso) {
  const st = mvprStatus(p, iso);
  const chip = st.closed === true ? `<span class="chip bad">In effect ${esc(iso)}</span>` : st.closed === false ? `<span class="chip ok">Not in effect ${esc(iso)}</span>` : '<span class="chip warn">Check details</span>';
  const lines = [p.PROHIBITION_TYPE, p.EFFECTIVE_DESCRIPTION, p.ACCESS_STATUS, p.ACCESS_RANGE, p.ACCESS_LIMITATION && p.ACCESS_LIMITATION !== 'None' ? p.ACCESS_LIMITATION : '', p.EXEMPTION && 'Exemption: ' + p.EXEMPTION].filter(Boolean);
  return `<div style="margin:2px 0"><div>${esc(p.REGULATION_GEOGRAPHIC_NAME || p.ROAD_NAME || '')}${p.MU_NUMBER ? ` <span class="muted">MU ${esc(p.MU_NUMBER)}</span>` : ''}</div>
    ${chip} ${st.why ? `<span class="muted">${esc(st.why)}</span>` : ''}
    ${lines.map((l) => `<div class="muted">${esc(l)}</div>`).join('')}${p.MAP_NUMBER ? `<div class="muted">Reg. map ${esc(p.MAP_NUMBER)}</div>` : ''}</div>`;
}
