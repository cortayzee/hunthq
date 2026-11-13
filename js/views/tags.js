import * as db from '../db.js?v=20261113044037-e97d428';
import { store, hunters } from '../db.js?v=20261113044037-e97d428';
import { esc, opts, modal, closeModal, toast, formData, num, parseCSV } from '../util.js?v=20261113044037-e97d428';
import { hunterDatalist, speciesDatalist } from './log.js?v=20261113044037-e97d428';
import { allRegions } from '../seasons.js?v=20261113044037-e97d428';

const yr = new Date().getFullYear();
let year = String(yr);

export function render(v) {
  const years = [...new Set([yr, yr + 1, ...store.tags.map((t) => t.year), ...store.leh.map((l) => l.year)])].sort((a, b) => b - a);
  const tags = store.tags.filter((t) => !year || String(t.year) === year);
  const leh = store.leh.filter((t) => !year || String(t.year) === year);
  const cost = tags.reduce((a, t) => a + (+t.cost || 0), 0);
  v.innerHTML = `<h2>Tags &amp; LEH</h2>
  <label>Year <select id="tyear"><option value="">All years</option>${opts(years.map(String), year)}</select></label>
  <div class="card"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Tags</h3><button class="small primary" id="addTag">＋ Tag</button></div>
  <p class="muted">${tags.length} tags · $${cost.toFixed(2)} · ${tags.filter((t) => t.filled).length} filled</p>
  <table><thead><tr><th>Year</th><th>Species</th><th>Type</th><th>Hunter</th><th>$</th><th>Filled</th><th></th></tr></thead><tbody>
  ${tags.map((t) => `<tr><td>${t.year}</td><td>${esc(t.species)}${t.wmu ? `<div class="muted">${esc(t.wmu)}</div>` : ''}</td><td>${esc(t.tag_type || '')}</td><td>${esc(t.hunter || '')}</td><td>${t.cost ?? ''}</td>
  <td><input type="checkbox" data-fill="${t.id}" ${t.filled ? 'checked' : ''}></td><td><button class="small" data-tag="${t.id}">Edit</button></td></tr>`).join('')}</tbody></table></div>
  <div class="card"><div class="row" style="justify-content:space-between"><h3 style="margin:0">LEH applications</h3><button class="small primary" id="addLeh">＋ LEH</button></div>
  <p class="muted">${leh.length} applications · ${leh.filter((l) => l.drawn).length} drawn</p>
  <table><thead><tr><th>Year</th><th>Hunt code</th><th>Species / zone</th><th>Hunter</th><th>Drawn</th><th></th></tr></thead><tbody>
  ${leh.map((l) => `<tr><td>${l.year}</td><td>${esc(l.hunt_code || '')}</td><td>${esc(l.species || '')}<div class="muted">${esc([l.zone, l.class].filter(Boolean).join(' · '))}</div></td><td>${esc(l.hunter || '')}</td>
  <td>${l.drawn == null ? '<span class="chip">pending</span>' : l.drawn ? '<span class="chip ok">yes</span>' : '<span class="chip bad">no</span>'}</td><td><button class="small" data-leh="${l.id}">Edit</button></td></tr>`).join('')}</tbody></table></div>
  <div class="card"><h3 style="margin-top:0">LEH advisor</h3><div id="advisor"></div></div>`;
  v.querySelector('#tyear').onchange = (e) => { year = e.target.value; render(v); };
  v.querySelector('#addTag').onclick = () => tagForm({ year: +year || yr });
  v.querySelector('#addLeh').onclick = () => lehForm({ year: +year || yr });
  v.onclick = (e) => {
    const t = e.target.dataset;
    if (t.tag) tagForm(store.tags.find((x) => x.id === t.tag));
    if (t.leh) lehForm(store.leh.find((x) => x.id === t.leh));
  };
  v.onchange = async (e) => { const id = e.target.dataset.fill; if (id) await db.update('tags', id, { filled: e.target.checked }); };
  advisor(v.querySelector('#advisor'));
  render.v = v;
}
export function onData(w) { if (['tags', 'leh', 'all'].includes(w) && render.v?.isConnected) render(render.v); }

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

