import * as db from '../db.js?v=20261113161343-e1f21e7';
import { store, hunters } from '../db.js?v=20261113161343-e1f21e7';
import { esc, opts, modal, closeModal, toast, formData, num, tip } from '../util.js?v=20261113161343-e1f21e7';
import { hunterDatalist, speciesDatalist } from './log.js?v=20261113161343-e1f21e7';
import { icon } from '../icons.js?v=20261113161343-e1f21e7';
import * as M from '../map.js?v=20261113161343-e1f21e7';
import * as LIC from '../licences.js?v=20261113161343-e1f21e7';
import * as L from '../limits.js?v=20261113161343-e1f21e7';
import { SEASONS, openRange } from '../seasons.js?v=20261113161343-e1f21e7';
import { muSort } from '../seasons.js?v=20261113161343-e1f21e7';

// Tags & LEH. LEH hunts come from the 2026-2027 LEH synopsis (hunt-hq-handoff/data/leh_2026.json, scripts/parse_leh.py).
const yr = new Date().getFullYear();
// The 2026 draw closed June 23, 2026; after that, picks are planning for next year's draw (codes can change).
const DRAW_YEAR = Date.now() > Date.parse('2026-06-24T07:00:00Z') ? 2027 : 2026;
let LEH = null;
export const loadLeh = () => LEH || (LEH = fetch('hunt-hq-handoff/data/leh_2026.json').then((r) => r.json()).catch(() => ({ hunts: [] })));
const ui = { pin: '', tab: 'leh', sp: '', region: '', mine: false, sort: 'odds', q: '', limit: 40, when: '', day: '' };
// "Oct 16-Oct 24 & Oct 27-Oct 31" -> [['10-16','10-24'], ['10-27','10-31']] (ranges may wrap past Dec 31)
const MONTH_N = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const p2 = (n) => String(n).padStart(2, '0');
function huntRanges(h) {
  if (h._r) return h._r;
  const out = [];
  for (const part of h.dates.split('&')) {
    const m = part.trim().match(/^([A-Za-z]{3,5})\.?\s*(\d{1,2})\s*-\s*(?:([A-Za-z]{3,5})\.?\s*)?(\d{1,2})$/); if (!m) continue;
    const a = MONTH_N[m[1].slice(0, 3).toLowerCase()], b = m[3] ? MONTH_N[m[3].slice(0, 3).toLowerCase()] : a;
    out.push([`${p2(a)}-${p2(+m[2])}`, `${p2(b)}-${p2(+m[4])}`]);
  }
  return (h._r = out);
}
const inR = (md, [a, b]) => (a <= b ? md >= a && md <= b : md >= a || md <= b);
function whenOk(h) {
  if (!ui.when) return true;
  const rs = huntRanges(h); if (!rs.length) return true;
  if (ui.when === 'day') return !ui.day || rs.some((r) => inR(ui.day.slice(5), r));
  const mm = ui.when; // '09' = any overlap with September
  return rs.some(([a, b]) => { for (let d = 1; d <= 31; d++) if (inR(`${mm}-${p2(d)}`, [a, b])) return true; return false; });
}
const WHEN_OPTS = [['', 'All dates'], ['08', 'August'], ['09', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December'], ['01', 'January'], ['02', 'February'], ['03', 'March'], ['04', 'April'], ['05', 'May'], ['06', 'June'], ['day', 'Open on a date…']];
const REGIONS = [['1', 'Vancouver Island'], ['2', 'Lower Mainland'], ['3', 'Thompson'], ['4', 'Kootenay'], ['5', 'Cariboo'], ['6', 'Skeena'], ['7A', 'Omineca'], ['7B', 'Peace'], ['8', 'Okanagan']];

// Synopsis "2025 First Choice Odds" = first-choice applicants : authorizations, so 12.0:1 is roughly a 1-in-12 chance.
export function oddsText(o) {
  if (o == null) return { big: 'New hunt', small: 'No odds from last year', pct: null, cls: '' };
  if (o <= 1) return { big: 'Very good', small: `${o}:1 · more tags than applicants`, pct: 100, cls: 'ok' };
  const pct = 100 / o;
  return { big: `1 in ${Math.round(o)}`, small: `${o}:1 · about ${pct < 1 ? pct.toFixed(1) : Math.round(pct)}%`, pct, cls: pct >= 20 ? 'ok' : pct >= 5 ? 'warn' : 'bad' };
}
const myMus = () => new Set([...store.spots.map((s) => s.wmu), ...store.trips.map((t) => t.wmu)].filter(Boolean));
const picked = (code) => store.leh.find((l) => String(l.year) === String(DRAW_YEAR) && l.hunt_code === code);

export function huntCard(h, { compact = false } = {}) {
  const o = oddsText(h.odds); const p = picked(h.code);
  const where = [h.area, `WMU ${h.mu.replace(/\*+/g, '')}${h.zone ? ' zone ' + h.zone : ''}${h.partial ? ' (part)' : ''}`].filter(Boolean).join(', ');
  return `<article class="leh-card ${p ? 'picked' : ''}" data-hl="${h.code}" tabindex="0" title="Tap to show on the map">
    <span class="leh-code tnum">${h.code}</span>
    <div class="t"><b>${esc(h.sp || '')}, ${esc(h.class.toLowerCase())}</b><span class="muted">${esc(where)}</span>
      <span class="leh-meta tnum">${esc(h.dates)} · ${h.auth} tag${h.auth === 1 ? '' : 's'}${h.tag ? ` · ${esc(h.tag.toLowerCase())}` : ''}</span></div>
    <div class="leh-side"><span class="leh-odds ${o.cls}" title="${esc(o.small)}">${o.big}</span>
      ${compact ? '' : p ? `<button class="pick-btn on" data-unpick="${p.id}" aria-label="Remove ${h.code} from my picks">${icon('check', { size: 16 })}${p.choice === 2 ? '2nd' : '1st'}</button>`
        : `<button class="pick-btn" data-pick="${h.code}" aria-label="Add ${h.code} to my picks">${icon('plus', { size: 16 })}Pick</button>`}</div>
  </article>`;
}

export async function render(v) {
  render.v = v;
  v.innerHTML = `<div class="page-h"><h2>LEH &amp; tags</h2><button class="how-btn" id="lehHow">${icon('info', { size: 16 })}How the draw works</button></div>
  <div class="seg" role="tablist" style="margin-bottom:12px"><button data-t="leh" class="${ui.tab === 'leh' ? 'on' : ''}">LEH draw</button><button data-t="tags" class="${ui.tab === 'tags' ? 'on' : ''}">My tags</button><button data-t="hist" class="${ui.tab === 'hist' ? 'on' : ''}">History</button></div>
  <div id="tagBody"></div>`;
  v.querySelector('#lehHow').onclick = async () => { const H = render.howHTML || ((await loadLeh()) && render.howHTML); modal(H || '<p>Open LEH draw first.</p>'); if (!store.prefs.lehHowSeen) db.savePrefs({ lehHowSeen: true }).catch(() => {}); };
  v.querySelector('.seg').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) { ui.tab = b.dataset.t; render(v); } };
  const body = v.querySelector('#tagBody');
  if (ui.tab !== 'leh') onLeave();
  if (ui.tab === 'tags') return renderTags(body);
  if (ui.tab === 'hist') return renderHist(body);
  const data = await loadLeh(); if (!v.isConnected) return;
  const hunts = data.hunts || [];
  const species = [...new Set(hunts.map((h) => h.sp).filter(Boolean))].sort();
  const deadline = new Date(data.deadline || '2026-06-23T23:59:00-07:00');
  const days = Math.ceil((deadline - Date.now()) / 864e5);
  const picks = store.leh.filter((l) => String(l.year) === String(DRAW_YEAR));
  render.howHTML = `<h3>How the LEH draw works</h3><ul class="how-list">
      <li><b>It's a lottery.</b> Some hunts (bull moose, elk, sheep, goat, antlerless…) are only open to hunters drawn in the Limited Entry Hunting draw.</li>
      <li><b>Apply by ${deadline.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Vancouver' })}, 11:59 pm</b> on WILD (gov.bc.ca/WILD) or at a Service BC / FrontCounter BC office. $6.30 per application, not refundable.</li>
      <li><b>One application per species</b>, each with an optional <b>2nd choice</b> for the same species (used only if you aren't drawn for your 1st).</li>
      <li><b>Odds:</b> "12:1" means about 12 first-choice applicants per tag last year, so roughly 1 in 12. Below 1:1 means more tags than applicants.</li>
      <li><b>Win and your odds drop:</b> moose anywhere, or elk in Regions 1–2: odds cut 66% for 3 years. Other species (not deer, black bear, turkey): cut 50% for 1 year.</li>
      <li><b>If drawn</b> you still need a hunting licence and species licence. Check WILD after the draw; authorizations aren't mailed.</li>
      <li><b>Group / shared hunts:</b> apply as 2–4 people (not for moose groups, bison, black bear, or elk in R1–2; moose & bison use "shared" hunts where a group shares 1–2 animals).</li>
    </ul><p class="muted fine">From the 2026–2027 LEH synopsis. Codes change every year, so confirm them there.</p>`;
  body.innerHTML = `

  <div class="card picks">
    <div class="row" style="justify-content:space-between"><b>My ${DRAW_YEAR} picks</b><span class="muted fine tip-h" style="margin:0">${days > 0 ? `${days} days to apply` : `Planning${tip(`The 2026 draw is closed. Plan with these hunts, then re-check the codes when the ${DRAW_YEAR} synopsis comes out in spring.`)}`}</span></div>
    
    ${picks.length ? picks.sort((a, b) => (a.species || '').localeCompare(b.species || '') || (a.choice || 1) - (b.choice || 1)).map((l) => {
      const h = hunts.find((x) => x.code === l.hunt_code); const o = oddsText(h?.odds);
      return `<div class="pick-row"><span class="pick-n">${l.choice === 2 ? '2nd' : '1st'}</span><div class="t"><b>${esc(l.hunt_code)} · ${esc(l.species || '')} ${esc(l.class || '')}</b><span class="muted">${esc(h ? `${h.area} · ${h.dates}` : l.zone || '')} · ${esc(o.big)}</span></div>
        <button class="small" data-choice="${l.id}">${l.choice === 2 ? 'Make 1st' : 'Make 2nd'}</button><button class="icon-btn" data-unpick="${l.id}" aria-label="Remove">${icon('x', { size: 16 })}</button></div>`;
    }).join('') : '<p class="muted" style="margin:6px 0 0">No picks yet. Add a 1st and 2nd choice per species from the list below.</p>'}
    ${picks.length ? `<p class="muted fine">Codes to enter: ${[...new Set(picks.map((l) => l.species))].map((s) => `${esc(s)}: ${picks.filter((l) => l.species === s).sort((a, b) => (a.choice || 1) - (b.choice || 1)).map((l) => l.hunt_code).join(' then ')}`).join(' · ')}</p>` : ''}
  </div>
  <h3 class="sub-h">Find hunts <span class="muted tnum">${hunts.length}</span></h3>
  <div class="sp-filter">${['', ...species].map((s) => `<button class="f-chip" aria-pressed="${ui.sp === s}" data-sp="${esc(s)}">${esc(s || 'All')}</button>`).join('')}</div>
  <div class="grid2" style="margin:8px 0">
    <label>Region <select id="lReg"><option value="">All regions</option>${REGIONS.map(([id, n]) => `<option value="${id}" ${ui.region === id ? 'selected' : ''}>${id} · ${n}</option>`).join('')}</select></label>
    <label>When <select id="lWhen">${WHEN_OPTS.map(([v, n]) => `<option value="${v}" ${ui.when === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label id="lDayWrap" class="${ui.when === 'day' ? '' : 'hidden'}">Date <input type="date" id="lDay" value="${ui.day}"></label>
    <label>Sort <select id="lSort">${opts([{ id: 'odds', name: 'Best odds' }, { id: 'tags', name: 'Most tags' }, { id: 'code', name: 'Hunt code' }, { id: 'date', name: 'Season start' }], ui.sort)}</select></label>
    <input id="lQ" class="span2" type="search" placeholder="Search area, WMU or class" value="${esc(ui.q)}">
  </div>
  <label class="switch"><input type="checkbox" id="lMine" ${ui.mine ? 'checked' : ''}><span>Only units I've hunted (${myMus().size})</span></label>
  <div id="lList"></div>`;
  let fitNext = false;
  render.reveal = (code) => { ui.pin = code; draw(); };
  const draw = () => {
    const q = ui.q.toLowerCase(); const mine = myMus();
    let list = hunts.filter((h) => whenOk(h) && (!ui.sp || h.sp === ui.sp) && (!ui.region || h.rn === ui.region) && (!ui.mine || h.mus.some((m) => mine.has(m)))
      && (!q || [h.code, h.area, h.mu, h.mus.join(' '), h.class, h.tag, h.sp].join(' ').toLowerCase().includes(q)));
    const startKey = (h) => { const r = huntRanges(h)[0]; if (!r) return '99'; const m = +r[0].slice(0, 2); return (m < 7 ? m + 12 : m) + r[0].slice(2); }; // season year runs Aug -> spring
    list.sort(ui.sort === 'date' ? (a, b) => startKey(a).localeCompare(startKey(b)) : ui.sort === 'odds' ? (a, b) => (a.odds ?? 1e9) - (b.odds ?? 1e9) : ui.sort === 'tags' ? (a, b) => b.auth - a.auth : (a, b) => a.code.localeCompare(b.code));
    const pinned = ui.pin && list.find((h) => h.code === ui.pin); if (pinned) list = [pinned, ...list.filter((h) => h !== pinned)];
    const shown = list.slice(0, ui.limit);
    showFiltered(list, { fit: fitNext }); fitNext = false;
    body.querySelector('#lList').innerHTML = `<p class="muted fine">${list.length} hunts${ui.when ? ` ${ui.when === 'day' ? 'open on ' + (ui.day || 'that date') : 'with days in ' + WHEN_OPTS.find((w) => w[0] === ui.when)[1]}` : ''}${list.length > shown.length ? ` · showing ${shown.length}` : ''}</p>${shown.map((h) => huntCard(h)).join('')}
      ${list.length > shown.length ? '<button id="lMore" class="small" style="width:100%">Show more</button>' : ''}${!list.length ? '<div class="empty"><b>No hunts match</b><span class="muted">Try another species or region.</span></div>' : ''}`;
  };
  draw();
  body.querySelector('.sp-filter').onclick = (e) => { const b = e.target.closest('[data-sp]'); if (!b) return; ui.sp = b.dataset.sp; ui.limit = 40; ui.pin = ''; fitNext = true; body.querySelectorAll('.sp-filter .f-chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(); };
  body.querySelector('#lReg').onchange = (e) => { ui.region = e.target.value; ui.limit = 40; ui.pin = ''; fitNext = true; draw(); };
  body.querySelector('#lSort').onchange = (e) => { ui.sort = e.target.value; draw(); };
  body.querySelector('#lWhen').onchange = (e) => { ui.when = e.target.value; ui.limit = 40; ui.pin = ''; body.querySelector('#lDayWrap').classList.toggle('hidden', ui.when !== 'day'); if (ui.when === 'day' && !ui.day) { ui.day = new Date().toISOString().slice(0, 10); body.querySelector('#lDay').value = ui.day; } draw(); };
  body.querySelector('#lDay').onchange = (e) => { ui.day = e.target.value; ui.limit = 40; draw(); };
  body.querySelector('#lMine').onchange = (e) => { ui.mine = e.target.checked; ui.pin = ''; fitNext = true; draw(); };
  let qT; body.querySelector('#lQ').oninput = (e) => { ui.q = e.target.value; ui.limit = 40; ui.pin = ''; clearTimeout(qT); draw(); qT = setTimeout(() => { fitNext = true; draw(); }, 700); };
  body.onclick = (e) => {
    if (e.target.closest('#lMore')) { ui.limit += 40; draw(); return; }
    handleLehClick(e, hunts);
  };
}

// Shared handlers (also used by the WMU panel)
export async function handleLehClick(e, hunts) {
  const pk = e.target.closest('[data-pick]')?.dataset.pick;
  if (pk) {
    hunts = hunts || (await loadLeh()).hunts; const h = hunts.find((x) => x.code === pk);
    const same = store.leh.filter((l) => String(l.year) === String(DRAW_YEAR) && l.species === h.sp);
    if (same.length >= 2) { toast(`You already have a 1st and 2nd choice for ${h.sp}. Remove one first.`, 4000); return; }
    await db.insert('leh', { year: DRAW_YEAR, species: h.sp, hunt_code: h.code, zone: [h.area, 'MU ' + h.mu, h.zone && 'zone ' + h.zone].filter(Boolean).join(' · '), class: h.class, choice: same.length ? 2 : 1, odds: h.odds ? +(100 / Math.max(1, h.odds)).toFixed(2) : null, hunter: 'Me', notes: h.dates });
    toast(`Added ${h.code} as your ${same.length ? '2nd' : '1st'} choice for ${h.sp}`); return;
  }
  const un = e.target.closest('[data-unpick]')?.dataset.unpick; if (un) { await db.remove('leh', un); return; }
  const ch = e.target.closest('[data-choice]')?.dataset.choice;
  if (ch) { const l = store.leh.find((x) => x.id === ch); const other = store.leh.find((x) => x.id !== ch && String(x.year) === String(l.year) && x.species === l.species);
    await db.update('leh', ch, { choice: l.choice === 2 ? 1 : 2 }); if (other) await db.update('leh', other.id, { choice: l.choice === 2 ? 2 : 1 }); return; }
  const mp = e.target.closest('[data-lehmap]')?.dataset.lehmap || (!e.target.closest('button,a,input,select') && e.target.closest('[data-hl]')?.dataset.hl);
  if (mp) {
    hunts = hunts || (await loadLeh()).hunts; const h = hunts.find((x) => x.code === mp);
    document.querySelectorAll('.leh-card.hl').forEach((c) => c.classList.remove('hl'));
    document.querySelectorAll(`.leh-card[data-hl="${mp}"]`).forEach((c) => c.classList.add('hl'));
    await highlightHunt(h);
  }
}

// Outline the hunt's exact LEH area (zone or whole unit) from the BC LEH zone layer; fall back to the unit outline.
const TYPE = { 'Mule Deer': 'MULE DEER', 'White-tailed Deer': 'WHITE-TAILED DEER', 'Mountain Goat': 'MOUNTAIN GOAT', 'Mountain Sheep': 'MOUNTAIN SHEEP', 'Black Bear': 'BLACK BEAR' };
const areaCache = new Map();
export const lehKey = (h) => (TYPE[h.sp] || (h.sp || '').toUpperCase()) + '|' + (h.mus[0] || '').replace(/^(\d)-(\d+)$/, (m, a, b) => a + String(b).padStart(2, '0')) + (h.zone || '');
let zoneKeys = null; // keys present in the zone file, so missing ones fall back to the unit outline
async function knownKeys() {
  if (!zoneKeys) zoneKeys = fetch('hunt-hq-handoff/data/leh_zones_2026.geojson').then((r) => r.json()).then((j) => new Set(j.features.map((f) => f.properties.k)));
  return zoneKeys;
}
// Show the finder's current results on the map; fit the map to them when the filter is narrowed.
let lastFit = '';
async function showFiltered(list, { fit = false } = {}) {
  const known = knownSet = await knownKeys();
  const keys = [], mus = [];
  for (const h of list) { const k = lehKey(h); if (known.has(k)) keys.push(k); else mus.push(h.mus[0]); }
  shownList = list;
  await M.setLehFilter([...new Set(keys)], [...new Set(mus)]);
  const sig = keys.concat(mus).sort().join();
  if (fit && sig !== lastFit && list.length && list.length < 400) {
    lastFit = sig;
    const fc = await (await fetch('hunt-hq-handoff/data/leh_zones_2026.geojson')).json(); // cached by the browser
    const ks = new Set(keys), ms = new Set(mus); const cs = []; const walk = (a) => (typeof a[0] === 'number' ? cs.push(a) : a.forEach(walk));
    fc.features.forEach((f) => ks.has(f.properties.k) && walk(f.geometry.coordinates));
    (M.WMU_GEO?.features || []).forEach((f) => ms.has(f.properties.id) && walk(f.geometry.coordinates));
    if (cs.length) M.fitTo(cs, { maxZoom: 10 });
  }
}
let shownList = []; let knownSet = null;
export function onLeave() { shownList = []; lastFit = ''; M.setLehFilter(null, []); }
// Map tap inside a highlighted LEH area: which filtered hunts cover it?
export function huntsAt(features) {
  const ks = new Set(features.filter((f) => f.layer.id === 'lehf-fill').map((f) => f.properties.k));
  const ms = new Set(features.filter((f) => f.layer.id === 'lehf-mu-fill').map((f) => f.properties.id));
  return shownList.filter((h) => ks.has(lehKey(h)) || (ms.has(h.mus[0]) && !knownSet?.has(lehKey(h))));
}
export async function pickHunt(code) {
  const h = shownList.find((x) => x.code === code) || (await loadLeh()).hunts.find((x) => x.code === code); if (!h) return;
  document.querySelectorAll('.leh-card.hl').forEach((c) => c.classList.remove('hl'));
  let card = document.querySelector(`#lList .leh-card[data-hl="${code}"]`);
  if (!card && render.reveal) { render.reveal(code); card = document.querySelector(`#lList .leh-card[data-hl="${code}"]`); }
  card?.classList.add('hl'); card?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  await highlightHunt(h);
}
async function lehArea(h) {
  const id = (h.mus[0] || '').replace(/^(\d)-(\d+)$/, (m, a, b) => a + String(b).padStart(2, '0')) + (h.zone || '');
  const type = TYPE[h.sp] || (h.sp || '').toUpperCase();
  const key = type + '|' + id;
  if (!areaCache.has(key)) areaCache.set(key, (async () => {
    const p = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeName: 'pub:WHSE_WILDLIFE_MANAGEMENT.WAA_LTD_HNT_ZONE_CURR_YEAR_SVW', outputFormat: 'application/json', srsName: 'EPSG:4326',
      CQL_FILTER: `LTD_ENTRY_HUNTING_ZONE_TYPE='${type}' AND LEH_HUNT_AREA_ID='${id}'` });
    try { const j = await (await fetch(`https://openmaps.gov.bc.ca/geo/pub/wfs?${p}`)).json(); return j.features?.length ? j : null; } catch { return null; }
  })());
  return areaCache.get(key);
}
export async function highlightHunt(h) {
  const { selChip } = await import('../main.js?v=20261113161343-e1f21e7');
  let fc = await lehArea(h); let exact = !!fc;
  if (!fc) fc = { type: 'FeatureCollection', features: (M.WMU_GEO?.features || []).filter((f) => h.mus.includes(f.properties.id)) };
  fc = { type: 'FeatureCollection', features: fc.features.map((f) => ({ ...f, properties: { stroke: '#ff8a00', fill: '#ff8a00', fillOpacity: 0.22 } })) };
  M.setSelection(fc);
  const cs = []; const walk = (a) => (typeof a[0] === 'number' ? cs.push(a) : a.forEach(walk)); fc.features.forEach((f) => walk(f.geometry.coordinates));
  if (cs.length) M.fitTo(cs, { maxZoom: 11 });
  selChip(`${h.code} · ${h.sp} ${h.class}${exact ? '' : ' (unit outline)'}`);
}
export function onData(w) { if (['tags', 'leh', 'all', 'spots', 'prefs'].includes(w) && render.v?.isConnected) render(render.v); }

