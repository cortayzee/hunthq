import * as db from '../db.js?v=20261113050808-88c37d4';
import { store, hunters } from '../db.js?v=20261113050808-88c37d4';
import { esc, opts, modal, closeModal, toast, formData, num } from '../util.js?v=20261113050808-88c37d4';
import { hunterDatalist, speciesDatalist } from './log.js?v=20261113050808-88c37d4';
import { icon } from '../icons.js?v=20261113050808-88c37d4';
import * as M from '../map.js?v=20261113050808-88c37d4';
import { muSort } from '../seasons.js?v=20261113050808-88c37d4';

// Tags & LEH. LEH hunts come from the 2026-2027 LEH synopsis (hunt-hq-handoff/data/leh_2026.json, scripts/parse_leh.py).
const yr = new Date().getFullYear();
// The 2026 draw closed June 23, 2026; after that, picks are planning for next year's draw (codes can change).
const DRAW_YEAR = Date.now() > Date.parse('2026-06-24T07:00:00Z') ? 2027 : 2026;
let LEH = null;
export const loadLeh = () => LEH || (LEH = fetch('hunt-hq-handoff/data/leh_2026.json').then((r) => r.json()).catch(() => ({ hunts: [] })));
const ui = { tab: 'leh', sp: '', region: '', mine: false, sort: 'odds', q: '', limit: 40 };
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
  return `<article class="leh-card">
    <div class="leh-top"><span class="leh-code tnum">${h.code}</span><div class="t"><b>${esc(h.sp || '')} · ${esc(h.class)}</b>
      <span class="muted">${esc(h.area)} · <span class="nowrap">MU ${esc(h.mu.replace(/\*+/g, ''))}${h.zone ? ' zone ' + esc(h.zone) : ''}</span>${h.partial ? ' (part)' : ''}</span></div>
      <div class="leh-odds ${o.cls}"><b>${o.big}</b><span>${esc(o.small)}</span></div></div>
    <div class="leh-meta"><span>${icon('calendar', { size: 14 })}${esc(h.dates)}</span><span>${h.auth} tag${h.auth === 1 ? '' : 's'}</span>${h.tag ? `<span class="chip">${esc(h.tag)}</span>` : ''}</div>
    ${o.pct != null ? `<div class="odds-bar"><span style="width:${Math.max(2, Math.min(100, o.pct))}%"></span></div>` : ''}
    ${compact ? '' : `<div class="row leh-act"><button class="small" data-lehmap="${h.code}">${icon('pin', { size: 15 })}Map</button>
      ${p ? `<button class="small" data-unpick="${p.id}">${icon('check', { size: 15 })}Choice ${p.choice || 1} · remove</button>` : `<button class="small primary" data-pick="${h.code}">${icon('plus', { size: 15 })}Add to my picks</button>`}</div>`}
  </article>`;
}