// ---- LEH advisor ----
// Draw report CSV (catalogue.data.gov.bc.ca "LEH Draw Hunt Code Report"): columns are auto-detected by keyword
// and can be re-mapped. Stored compactly in hunt_prefs.data.lehReport.
const FIELDS = {
  code: /hunt.?code|^code/i, species: /species/i, region: /region/i, zone: /zone|mu|management unit/i, cls: /class|sex|description/i,
  weapon: /weapon|method|bow/i, auth: /authori|tags|permits|licen|#.*avail|available|quota/i, apps: /applica|applicants|entries/i,
  harvest: /harvest|kill|success/i, year: /year/i, season: /season|date/i,
};
function detect(headers) {
  const m = {};
  for (const [k, re] of Object.entries(FIELDS)) m[k] = headers.find((h) => re.test(h) && !Object.values(m).includes(h)) || '';
  return m;
}
function advisor(el) {
  const rep = store.prefs.lehReport; const goals = store.prefs.lehGoals || { species: [], regions: [], weapon: '', weight: 0.6 };
  const spList = rep ? [...new Set(rep.rows.map((r) => r.species).filter(Boolean))].sort() : [];
  const regs = rep ? [...new Set(rep.rows.map((r) => r.region).filter(Boolean))].sort() : allRegions();
  el.innerHTML = `<p class="muted">Import the BC “LEH Draw Hunt Code Report” CSV, set your goals, get ranked hunt codes.</p>
  <div class="row"><input type="file" id="lehCsv" accept=".csv,.txt,text/csv"> ${rep ? `<span class="muted">${rep.rows.length} hunt codes loaded${rep.name ? ' from ' + esc(rep.name) : ''}</span>` : ''}</div>
  <div class="grid2" style="margin-top:8px">
    <label>Species <select id="gSp" multiple size="4">${opts(spList, null)}</select></label>
    <label>Regions <select id="gReg" multiple size="4">${opts(regs, null)}</select></label>
    <label>Weapon <select id="gW">${opts([{ id: '', name: 'Any' }, { id: 'bow', name: 'Bow only hunts' }, { id: 'nobow', name: 'Exclude bow-only' }], goals.weapon)}</select></label>
    <label>Odds ⟷ Quality <input type="range" id="gWt" min="0" max="1" step="0.05" value="${goals.weight}"><span class="muted">left = harvest quality, right = draw odds</span></label>
  </div><div class="row"><button id="gSave" class="primary">Rank hunts</button></div><div id="gOut"></div>`;
  for (const o of el.querySelectorAll('#gSp option')) o.selected = goals.species.includes(o.value);
  for (const o of el.querySelectorAll('#gReg option')) o.selected = goals.regions.includes(o.value);
  el.querySelector('#lehCsv').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const rows = parseCSV(await file.text()); if (!rows.length) return toast('No rows in CSV');
    mapColumns(Object.keys(rows[0]), async (m) => {
      const pick = (r, k) => (m[k] ? r[m[k]] : '');
      const n = (x) => { const v = parseFloat(String(x).replace(/[,%$]/g, '')); return isNaN(v) ? null : v; };
      const out = rows.map((r) => ({ code: pick(r, 'code'), species: pick(r, 'species'), region: pick(r, 'region'), zone: pick(r, 'zone'), cls: pick(r, 'cls'), weapon: pick(r, 'weapon'), season: pick(r, 'season'),
        year: pick(r, 'year'), auth: n(pick(r, 'auth')), apps: n(pick(r, 'apps')), harvest: n(pick(r, 'harvest')) })).filter((r) => r.code || r.zone);
      await db.savePrefs({ lehReport: { name: file.name, imported: new Date().toISOString(), map: m, rows: out } });
      toast(`Loaded ${out.length} hunt codes`); advisor(el);
    });
  };
  el.querySelector('#gSave').onclick = async () => {
    const g = { species: [...el.querySelector('#gSp').selectedOptions].map((o) => o.value), regions: [...el.querySelector('#gReg').selectedOptions].map((o) => o.value), weapon: el.querySelector('#gW').value, weight: +el.querySelector('#gWt').value };
    await db.savePrefs({ lehGoals: g }).catch(() => {});
    el.querySelector('#gOut').innerHTML = rank(g);
  };
  if (rep) el.querySelector('#gOut').innerHTML = rank(goals);
}
function mapColumns(headers, done) {
  const m = detect(headers);
  const b = modal(`<h3>Map draw-report columns</h3><p class="muted">Auto-detected; fix any that are wrong. “Harvest” can be harvest success % or harvest count.</p>
  <div class="grid2">${Object.keys(FIELDS).map((k) => `<label>${k} <select data-k="${k}"><option value=""></option>${opts(headers, m[k])}</select></label>`).join('')}</div>
  <div class="row" style="margin-top:10px"><button class="primary" id="mOk">Import</button></div>`);
  b.querySelector('#mOk').onclick = () => { b.querySelectorAll('[data-k]').forEach((s) => (m[s.dataset.k] = s.value)); closeModal(); done(m); };
}
function rank(g) {
  const rep = store.prefs.lehReport; if (!rep) return '';
  // Keep the latest year per hunt code
  const latest = new Map(); for (const r of rep.rows) { const k = r.code || r.zone; if (!latest.has(k) || String(r.year) > String(latest.get(k).year)) latest.set(k, r); }
  let rows = [...latest.values()].filter((r) => (!g.species.length || g.species.includes(r.species)) && (!g.regions.length || g.regions.includes(r.region)));
  const isBow = (r) => /bow|archery/i.test([r.weapon, r.cls, r.season].join(' '));
  if (g.weapon === 'bow') rows = rows.filter(isBow); if (g.weapon === 'nobow') rows = rows.filter((r) => !isBow(r));
  rows.forEach((r) => {
    r.odds = r.auth != null && r.apps ? Math.min(1, r.auth / r.apps) : null;
    r.qual = r.harvest == null ? null : r.harvest > 1 ? (r.auth ? Math.min(1, r.harvest / r.auth) : r.harvest / 100) : r.harvest;
  });
  const mine = store.leh; // personal history bonus: codes drawn before are flagged
  rows.forEach((r) => { const o = r.odds ?? 0, q = r.qual ?? 0.3; r.score = g.weight * o + (1 - g.weight) * q; r.past = mine.filter((l) => l.hunt_code && l.hunt_code === r.code); });
  rows.sort((a, b) => b.score - a.score);
  const pct = (x) => (x == null ? '—' : (x * 100).toFixed(1) + '%');
  return `<p class="muted">${rows.length} matching hunt codes. Score = ${Math.round(g.weight * 100)}% draw odds + ${Math.round((1 - g.weight) * 100)}% harvest quality. Odds = authorizations ÷ applications (latest year); BC's draw weighting isn't modelled.</p>
  <div class="scroll-x"><table><thead><tr><th>#</th><th>Code</th><th>Species / zone</th><th>Odds</th><th>Quality</th><th>Score</th></tr></thead><tbody>
  ${rows.slice(0, 40).map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.code)}</td><td>${esc(r.species)} <span class="muted">${esc([r.region, r.zone, r.cls].filter(Boolean).join(' · '))}</span>${r.past.length ? `<div class="chip">applied ${r.past.map((p) => p.year + (p.drawn ? '✓' : '')).join(', ')}</div>` : ''}</td>
  <td>${pct(r.odds)}<div class="muted">${r.auth ?? '?'}/${r.apps ?? '?'}</div></td><td>${pct(r.qual)}</td><td><b>${(r.score * 100).toFixed(0)}</b></td></tr>`).join('')}</tbody></table></div>`;
}