// ---- My tags: limits for the licence year + tags that fill themselves from logged kills ----
const tui = { year: L.licenceYear(new Date()) };
const sentence = (x) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase();
const dots = (n, of) => `<span class="lim-dots" aria-hidden="true">${Array.from({ length: of }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
const fmtD = (d) => d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
// Which deer classes have a general (adult) season open today somewhere in the region.
function openFlags(region) {
  const name = L.REGION_NAMES[region]; const iso = new Date().toISOString().slice(0, 10); const f = { wb: false, wa: false, mb: false, ma: false };
  for (const r of SEASONS) {
    if (r.r !== name || !/deer/i.test(r.sp) || /youth|senior/i.test(r.q || '') || !openRange(r, iso)) continue;
    const k = /white/i.test(r.sp) ? 'w' : 'm'; const c = (r.c || '').toLowerCase();
    if (/antlerless/.test(c)) f[k + 'a'] = true; else if (/either|any/.test(c) || !c) { f[k + 'a'] = true; f[k + 'b'] = true; } else f[k + 'b'] = true;
  }
  return f;
}
function leftRow(r, d, mine) {
  if (!mine && !tui.allRegs) return '';
  const o = openFlags(r);
  // A class can't exceed its species' remaining total or the region total.
  const cell = (n, open) => `<td class="n ${n ? '' : 'zero'}">${n ? `<b>${n}</b>` : '–'}${n && open ? '<i class="dot-open" title="Open today"></i>' : ''}</td>`;
  return `<tr class="${mine ? 'mine' : ''}"><td class="reg">${esc(L.REGION_NAMES[r])}<span>Region ${r}${d.L.note ? tip(d.L.note) : ''}</span></td>
    ${cell(d.wtBuck, o.wb)}${cell(d.wtAnl, o.wa)}${cell(d.muleBuck, o.mb)}${cell(d.muleAnl, o.ma)}
    <td class="n tot ${d.all ? '' : 'zero'}">${d.all ? `<b>${d.all}</b>` : '–'}</td></tr>`;
}
function renderTags(body) {
  const cur = L.licenceYear(new Date());
  const years = [...new Set([cur, cur - 1, ...store.tags.map((t) => +t.year)])].filter((y) => y <= cur + 1).sort((a, b) => b - a).slice(0, 4);
  const y = tui.year; const T = L.tally(y); const S = L.tagStatus(y);
  const myRegions = [...new Set([...store.trips.map((t) => L.regionOf(t.wmu)), ...T.kills.map((k) => L.regionOf(k.s.wmu))].filter(Boolean))];
  const regRows = Object.keys(L.DEER).map((r) => { const d = L.deerLeftIn(r, T); return { r, d, mine: myRegions.includes(String(r)) }; })
    .sort((a, b) => (b.mine - a.mine) || Object.keys(L.DEER).indexOf(a.r) - Object.keys(L.DEER).indexOf(b.r));
  const others = [...new Set([...S.tags.map((x) => x.t.species), ...Object.keys(T.other)].filter((sp) => !/deer/i.test(sp)))];
  const open = S.tags.filter((x) => !x.filled).length, cost = S.tags.reduce((a, x) => a + (+x.t.cost || 0), 0);
  const licDue = LIC.due();
  body.innerHTML = `${licDue.length ? `<button class="lic-due" id="goLic">${icon('alert', { size: 18 })}<span>${licDue.map((l) => esc((l.name || LIC.TYPES[l.type]?.name) + ': ' + LIC.status(l).label.toLowerCase())).join(' · ')}</span>${icon('chevR', { size: 16 })}</button>` : ''}
  <div class="seg seg-full" role="tablist" aria-label="Licence year">${years.map((v) => `<button data-ly="${v}" class="${v === y ? 'on' : ''}">${L.yearLabel(v)}</button>`).join('')}</div>
  <div class="card lim-card">
    <div class="lim-h"><b class="tip-h">Deer${tip('BC allows 3 deer per licence year (not Haida Gwaii), and only 1 of them can be a mule deer buck from Regions 3 to 8 combined. Each region also caps mule deer and whitetail. Counts come from kills you logged as yours this licence year (April 1 to March 31).', 'About deer limits')}</b>
      <span class="lim-n tnum">${T.deer.total} of ${L.PROVINCIAL.Deer}</span></div>
    ${dots(T.deer.total, L.PROVINCIAL.Deer)}
    <p class="lim-left">${L.PROVINCIAL.Deer - T.deer.total > 0 ? `You can take <b>${L.PROVINCIAL.Deer - T.deer.total} more deer</b> this licence year${T.deer.muleBuck38 >= L.MULE_BUCK_3_8 ? ', but no more mule deer bucks in Regions 3–8' : ''}.` : '<b>You have reached the provincial deer limit.</b>'}</p>
    <div class="lim-rows">
      <div><span>White-tailed deer</span><b class="tnum">${T.deer.wt} taken</b></div>
      <div><span>Mule deer</span><b class="tnum">${T.deer.mule} taken</b></div>
      <div><span>Mule deer buck, Regions 3–8</span><b class="tnum">${T.deer.muleBuck38} of ${L.MULE_BUCK_3_8}</b></div>
    </div>
    <h4 class="lim-sub tip-h">Deer you can still take${tip("Each number is how many more you can take in that region this licence year, after your logged kills. A green dot means a general season for it is open today in at least some WMUs there (adult hunters). 'Total' is the most deer you can still take in that region, whatever the mix. Always check the unit you hunt.", 'How to read this table')}</h4>
    <div class="table-wrap"><table class="left-table">
      <thead><tr><th rowspan="2">Region</th><th colspan="2">Whitetail</th><th colspan="2">Mule deer</th><th rowspan="2">Total</th></tr>
        <tr><th>Buck</th><th>Antl.</th><th>Buck</th><th>Antl.</th></tr></thead>
      <tbody>${regRows.map(({ r, d, mine }) => leftRow(r, d, mine)).join('')}</tbody></table></div>
    ${regRows.some((x) => !x.mine) ? `<button class="link small-link" id="allRegs">${tui.allRegs ? 'Show only my regions' : 'Show all regions'}</button>` : ''}
    <p class="list-note"><span class="dot-open"></span> open today &nbsp;·&nbsp; Antl. = antlerless</p>
  </div>
  ${others.length ? `<div class="lim-grid">${others.map((sp) => { const lim = L.PROVINCIAL[sp]; const n = T.other[sp] || 0; return `<div class="lim-mini"><span>${esc(sp)}</span><b class="tnum">${n}${lim ? ` of ${lim}` : ' taken'}</b>${lim ? dots(n, lim) : ''}</div>`; }).join('')}</div>` : ''}
  <div class="list-h-row"><h3 class="list-h">Tags ${L.yearLabel(y)}</h3><button class="small primary" id="addTags">${icon('plus', { size: 16 })}Add tags</button></div>
  ${S.tags.length ? `<div class="list-group">${S.tags.map(({ t, kill, filled }) => `<button class="list-row" data-tag="${t.id}">
      <span class="tag-st ${filled ? 'on' : ''}">${icon(filled ? 'check' : 'tag', { size: 16 })}</span>
      <span class="lr-t"><b>${esc(t.species)}</b><span>${esc([t.tag_type && t.tag_type !== 'General' ? t.tag_type : 'General', t.wmu, t.cost ? '$' + (+t.cost).toFixed(2) : ''].filter(Boolean).join(' · '))}</span></span>
      <span class="tag-r">${filled ? `<b class="ok">Filled</b>${kill ? `<span class="muted">${fmtD(kill.d)}${kill.s.wmu ? ', WMU ' + esc(kill.s.wmu) : ''}</span>` : ''}` : '<b class="muted">Open</b>'}</span></button>`).join('')}</div>
    <p class="list-note">${S.tags.length} tag${S.tags.length === 1 ? '' : 's'}, ${open} open${cost ? `, $${cost.toFixed(2)} spent` : ''}. Logged kills fill the matching tag on their own.</p>`
    : `<div class="empty"><b>No tags for ${L.yearLabel(y)} yet</b><span class="muted">Add the species licences you bought.</span></div>`}
  ${S.untagged.length ? `<div class="notice tip-h">${S.untagged.length} kill${S.untagged.length === 1 ? '' : 's'} without a tag: ${S.untagged.map((k) => esc(`${k.s.species} ${fmtD(k.d)}`)).join(', ')}.&nbsp;<button class="link" id="tagKills">Add tag${S.untagged.length === 1 ? '' : 's'}</button></div>` : ''}`;
  body.onclick = async (e) => {
    const yb = e.target.closest('[data-ly]'); if (yb) { tui.year = +yb.dataset.ly; renderTags(body); return; }
    if (e.target.closest('#goLic')) { import('../main.js?v=20261113161343-e1f21e7').then((m) => m.showTabPublic('more')); return; }
    if (e.target.closest('#addTags')) { addTagsSheet(y); return; }
    if (e.target.closest('#allRegs')) { tui.allRegs = !tui.allRegs; renderTags(body); return; }
    if (e.target.closest('#tagKills')) { for (const k of S.untagged) await db.insert('tags', { year: y, species: k.s.species, tag_type: 'General', hunter: 'Me' }); toast('Tags added'); return; }
    const r = e.target.closest('[data-tag]'); if (r) tagForm(store.tags.find((x) => x.id === r.dataset.tag));
  };
}
// Pick every licence you bought at once.
function addTagsSheet(year) {
  const cnt = {};
  const b = modal(`<h3>Add tags</h3><p class="muted" style="margin-top:0">Tap each species licence you bought for ${L.yearLabel(year)}. Tap again for a second deer tag.</p>
    <div class="tag-pick">${L.TAG_SPECIES.map((sp) => `<button type="button" data-sp="${esc(sp)}"><span>${esc(sp)}</span><b class="n"></b></button>`).join('')}</div>
    <div class="row" style="margin-top:14px"><button class="primary" id="tpAdd" disabled>Add tags</button><button type="button" id="tpCancel">Cancel</button></div>`);
  const sync = () => { b.querySelectorAll('[data-sp]').forEach((x) => { const n = cnt[x.dataset.sp] || 0; x.classList.toggle('on', n > 0); x.querySelector('.n').textContent = n > 1 ? '×' + n : ''; });
    const total = Object.values(cnt).reduce((a, n) => a + n, 0); const add = b.querySelector('#tpAdd'); add.disabled = !total; add.textContent = total ? `Add ${total} tag${total === 1 ? '' : 's'}` : 'Add tags'; };
  b.querySelector('.tag-pick').onclick = (e) => { const x = e.target.closest('[data-sp]'); if (!x) return; const sp = x.dataset.sp; const max = /deer/i.test(sp) ? 3 : 1; cnt[sp] = ((cnt[sp] || 0) + 1) % (max + 1); sync(); };
  b.querySelector('#tpCancel').onclick = closeModal;
  b.querySelector('#tpAdd').onclick = async () => {
    const rows = Object.entries(cnt).flatMap(([sp, n]) => Array.from({ length: n }, () => ({ year, species: sp, tag_type: 'General', hunter: 'Me' })));
    try { await db.insert('tags', rows); closeModal(); toast(`Added ${rows.length} tag${rows.length === 1 ? '' : 's'}`); } catch (err) { toast(err.message, 5000); }
  };
}

// Draw record: summary, a rough "how unlucky am I" check from published odds, then applications grouped by year.
async function renderHist(body) {
  const rows = store.leh.filter((l) => +l.year < DRAW_YEAR || l.drawn != null).sort((a, b) => b.year - a.year || (a.species || '').localeCompare(b.species || ''));
  const hunts = (await loadLeh()).hunts || []; const byCode = new Map(hunts.map((h) => [h.code, h]));
  const done = rows.filter((l) => l.drawn != null); const wins = done.filter((l) => l.drawn);
  const years = [...new Set(rows.map((l) => +l.year))];
  const bySp = {}; for (const l of done) (bySp[l.species || 'Other'] ||= []).push(l);
  // Chance each application was drawn, using the 1st-choice odds for the same code in the current synopsis.
  const ps = done.map((l) => { const o = byCode.get(l.hunt_code)?.odds; return o ? Math.min(1, 1 / o) : null; }).filter((x) => x != null);
  const expected = ps.reduce((a, p) => a + p, 0); const pNone = ps.reduce((a, p) => a * (1 - p), 1);
  const statusChip = (l) => (l.drawn == null ? '<span class="lic-st warn">Pending</span>' : l.drawn ? '<span class="lic-st ok">Drawn</span>' : '<span class="lic-st">Not drawn</span>');
  body.innerHTML = `
  ${done.length ? `<div class="card lim-card">
    <div class="lim-h"><b>Draw record</b><span class="lim-n tnum">${wins.length} of ${done.length}</span></div>
    <p class="lim-left">${done.length} applications over ${years.length} draw${years.length === 1 ? '' : 's'}, ${wins.length ? `${wins.length} drawn` : 'none drawn yet'}.</p>
    <div class="lim-rows">${Object.entries(bySp).sort((a, b) => b[1].length - a[1].length).map(([sp, ls]) => `<div><span>${esc(sp)}</span><b class="tnum">${ls.filter((l) => l.drawn).length} of ${ls.length}</b></div>`).join('')}</div>
    ${ps.length >= 3 ? `<p class="hist-luck tip-h">On these odds you'd expect about <b>${expected.toFixed(1)}</b> draw${expected.toFixed(1) === '1.0' ? '' : 's'} by now, and there was a <b>${Math.round(pNone * 100)}%</b> chance of none.${tip(`Uses the published first-choice odds for the same hunt codes in the 2026–27 synopsis (${ps.length} of ${done.length} codes matched). Codes and odds change every year, so treat this as a rough check. BC's draw is random each year: past losses don't improve your odds, and wins lower them for some species.`, 'How this is worked out')}</p>` : ''}
  </div>` : ''}
  <div class="list-h-row"><h3 class="list-h">Applications</h3><button class="small primary" id="addLeh">${icon('plus', { size: 15 })}Add</button></div>
  ${rows.length ? years.map((y) => `<h4 class="lim-sub">${y} draw</h4><div class="list-group">${rows.filter((l) => +l.year === y).map((l) => { const h = byCode.get(l.hunt_code);
      return `<button class="list-row" data-leh="${l.id}"><span class="lr-t"><b>${esc(l.species || 'LEH')}${h && y === DRAW_YEAR - 1 ? `, ${esc(h.class.toLowerCase())}` : ''}</b><span>${esc(l.zone || l.hunt_code || '')}${/shared/i.test(l.notes || '') ? ' · shared' : ''}</span></span>${statusChip(l)}</button>`; }).join('')}</div>`).join('')
    : '<div class="empty"><b>No LEH history yet</b><span class="muted">Add past applications to keep track of your draws.</span></div>'}`;
  body.querySelector('#addLeh').onclick = () => lehForm({ year: yr });
  body.onclick = (e) => { const r = e.target.closest('[data-leh]'); if (r) lehForm(store.leh.find((x) => x.id === r.dataset.leh)); };
}
export const lehForMu = async (mu) => ((await loadLeh()).hunts || []).filter((h) => h.mus.includes(mu)).sort((a, b) => (a.sp || '').localeCompare(b.sp || '') || (a.odds ?? 1e9) - (b.odds ?? 1e9));

