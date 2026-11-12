import { SEASONS, allGroups, allRegions, openOn, openRange, fmtRange, outsideSynopsis, normMU, muSort } from '../seasons.js';
import * as M from '../map.js';
import { REGS_URL } from '../config.js';
import { esc, opts } from '../util.js';
import { app } from '../main.js';

const f = { group: '', qual: 'general', mu: '', region: '', shade: true };

export function render(v) {
  v.innerHTML = `<h2>What's open</h2>
  <div class="grid2">
    <label>Date <input type="date" id="oDate" value="${app.date}"></label>
    <label>Species <select id="oSp"><option value="">All species</option>${opts(allGroups(), f.group)}</select></label>
    <label>Who <select id="oQual">${opts([{ id: 'general', name: 'Adult (no youth/senior-only)' }, { id: 'nobow', name: 'Rifle seasons only' }, { id: 'all', name: 'Everything incl. youth' }], f.qual)}</select></label>
    <label>Region <select id="oReg"><option value="">All regions</option>${opts(allRegions(), f.region)}</select></label>
    <label>WMU <input id="oMu" placeholder="e.g. 3-15" value="${esc(f.mu)}"></label>
    <label style="align-self:end"><input type="checkbox" id="oShade" ${f.shade ? 'checked' : ''}> Shade open WMUs on map</label>
  </div>
  <div id="oNote"></div>
  <div id="oOut"></div>
  <div class="notice">General open seasons parsed from the 2026–2028 synopsis. LEH-only seasons are not included. Footnoted rows (yellow on map) have conditions: check the synopsis page shown. Always verify in the synopsis and <a href="${REGS_URL}" target="_blank" rel="noopener">in-season changes</a>.</div>`;
  const run = () => {
    app.date = v.querySelector('#oDate').value || app.date;
    Object.assign(f, { group: v.querySelector('#oSp').value, qual: v.querySelector('#oQual').value, mu: normMU(v.querySelector('#oMu').value), region: v.querySelector('#oReg').value, shade: v.querySelector('#oShade').checked });
    const rows = openOn(app.date, { group: f.group, mu: f.mu, qual: f.qual }).filter((r) => !f.region || r.r === f.region);
    v.querySelector('#oNote').innerHTML = outsideSynopsis(app.date) ? '<div class="notice">This date is outside the 2026–2028 synopsis (Jul 1 2026 – Jun 30 2028). Results use the same month/day rules and may be wrong.</div>' : '';
    if (f.shade) M.shadeOpen(rows); else M.clearShade();
    const bySp = new Map(); for (const r of rows) { if (!bySp.has(r.sp)) bySp.set(r.sp, []); bySp.get(r.sp).push(r); }
    const mus = new Set(rows.flatMap((r) => r.mu));
    v.querySelector('#oOut').innerHTML = `<p><b>${rows.length}</b> open season rows · <b>${mus.size}</b> WMUs · ${bySp.size} species</p>` +
      [...bySp].sort((a, b) => a[0].localeCompare(b[0])).map(([sp, rs]) => `<div class="card"><b>${esc(sp)}</b>${rs.map((r) => `
        <div class="season-row"><span class="chip">${esc(r.r)}</span> ${esc([r.c, r.q].filter(Boolean).join(' · ') || 'Any')}
        <span class="muted">${esc(fmtRange(openRange(r, app.date)))}${r.b ? ' · bag ' + esc(r.b) : ''} · p.${r.p}</span>
        ${r.n ? '<span class="chip warn">footnote</span>' : ''}${!r.c && /deer|moose|elk|sheep/i.test(r.sp) ? '<span class="chip warn">class missing – see PDF</span>' : ''}
        <div class="muted" style="font-size:.8em">MUs ${esc(compactMUs(r.mu))}</div></div>`).join('')}</div>`).join('');
  };
  v.querySelectorAll('input,select').forEach((el) => el.addEventListener('change', run));
  v.querySelector('#oMu').addEventListener('input', () => { clearTimeout(run.t); run.t = setTimeout(run, 400); });
  run();
}

// "3-12, 3-13, 3-14" -> "3-12 to 3-14"
export function compactMUs(mus) {
  const s = [...mus].sort(muSort); const out = []; let i = 0;
  while (i < s.length) {
    let j = i; const [r] = s[i].split('-');
    while (j + 1 < s.length && s[j + 1].split('-')[0] === r && +s[j + 1].split('-')[1] === +s[j].split('-')[1] + 1) j++;
    out.push(j - i >= 2 ? `${s[i]} to ${s[j]}` : s.slice(i, j + 1).join(', ')); i = j + 1;
  }
  return out.join(', ');
}
