// Seasons: "Where can I hunt <species> on <date>?"  Pick a species → open WMUs shade on the map.
import { SEASONS, openRange, fmtRange, outsideSynopsis, muSort } from '../seasons.js?v=20261113044709-1cc4355';
import * as M from '../map.js?v=20261113044709-1cc4355';
import { REGS_URL } from '../config.js?v=20261113044709-1cc4355';
import { esc, todayISO, pad } from '../util.js?v=20261113044709-1cc4355';
import { icon } from '../icons.js?v=20261113044709-1cc4355';
import { category } from './wmu.js?v=20261113044709-1cc4355';
import { app } from '../main.js?v=20261113044709-1cc4355';

const st = { sp: '', weapon: 'any', youth: false };
const CATS = [['big', 'Big game', 'deer'], ['pred', 'Bears & predators', 'paw'], ['bird', 'Birds & small game', 'bird']];
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nextSat = () => { const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); return iso(d); };
const pretty = (s) => new Date(s + 'T12:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });

// Species shown as chips: the synopsis groups, minus the per-goose-type duplicates.
function speciesList() {
  const g = new Set(SEASONS.flatMap((r) => r.g).filter((x) => !/^Geese:/.test(x)));
  return [...g].sort((a, b) => a.localeCompare(b));
}
const isBow = (r) => /bow/i.test(r.q);
const isYouth = (r) => /youth|senior/i.test(r.q);
function rowsFor(sp, date) {
  return SEASONS.filter((r) => r.g.includes(sp) && openRange(r, date)
    && (st.youth || !isYouth(r))
    && (st.weapon !== 'rifle' || !isBow(r)));
}
const muCount = (rows) => new Set(rows.flatMap((r) => r.mu)).size;

let mapChip = null;
function setChip(text) {
  if (!mapChip) {
    mapChip = document.createElement('div'); mapChip.className = 'map-chip hidden';
    mapChip.innerHTML = `<span class="dot"></span><span class="t"></span><button aria-label="Clear season shading">${icon('x', { size: 16 })}</button>`;
    mapChip.querySelector('button').onclick = () => { clear(); render.v?.isConnected && render(render.v); };
    document.getElementById('app').append(mapChip);
  }
  mapChip.querySelector('.t').textContent = text || '';
  mapChip.classList.toggle('hidden', !text);
}
function clear() { st.sp = ''; M.clearShade(); setChip(''); }
// Called by main.js when another tab opens.
export function onLeave() { clear(); }

export function render(v) {
  render.v = v;
  const date = app.date || todayISO();
  const sps = speciesList();
  const counts = Object.fromEntries(sps.map((s) => [s, muCount(rowsFor(s, date))]));
  const quick = [['Today', todayISO()], ['Sat', nextSat()]];
  v.innerHTML = `<h2>Seasons</h2>
  <p class="muted" style="margin-top:0">Pick a species to see where it's open. Numbers = WMUs open that day.</p>
  <div class="seg-row">
    <div class="seg" role="group" aria-label="Date">${quick.map(([l, d]) => `<button data-date="${d}" class="${d === date ? 'on' : ''}">${l}</button>`).join('')}
      <label class="seg-date ${quick.some(([, d]) => d === date) ? '' : 'on'}">${icon('calendar', { size: 16 })}<span>${pretty(date)}</span><input type="date" id="sDate" value="${date}" aria-label="Pick a date"></label></div>
  </div>
  <div class="seg-row">
    <div class="seg" role="group" aria-label="Weapon">${[['any', 'Any weapon'], ['rifle', 'Rifle'], ['bow', 'Bow']].map(([k, l]) => `<button data-weapon="${k}" class="${st.weapon === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <label class="switch" style="min-height:36px"><input type="checkbox" id="sYouth" ${st.youth ? 'checked' : ''}><span>Youth</span></label>
  </div>
  ${outsideSynopsis(date) ? '<div class="notice">That date is outside the 2026–2028 synopsis, so results may be wrong.</div>' : ''}
  ${CATS.map(([k, n, ic]) => {
    const list = sps.filter((s) => category(s) === k);
    return `<div class="group-label row" style="gap:6px">${icon(ic, { size: 15 })}${n}</div><div class="sp-grid">${list.map((s) => `
      <button class="sp-chip ${st.sp === s ? 'on' : ''} ${counts[s] ? '' : 'closed'}" data-sp="${esc(s)}" aria-pressed="${st.sp === s}">
        <span class="nm">${esc(s.replace(' (incl. Black-tailed)', ''))}</span><span class="ct tnum">${counts[s] || 'Closed'}</span></button>`).join('')}</div>`;
  }).join('')}
  <div id="sOut"></div>
  <p class="muted" style="margin-top:18px">General open seasons from the 2026–2028 synopsis; LEH hunts aren't included. Always check the synopsis and <a href="${REGS_URL}" target="_blank" rel="noopener">in-season changes</a>.</p>`;

  const out = v.querySelector('#sOut');
  if (st.sp) {
    const rows = rowsFor(st.sp, date);
    M.shadeOpen(rows);
    setChip(rows.length ? `${st.sp.replace(' (incl. Black-tailed)', '')} · ${date === todayISO() ? 'open today' : pretty(date)}` : '');
    const byR = new Map(); for (const r of rows) { if (!byR.has(r.r)) byR.set(r.r, []); byR.get(r.r).push(r); }
    out.innerHTML = !rows.length ? `<div class="empty">${icon('calendar', { size: 22 })}<b>${esc(st.sp)} isn't open ${date === todayISO() ? 'today' : 'on ' + pretty(date)}</b><span class="muted">${nextOpen(st.sp, date)}</span></div>` : `
      <div class="res-head"><b>${esc(st.sp.replace(' (incl. Black-tailed)', ''))}</b><span class="muted tnum">${muCount(rows)} WMUs · ${byR.size} region${byR.size > 1 ? 's' : ''}</span></div>
      <div class="legend"><span><i style="background:#2fbf4a"></i>Open</span><span><i style="background:#f2c200"></i>Open with conditions — check the footnote</span></div>
      ${[...byR].map(([reg, rs]) => `<div class="reg-card"><button class="reg-h" data-zoom="${esc(reg)}"><b>${esc(reg)}</b><span class="muted">Show on map</span>${icon('chevR', { size: 16 })}</button>
        ${rs.map((r) => `<div class="s-line"><div><div class="cls">${r.c ? esc(r.c) : /deer|moose|elk|sheep|caribou/i.test(r.sp) ? '<span class="muted">Class — see synopsis p.' + r.p + '</span>' : 'Any'}${r.q ? ` <span class="chip">${esc(r.q)}</span>` : ''}${r.n ? ' <span class="chip warn">conditions</span>' : ''}</div>
          <div class="muted tnum">${esc(fmtRange(openRange(r, date)))}${r.b ? ` · limit ${esc(r.b)}` : ''} · p.${r.p}</div>
          <div class="mus tnum">${esc(compactMUs(r.mu))}</div></div></div>`).join('')}</div>`).join('')}`;
  } else { M.clearShade(); setChip(''); }

  v.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sp != null) { st.sp = st.sp === b.dataset.sp ? '' : b.dataset.sp; render(v); if (st.sp) { const o = v.querySelector('#sOut'); v.scrollTo({ top: o.offsetTop - 12, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } return; }
    if (b.dataset.date) { app.date = b.dataset.date; render(v); return; }
    if (b.dataset.weapon) { st.weapon = b.dataset.weapon; render(v); return; }
    if (b.dataset.zoom) {
      const mus = new Set(rowsFor(st.sp, date).filter((r) => r.r === b.dataset.zoom).flatMap((r) => r.mu));
      const cs = []; const walk = (a) => (typeof a[0] === 'number' ? cs.push(a) : a.forEach(walk));
      for (const f of M.WMU_GEO?.features || []) if (mus.has(f.properties.id)) walk(f.geometry.coordinates);
      M.fitTo(cs);
    }
  };
  v.querySelector('#sDate').onchange = (e) => { if (e.target.value) { app.date = e.target.value; render(v); } };
  v.querySelector('#sYouth').onchange = (e) => { st.youth = e.target.checked; render(v); };
}

function nextOpen(sp, date) {
  for (let i = 1; i <= 366; i++) {
    const d = new Date(date + 'T12:00'); d.setDate(d.getDate() + i); const s = iso(d);
    if (rowsFor(sp, s).length) return `Next opens ${pretty(s)}${d.getFullYear() !== new Date(date).getFullYear() ? ', ' + d.getFullYear() : ''}.`;
  }
  return 'No general season found in the next year — likely LEH only.';
}

// "3-12, 3-13, 3-14" -> "3-12 to 3-14"
export function compactMUs(mus) {
  const s = [...mus].sort(muSort); const out = []; let i = 0;
  while (i < s.length) {
    let j = i; const [r] = s[i].split('-');
    while (j + 1 < s.length && s[j + 1].split('-')[0] === r && +s[j + 1].split('-')[1] === +s[j].split('-')[1] + 1) j++;
    out.push(j - i >= 2 ? `${s[i]} to ${s[j]}` : s.slice(i, j + 1).join(', ')); i = j + 1;
  }
  return 'MUs ' + out.join(', ');
}