export async function render(v) {
  render.v = v;
  v.innerHTML = `<div class="page-h"><h2>Tags &amp; LEH</h2></div>
  <div class="seg" role="tablist" style="margin-bottom:12px"><button data-t="leh" class="${ui.tab === 'leh' ? 'on' : ''}">LEH draw</button><button data-t="tags" class="${ui.tab === 'tags' ? 'on' : ''}">My tags</button><button data-t="hist" class="${ui.tab === 'hist' ? 'on' : ''}">History</button></div>
  <div id="tagBody"></div>`;
  v.querySelector('.seg').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) { ui.tab = b.dataset.t; render(v); } };
  const body = v.querySelector('#tagBody');
  if (ui.tab === 'tags') return renderTags(body);
  if (ui.tab === 'hist') return renderHist(body);
  const data = await loadLeh(); if (!v.isConnected) return;
  const hunts = data.hunts || [];
  const species = [...new Set(hunts.map((h) => h.sp).filter(Boolean))].sort();
  const deadline = new Date(data.deadline || '2026-06-23T23:59:00-07:00');
  const days = Math.ceil((deadline - Date.now()) / 864e5);
  const picks = store.leh.filter((l) => String(l.year) === String(DRAW_YEAR));
  body.innerHTML = `
  <details class="card how" ${store.prefs.lehHowSeen ? '' : 'open'}><summary><b>How the LEH draw works</b> <span class="muted">· 1 min read</span></summary>
    <ul class="how-list">
      <li><b>It's a lottery.</b> Some hunts (bull moose, elk, sheep, goat, antlerless…) are only open to hunters drawn in the Limited Entry Hunting draw.</li>
      <li><b>Apply by ${deadline.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Vancouver' })}, 11:59 pm</b> on WILD (gov.bc.ca/WILD) or at a Service BC / FrontCounter BC office. $6.30 per application, not refundable.</li>
      <li><b>One application per species</b>, each with an optional <b>2nd choice</b> for the same species (used only if you aren't drawn for your 1st).</li>
      <li><b>Odds:</b> "12:1" means about 12 first-choice applicants per tag last year, so roughly 1 in 12. Below 1:1 means more tags than applicants.</li>
      <li><b>Win and your odds drop:</b> moose anywhere, or elk in Regions 1–2: odds cut 66% for 3 years. Other species (not deer, black bear, turkey): cut 50% for 1 year.</li>
      <li><b>If drawn</b> you still need a hunting licence and species licence. Check WILD after the draw; authorizations aren't mailed.</li>
      <li><b>Group / shared hunts:</b> apply as 2–4 people (not for moose groups, bison, black bear, or elk in R1–2; moose & bison use "shared" hunts where a group shares 1–2 animals).</li>
    </ul><p class="muted fine">From the 2026-2027 LEH Regulations Synopsis. Always confirm codes there: codes change every year.</p></details>
  <div class="card picks">
    <div class="row" style="justify-content:space-between"><b>My ${DRAW_YEAR} picks</b><span class="muted fine" style="margin:0">${days > 0 ? `${days} days to apply` : 'Planning'}</span></div>
    ${days <= 0 ? `<p class="notice" style="margin:8px 0 0">The 2026 draw closed June 23. Use these 2026 hunts to plan for ${DRAW_YEAR}: the new synopsis comes out in spring and <b>hunt codes can change</b>, so re-check each code before you apply.</p>` : ''}
    ${picks.length ? picks.sort((a, b) => (a.species || '').localeCompare(b.species || '') || (a.choice || 1) - (b.choice || 1)).map((l) => {
      const h = hunts.find((x) => x.code === l.hunt_code); const o = oddsText(h?.odds);
      return `<div class="pick-row"><span class="pick-n">${l.choice === 2 ? '2nd' : '1st'}</span><div class="t"><b>${esc(l.hunt_code)} · ${esc(l.species || '')} ${esc(l.class || '')}</b><span class="muted">${esc(h ? `${h.area} · ${h.dates}` : l.zone || '')} · ${esc(o.big)}</span></div>
        <button class="small" data-choice="${l.id}">${l.choice === 2 ? 'Make 1st' : 'Make 2nd'}</button><button class="icon-btn" data-unpick="${l.id}" aria-label="Remove">${icon('x', { size: 16 })}</button></div>`;
    }).join('') : '<p class="muted" style="margin:6px 0 0">Add hunts below. You can pick a 1st and 2nd choice per species, then enter the codes in WILD.</p>'}
    ${picks.length ? `<p class="muted fine">Codes to enter: ${[...new Set(picks.map((l) => l.species))].map((s) => `${esc(s)}: ${picks.filter((l) => l.species === s).sort((a, b) => (a.choice || 1) - (b.choice || 1)).map((l) => l.hunt_code).join(' then ')}`).join(' · ')}</p>` : ''}
  </div>
  <h3 class="sub-h">Find hunts <span class="muted tnum">${hunts.length}</span></h3>
  <div class="sp-filter">${['', ...species].map((s) => `<button class="f-chip" aria-pressed="${ui.sp === s}" data-sp="${esc(s)}">${esc(s || 'All')}</button>`).join('')}</div>
  <div class="grid2" style="margin:8px 0">
    <label>Region <select id="lReg"><option value="">All regions</option>${REGIONS.map(([id, n]) => `<option value="${id}" ${ui.region === id ? 'selected' : ''}>${id} · ${n}</option>`).join('')}</select></label>
    <label>Sort <select id="lSort">${opts([{ id: 'odds', name: 'Best odds' }, { id: 'tags', name: 'Most tags' }, { id: 'code', name: 'Hunt code' }], ui.sort)}</select></label>
    <input id="lQ" class="span2" type="search" placeholder="Search area, MU or class (e.g. 4-24, bull, archery)" value="${esc(ui.q)}">
  </div>
  <label class="switch"><input type="checkbox" id="lMine" ${ui.mine ? 'checked' : ''}><span>Only units I've hunted (${myMus().size})</span></label>
  <div id="lList"></div>`;
  const draw = () => {
    const q = ui.q.toLowerCase(); const mine = myMus();
    let list = hunts.filter((h) => (!ui.sp || h.sp === ui.sp) && (!ui.region || h.rn === ui.region) && (!ui.mine || h.mus.some((m) => mine.has(m)))
      && (!q || [h.code, h.area, h.mu, h.mus.join(' '), h.class, h.tag, h.sp].join(' ').toLowerCase().includes(q)));
    list.sort(ui.sort === 'odds' ? (a, b) => (a.odds ?? 1e9) - (b.odds ?? 1e9) : ui.sort === 'tags' ? (a, b) => b.auth - a.auth : (a, b) => a.code.localeCompare(b.code));
    const shown = list.slice(0, ui.limit);
    body.querySelector('#lList').innerHTML = `<p class="muted fine">${list.length} hunts${list.length > shown.length ? ` · showing ${shown.length}` : ''}</p>${shown.map((h) => huntCard(h)).join('')}
      ${list.length > shown.length ? '<button id="lMore" class="small" style="width:100%">Show more</button>' : ''}${!list.length ? '<div class="empty"><b>No hunts match</b><span class="muted">Try another species or region.</span></div>' : ''}`;
  };
  draw();
  body.querySelector('details.how').addEventListener('toggle', (e) => { if (!e.target.open && !store.prefs.lehHowSeen) db.savePrefs({ lehHowSeen: true }).catch(() => {}); });
  body.querySelector('.sp-filter').onclick = (e) => { const b = e.target.closest('[data-sp]'); if (!b) return; ui.sp = b.dataset.sp; ui.limit = 40; body.querySelectorAll('.sp-filter .f-chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(); };
  body.querySelector('#lReg').onchange = (e) => { ui.region = e.target.value; ui.limit = 40; draw(); };
  body.querySelector('#lSort').onchange = (e) => { ui.sort = e.target.value; draw(); };
  body.querySelector('#lMine').onchange = (e) => { ui.mine = e.target.checked; draw(); };
  body.querySelector('#lQ').oninput = (e) => { ui.q = e.target.value; ui.limit = 40; draw(); };
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
  const mp = e.target.closest('[data-lehmap]')?.dataset.lehmap;
  if (mp) {
    hunts = hunts || (await loadLeh()).hunts; const h = hunts.find((x) => x.code === mp);
    const id = { Moose: 'leh_moose', Elk: 'leh_elk', 'Mule Deer': 'leh_mule_deer', 'White-tailed Deer': 'leh_white_tailed_deer', 'Mountain Goat': 'leh_mountain_goat', 'Mountain Sheep': 'leh_mountain_sheep', Caribou: 'leh_caribou', Bison: 'leh_bison', Turkey: 'leh_turkey', 'Black Bear': 'leh_black_bear' }[h.sp];
    if (id) M.setLayer(id, true);
    const cs = []; const walk = (a) => (typeof a[0] === 'number' ? cs.push(a) : a.forEach(walk));
    for (const f of M.WMU_GEO?.features || []) if (h.mus.includes(f.properties.id)) walk(f.geometry.coordinates);
    if (cs.length) M.fitTo(cs);
    toast(`${h.code}: ${h.sp} LEH zones shown${h.partial || h.zone ? ' (hunt covers only part of the unit; see synopsis map)' : ''}`, 4000);
    if (innerWidth <= 760) (await import('../main.js?v=20261113050808-88c37d4')).closePanel();
  }
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
  body.innerHTML = `<div class="row" style="justify-content:space-between"><span class="muted">Past applications and results (affects your odds)</span><button class="small primary" id="addLeh">${icon('plus', { size: 15 })}Add</button></div>
  ${rows.length ? rows.map((l) => `<div class="wp-row" data-leh="${l.id}"><span class="pick-n">${l.year}</span><div class="t"><b>${esc(l.hunt_code || '—')} · ${esc(l.species || '')} ${esc(l.class || '')}</b><span class="muted">${l.choice === 2 ? '2nd choice' : '1st choice'} · ${l.drawn == null ? 'pending' : l.drawn ? 'DRAWN' : 'not drawn'}</span></div>${icon('chevR', { size: 18 })}</div>`).join('')
    : '<div class="empty"><b>No LEH history</b><span class="muted">Add past applications so you can track wins (winning lowers your odds for that species).</span></div>'}`;
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
  const b = modal(`<h3>${isNew ? 'New LEH application' : 'Edit LEH'}</h3><form class="grid2">
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
