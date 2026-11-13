import * as db from '../db.js?v=20261113074749-ce63ffc';
import { store, hunters } from '../db.js?v=20261113074749-ce63ffc';
import { esc, opts, modal, closeModal, toast, formData, num, tip } from '../util.js?v=20261113074749-ce63ffc';
import { hunterDatalist, speciesDatalist } from './log.js?v=20261113074749-ce63ffc';
import { icon } from '../icons.js?v=20261113074749-ce63ffc';
import * as M from '../map.js?v=20261113074749-ce63ffc';
import { muSort } from '../seasons.js?v=20261113074749-ce63ffc';

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
  const { selChip } = await import('../main.js?v=20261113074749-ce63ffc');
  let fc = await lehArea(h); let exact = !!fc;
  if (!fc) fc = { type: 'FeatureCollection', features: (M.WMU_GEO?.features || []).filter((f) => h.mus.includes(f.properties.id)) };
  fc = { type: 'FeatureCollection', features: fc.features.map((f) => ({ ...f, properties: { stroke: '#ff8a00', fill: '#ff8a00', fillOpacity: 0.22 } })) };
  M.setSelection(fc);
  const cs = []; const walk = (a) => (typeof a[0] === 'number' ? cs.push(a) : a.forEach(walk)); fc.features.forEach((f) => walk(f.geometry.coordinates));
  if (cs.length) M.fitTo(cs, { maxZoom: 11 });
  selChip(`${h.code} · ${h.sp} ${h.class}${exact ? '' : ' (unit outline)'}`);
}
export function onData(w) { if (['tags', 'leh', 'all'].includes(w) && render.v?.isConnected) render(render.v); }

function renderTags(body) {
  const tags = store.tags.slice().sort((a, b) => b.year - a.year);
  const cost = tags.filter((t) => t.year === yr).reduce((a, t) => a + (+t.cost || 0), 0);
  body.innerHTML = `<div class="row" style="justify-content:space-between"><span class="muted">${tags.filter((t) => t.year === yr).length} tags this year · $${cost.toFixed(2)}</span><button class="small primary" id="addTag">${icon('plus', { size: 15 })}Tag</button></div>
  ${tags.length ? tags.map((t) => `<div class="wp-row" data-tag="${t.id}"><input type="checkbox" data-fill="${t.id}" ${t.filled ? 'checked' : ''} aria-label="Filled">
    <div class="t"><b>${esc(t.species)} ${t.tag_type ? '· ' + esc(t.tag_type) : ''}</b><span class="muted">${t.year}${t.wmu ? ' · ' + esc(t.wmu) : ''}${t.hunter && t.hunter !== 'Me' ? ' · ' + esc(t.hunter) : ''}${t.cost ? ' · $' + t.cost : ''}${t.filled ? ' · filled' : ''}</span></div>${icon('chevR', { size: 18 })}</div>`).join('')
    : '<div class="empty"><b>No tags yet</b><span class="muted">Log the species licences you buy each year, and tick them when filled.</span></div>'}`;
  body.querySelector('#addTag').onclick = () => tagForm({ year: yr });
  body.onclick = (e) => { if (e.target.dataset.fill) return; const r = e.target.closest('[data-tag]'); if (r) tagForm(store.tags.find((x) => x.id === r.dataset.tag)); };
  body.onchange = async (e) => { const id = e.target.dataset.fill; if (id) await db.update('tags', id, { filled: e.target.checked }); };
}
function renderHist(body) {
  const rows = store.leh.slice().sort((a, b) => b.year - a.year || (a.choice || 1) - (b.choice || 1));
  body.innerHTML = `<div class="row" style="justify-content:space-between"><span class="muted tip-h">Past draws${tip('A win lowers your odds for that species in later draws.')}</span><button class="small primary" id="addLeh">${icon('plus', { size: 15 })}Add</button></div>
  ${rows.length ? rows.map((l) => `<div class="wp-row" data-leh="${l.id}"><span class="pick-n">${l.year}</span><div class="t"><b>${esc(l.hunt_code || '—')} · ${esc(l.species || '')} ${esc(l.class || '')}</b><span class="muted">${l.choice === 2 ? '2nd choice' : '1st choice'} · ${l.drawn == null ? 'pending' : l.drawn ? 'DRAWN' : 'not drawn'}</span></div>${icon('chevR', { size: 18 })}</div>`).join('')
    : '<div class="empty"><b>No LEH history</b><span class="muted">Add past applications to keep track of your wins.</span></div>'}`;
  body.querySelector('#addLeh').onclick = () => lehForm({ year: yr });
  body.onclick = (e) => { const r = e.target.closest('[data-leh]'); if (r) lehForm(store.leh.find((x) => x.id === r.dataset.leh)); };
}
export const lehForMu = async (mu) => ((await loadLeh()).hunts || []).filter((h) => h.mus.includes(mu)).sort((a, b) => (a.sp || '').localeCompare(b.sp || '') || (a.odds ?? 1e9) - (b.odds ?? 1e9));

function tagForm(t) {
  const isNew = !t.id;
  const b = modal(`<h3>${isNew ? 'New tag' : 'Edit tag'}</h3><form class="grid2">
  <label>Year <input type="number" name="year" required value="${t.year ?? yr}"></label>
  <label>Species <input name="species" list="speciesList" required value="${esc(t.species || '')}"></label>
  <label>Type <input name="tag_type" list="tagTypes" value="${esc(t.tag_type || '')}"></label>
  <label>Cost $ <input type="number" step="0.01" name="cost" value="${t.cost ?? ''}"></label>
  <label>WMU / zone <input name="wmu" value="${esc(t.wmu || '')}"></label>
  <label>Hunter <input name="hunter" list="hunterList" value="${esc(t.hunter || 'Me')}"></label>
  <label style="color:var(--ink)"><input type="checkbox" name="filled" ${t.filled ? 'checked' : ''}> Filled</label>
  <label class="span2">Notes <textarea name="notes">${esc(t.notes || '')}</textarea></label>
  <div class="row span2"><button class="primary">Save</button>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div></form>
  <datalist id="tagTypes"><option value="General"><option value="LEH"><option value="Resident"><option value="Youth"></datalist>${hunterDatalist()}${speciesDatalist()}`);
  const f = b.querySelector('form');
  f.onsubmit = async (e) => { e.preventDefault(); const o = formData(f); o.year = +o.year; o.cost = num(o.cost);
    try { isNew ? await db.insert('tags', o) : await db.update('tags', t.id, o); closeModal(); } catch (err) { toast(err.message, 5000); } };
  b.querySelector('#del')?.addEventListener('click', async () => { if (confirm('Delete tag?')) { await db.remove('tags', t.id); closeModal(); } });
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
