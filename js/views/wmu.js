// iHunter-style WMU detail: every general season in the WMU, Open/Closed for the chosen date, grouped by category.
import { seasonsFor, openRange, fmtMD } from '../seasons.js?v=20261113050808-88c37d4';
import { REGS_URL, BC_WFS, WMU_LAYER, WMU_FIELD } from '../config.js?v=20261113050808-88c37d4';
import { esc, todayISO } from '../util.js?v=20261113050808-88c37d4';
import * as M from '../map.js?v=20261113050808-88c37d4';
import { icon } from '../icons.js?v=20261113050808-88c37d4';

const BIG = /deer|moose|elk|goat|sheep|caribou|bison/i;
const PRED = /bear|cougar|wolf|coyote|lynx|bobcat|wolverine|raccoon|skunk|fox|marten|fisher/i;
export const category = (sp) => (BIG.test(sp) ? 'big' : PRED.test(sp) ? 'pred' : 'bird');
const CATS = [['big', 'Big game', 'deer'], ['pred', 'Bears & predators', 'paw'], ['bird', 'Birds & small game', 'bird']];
let cat = 'big';

let mvText = null;
async function regionClosures(region) {
  if (mvText == null) { try { mvText = await (await fetch('hunt-hq-handoff/data/motor_vehicle_closures_synopsis_text.md')).text(); } catch { mvText = ''; } }
  const parts = mvText.split(/^## /m).slice(1);
  const p = parts.find((s) => s.split('\n')[0].toLowerCase().includes(region.toLowerCase()));
  return p ? (p.match(/```\n([\s\S]*?)```/) || [])[1] || '' : '';
}

// Concrete current-or-next occurrence of a range relative to iso date.
function occurrence(r, iso) {
  if (r[0].length === 10) return [r[0], r[1]];
  const y = +iso.slice(0, 4), md = iso.slice(5); const wrap = r[0] > r[1];
  let start = wrap && md <= r[1] ? y - 1 : y;
  let end = wrap ? start + 1 : start;
  if (`${end}-${r[1]}` < iso) { start++; end++; }
  return [`${start}-${r[0]}`, `${end}-${r[1]}`];
}
const fmtFull = (s) => fmtMD(s);

// Footnote text from the synopsis (hunt-hq-handoff/data/season_notes.json, built by scripts/build_season_notes.py).
let NOTES = null;
const loadNotes = () => NOTES || (NOTES = fetch('hunt-hq-handoff/data/season_notes.json').then((r) => r.json()).catch(() => ({ notes: {}, rows: {} })));
// MUs named in a note: "MU 7-43", "MUs 4-2, 4-20 to 4-22 and 4-40", "M.U.s 2-5 and 2-12".
function musIn(text) {
  const out = new Set();
  for (const m of text.matchAll(/(\d)-(\d{1,2})(?:\s*(?:to|-|–)\s*(\d)-(\d{1,2}))?/g)) {
    if (m[3] && m[3] === m[1]) for (let i = +m[2]; i <= +m[4]; i++) out.add(`${m[1]}-${i}`); else out.add(`${m[1]}-${+m[2]}`);
  }
  return out;
}
function restrictions(r, mu, notes) {
  const list = notes.notes[notes.rows[`${r.p}|${r.sp}`]] || [];
  const here = [], other = [], general = [];
  for (const n of list) { const m = musIn(n); (m.size ? (m.has(mu) ? here : other) : general).push(n); }
  const li = (a) => a.map((n) => `<li>${esc(n)}</li>`).join('');
  let head;
  if (here.length) head = `<div class="r-here"><b>For WMU ${esc(mu)}:</b><ul>${li(here)}</ul>${here.length > 1 ? `<div class="muted fine">These notes belong to different seasons in the table. Check synopsis p.${r.p} for which one matches this season.</div>` : ''}</div>`;
  else if (r.n && other.length) head = `<div class="r-ok">No part-of-unit limit for <b>WMU ${esc(mu)}</b>. This season's footnotes only restrict other units (listed below).</div>`;
  else if (r.n) head = `<div class="r-here">This season has a footnote in the synopsis (p.${r.p}). The rules below may apply to it.</div>`;
  else head = `<div class="r-ok">No footnote on this season.</div>`;
  return `${head}${general.length ? `<div class="r-sec">Rules for ${esc(r.sp.replace(/ \(.*\)/, '').toLowerCase())} in ${esc(r.r)}:<ul>${li(general)}</ul></div>` : ''}
    ${other.length ? `<details class="r-other"><summary>Notes for other units (${other.length})</summary><ul>${li(other)}</ul></details>` : ''}`;
}

export async function showWmu(view, mu, { region, date = todayISO(), onBack } = {}) {
  const rows = seasonsFor(mu);
  const notes = await loadNotes();
  // Region as the synopsis tables group it (e.g. 7-45 is in the Peace table though BC data lists it under Omineca).
  const regCount = {}; for (const r of rows) regCount[r.r] = (regCount[r.r] || 0) + 1;
  region = Object.entries(regCount).sort((a, b) => b[1] - a[1])[0]?.[0] || region || '';
  const counts = Object.fromEntries(CATS.map(([k]) => [k, rows.filter((r) => category(r.sp) === k)]));
  if (!counts[cat].length) cat = CATS.find(([k]) => counts[k].length)?.[0] || 'big';
  const openNow = rows.filter((r) => openRange(r, date)).length;
  view.innerHTML = `<div class="wmu-head">
    <div class="row" style="justify-content:space-between"><button class="small" id="wBack">${icon('chevL', { size: 16 })}Back</button>
      <div class="row"><button class="small" id="wHide">${icon(M.wmuHidden(mu) ? 'eye' : 'eyeOff', { size: 16 })}${M.wmuHidden(mu) ? 'Show on map' : 'Hide on map'}</button>
      <button class="small primary" id="wJump">${icon('pin', { size: 16 })}Jump to boundary</button></div></div>
    <h2>WMU ${esc(mu)}</h2><div class="muted">${esc(region)} · ${openNow} season${openNow === 1 ? '' : 's'} open${date === todayISO() ? ' today' : ''}</div>
    <label style="margin-top:8px;max-width:220px">Date <input type="date" id="wDate" value="${date}"></label></div>
  <div class="cat-tabs" role="tablist">${CATS.map(([k, n, ic]) => `<button role="tab" data-cat="${k}" class="${k === cat ? 'active' : ''}" aria-selected="${k === cat}">${icon(ic, { size: 22 })}<span>${n}</span><span class="n tnum">${counts[k].length}</span></button>`).join('')}</div>
  <div id="wList"></div>
  <details class="card leh-here"><summary><b>LEH draw hunts in this unit</b> <span class="muted" id="wLehN"></span></summary><div id="wLeh"><p class="muted">Loading…</p></div></details>
  <details class="card"><summary><b>Motor vehicle closures in ${esc(region || 'this region')}</b> <span class="muted">(synopsis text)</span></summary><pre id="wMv" class="mv-text">Loading…</pre>
  <p class="muted">Tap the map to see if a mapped closure (MVPR layer) covers a spot.</p></details>
  <div class="notice">General open seasons only (LEH hunts not listed). Verify in the 2026–2028 synopsis and <a href="${REGS_URL}" target="_blank" rel="noopener">in-season changes</a>.</div>`;
  const draw = () => {
    const d = view.querySelector('#wDate').value || todayISO();
    const list = counts[cat].slice().sort((a, b) => a.sp.localeCompare(b.sp) || a.d[0][0].localeCompare(b.d[0][0]));
    view.querySelector('#wList').innerHTML = list.length ? list.map((r, i) => {
      const on = openRange(r, d);
      const ranges = r.d.filter((x) => x[0].length !== 10 || occurrence(x, d)[1] >= d).slice(0, 2);
      return `<div class="season">
        <div class="s-main"><div class="s-sp">${esc(r.sp)}</div>${r.c ? `<div>${esc(r.c)}</div>` : ''}${r.b ? `<div class="muted">Limit: ${esc(r.b)}</div>` : ''}${r.q ? `<div><b>${esc(r.q)}</b></div>` : ''}</div>
        <div class="s-when"><div class="status ${on ? 'ok' : 'err'}">${on ? 'Open' : 'Closed'}</div>${(ranges.length ? ranges : r.d.slice(-1)).map((x) => { const o = occurrence(x, d); return `<div class="muted">${fmtFull(o[0])} –<br>${fmtFull(o[1])}</div>`; }).join('')}</div>
        <details class="s-more"><summary>View restrictions</summary>
          ${restrictions(r, mu, notes)}
          ${!r.c && BIG.test(r.sp) ? '<div class="notice">Class not captured from the PDF — check the synopsis table.</div>' : ''}
          <div class="muted fine">${esc(r.r)} table, synopsis page ${r.p}. Same season covers ${r.mu.length} MUs.${r.b ? '' : ' Bag limit: see regional bag limits.'}</div>
        </details></div>`;
    }).join('') : '<p class="muted">No general seasons for this category in this WMU.</p>';
  };
  draw();
  view.querySelector('#wDate').onchange = draw;
  view.querySelector('.cat-tabs').onclick = (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; cat = b.dataset.cat; view.querySelectorAll('.cat-tabs button').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-selected', String(x === b)); }); draw(); };
  view.querySelector('#wHide').onclick = () => { M.toggleWmu(mu, M.wmuHidden(mu)); showWmu(view, mu, { region, date: view.querySelector('#wDate').value, onBack }); };
  view.querySelector('#wBack').onclick = () => onBack?.();
  view.querySelector('#wJump').onclick = () => outline(mu, true);
  M.selectWmu(mu); outline(mu, false);
  import('./tags.js?v=20261113050808-88c37d4').then(async (T) => {
    const hs = await T.lehForMu(mu); const el = view.querySelector('#wLeh'); if (!el) return;
    view.querySelector('#wLehN').textContent = `· ${hs.length}`;
    el.innerHTML = hs.length ? `<p class="muted fine">Odds are last year's first-choice odds. Apply by June 23, 2026 on WILD.</p>${hs.map((h) => T.huntCard(h)).join('')}` : '<p class="muted">No LEH hunts list this unit.</p>';
    el.onclick = (e) => T.handleLehClick(e);
  });
  regionClosures(region).then((t) => { const el = view.querySelector('#wMv'); if (el) el.textContent = t || 'Not found — see the synopsis.'; });
}

export async function outline(mu, fit) {
  try {
    const p = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeName: 'pub:' + WMU_LAYER, outputFormat: 'application/json', srsName: 'EPSG:4326', CQL_FILTER: `${WMU_FIELD}='${mu}'` });
    const j = await (await fetch(`${BC_WFS}?${p}`)).json();
    M.setSelection(j);
    if (fit) { const cs = []; const walk = (a) => (typeof a[0] === 'number' ? cs.push(a) : a.forEach(walk)); j.features.forEach((f) => walk(f.geometry.coordinates)); M.fitTo(cs); }
  } catch (e) { console.warn('WMU outline failed', e); }
}