function tagForm(t) {
  const isNew = !t.id; const cur = L.licenceYear(new Date());
  const ys = [...new Set([cur + 1, cur, cur - 1, cur - 2, +t.year || cur])].sort((a, b) => b - a);
  const sps = [...new Set([...L.TAG_SPECIES, t.species].filter(Boolean))];
  const b = modal(`<h3>${isNew ? 'New tag' : esc(t.species)}</h3><form class="grid2">
  <label>Species <select name="species" required>${sps.map((x) => `<option ${x === t.species ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
  <label>Licence year <select name="year">${ys.map((v) => `<option value="${v}" ${v === (+t.year || cur) ? 'selected' : ''}>${L.yearLabel(v)}</option>`).join('')}</select></label>
  <label>Type <select name="tag_type">${['General', 'LEH', 'Youth'].map((x) => `<option ${x === (t.tag_type || 'General') ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
  <label>LEH code or area <input name="wmu" value="${esc(t.wmu || '')}" placeholder="e.g. 4175 or 4-24"></label>
  <label>Cost $ <input type="number" step="0.01" name="cost" value="${t.cost ?? ''}" inputmode="decimal"></label>
  <label>Hunter <input name="hunter" list="hunterList" value="${esc(t.hunter || 'Me')}"></label>
  <label class="switch span2"><input type="checkbox" name="filled" ${t.filled ? 'checked' : ''}><span>Filled, but the kill isn't logged</span></label>
  <label class="span2">Notes <textarea name="notes">${esc(t.notes || '')}</textarea></label>
  <div class="row span2"><button class="primary">Save</button>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div></form>${hunterDatalist()}`);
  const f = b.querySelector('form');
  f.onsubmit = async (e) => { e.preventDefault(); const o = formData(f); o.year = +o.year; o.cost = num(o.cost); o.filled = f.filled.checked;
    try { isNew ? await db.insert('tags', o) : await db.update('tags', t.id, o); closeModal(); } catch (err) { toast(err.message, 5000); } };
  b.querySelector('#del')?.addEventListener('click', async () => { if (confirm('Delete this tag?')) { await db.remove('tags', t.id); closeModal(); } });
}

function lehForm(l) {
  const isNew = !l.id;
  const b = modal(`<h3>${isNew ? 'New application' : 'Edit application'}</h3><form class="grid2">
  <label>Year <input type="number" name="year" required value="${l.year ?? yr}"></label>
  <label>Hunt code <input name="hunt_code" value="${esc(l.hunt_code || '')}"></label>
  <label>Species <input name="species" list="speciesList" value="${esc(l.species || '')}"></label>
  <label>Zone <input name="zone" value="${esc(l.zone || '')}"></label>
  <label>Class <input name="class" value="${esc(l.class || '')}" placeholder="Bulls, Antlerless…"></label>
  <label>Choice # <input type="number" name="choice" value="${l.choice ?? ''}"></label>
  <label>Drawn <select name="drawn">${opts([{ id: '', name: 'Pending' }, { id: 'true', name: 'Yes' }, { id: 'false', name: 'No' }], l.drawn == null ? '' : String(l.drawn))}</select></label>
  <label>Odds % <input type="number" step="any" name="odds" value="${l.odds ?? ''}"></label>
  <label>Hunter <input name="hunter" list="hunterList" value="${esc(l.hunter || 'Me')}"></label>
  <label class="span2">Notes <textarea name="notes">${esc(l.notes || '')}</textarea></label>
  <div class="row span2"><button class="primary">Save</button>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div></form>${hunterDatalist()}${speciesDatalist()}`);
  const f = b.querySelector('form');
  f.onsubmit = async (e) => { e.preventDefault(); const o = formData(f); o.year = +o.year; o.choice = num(o.choice); o.odds = num(o.odds); o.drawn = o.drawn == null ? null : o.drawn === 'true';
    try { isNew ? await db.insert('leh', o) : await db.update('leh', l.id, o); closeModal(); } catch (err) { toast(err.message, 5000); } };
  b.querySelector('#del')?.addEventListener('click', async () => { if (confirm('Delete?')) { await db.remove('leh', l.id); closeModal(); } });
}
