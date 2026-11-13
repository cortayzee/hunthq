import * as M from '../map.js?v=20261113055324-718ddfe';
import { esc } from '../util.js?v=20261113055324-718ddfe';
import { icon } from '../icons.js?v=20261113055324-718ddfe';
import { saveMapPrefs, showTabPublic } from '../main.js?v=20261113055324-718ddfe';
import { muSort } from '../seasons.js?v=20261113055324-718ddfe';
import { store } from '../db.js?v=20261113055324-718ddfe';
import * as W from '../wildlife.js?v=20261113055324-718ddfe';

// Layers panel: "On now" chips, then collapsible sections. A row is swatch + name + switch; opacity only for layers that are on.
const SECTIONS = [
  ['Boundaries', 'Boundaries', 'Wildlife management units and zones'],
  ['Access', 'Access & closures', 'Motor vehicle, ATV and snowmobile restrictions'],
  ['LEH', 'LEH zones', 'Limited-entry hunting zones, current year'],
  ['Land', 'Land', 'Parks, reserves and private land'],
  ['Custom', 'Custom layers', 'Layers you added in More'],
];
const REGION_ORDER = ['Vancouver Island', 'Lower Mainland', 'Thompson', 'Kootenay', 'Cariboo', 'Skeena', 'Omineca', 'Peace', 'Okanagan'];
const OPEN_KEY = 'hunthq_lyr_open';
const open = (() => { try { return new Set(JSON.parse(localStorage.getItem(OPEN_KEY)) || ['Boundaries']); } catch { return new Set(['Boundaries']); } })();
const saveOpen = () => { try { localStorage.setItem(OPEN_KEY, JSON.stringify([...open])); } catch {} };
const shortName = (l) => l.name.replace(/^LEH zones – /, '').replace(/^MVHCA – motor vehicle hunting closed$/, 'MVHCA (hunting closed)').replace(/ \(ParcelMap BC, zoom 12\+\)$/, '');
const note = (l) => (l.minzoom ? `Shows from zoom ${l.minzoom}` : l.id === 'mv_hca' ? 'Motor vehicles closed for hunting' : l.id === 'wmu' ? 'Numbers + boundaries' : '');

function wmuByRegion() {
  const m = new Map();
  for (const f of M.WMU_GEO?.features || []) { const r = f.properties.r || 'Other'; if (!m.has(r)) m.set(r, []); m.get(r).push(f.properties.id); }
  for (const l of m.values()) l.sort(muSort);
  return [...m].sort((a, b) => (REGION_ORDER.indexOf(a[0]) + 99) % 99 - (REGION_ORDER.indexOf(b[0]) + 99) % 99);
}

export function render(v) {
  v.innerHTML = `<div class="page-h"><h2>Layers</h2></div>
  <input id="lyrSearch" type="search" placeholder="Search layers or a WMU (e.g. 4-24)" style="width:100%" aria-label="Search layers">
  <div id="onNow" class="on-now"></div>
  <div id="lyrSecs"></div>
  <p class="muted fine" style="margin-top:14px">Map type, roads &amp; 3D: the map button on the right. BC layers © Province of BC (OGL-BC).</p>`;
  const q = () => (v.querySelector('#lyrSearch')?.value || '').trim().toLowerCase();

  const drawOnNow = () => {
    const on = M.allLayers().filter((l) => M.layerOn(l.id));
    v.querySelector('#onNow').innerHTML = on.length ? `<span class="muted on-lbl">On now</span>${on.map((l) => `<button class="on-chip" data-off="${l.id}" aria-label="Turn off ${esc(shortName(l))}"><span class="swatch" style="background:${l.color}"></span>${esc(shortName(l))}${icon('x', { size: 14 })}</button>`).join('')}` : '<span class="muted on-lbl">No layers on</span>';
  };
  const row = (l) => { const on = M.layerOn(l.id); return `<div class="lyr-row ${on ? 'on' : ''}">
      <label class="lyr-main"><span class="swatch" style="background:${l.color || '#888'}"></span><span class="t"><b>${esc(shortName(l))}</b>${note(l) ? `<span class="muted">${esc(note(l))}</span>` : ''}</span>
      <span class="switch"><input type="checkbox" data-l="${l.id}" ${on ? 'checked' : ''} aria-label="${esc(shortName(l))}"></span></label>
      ${on ? `<div class="lyr-op"><span class="muted">Opacity</span><input type="range" min="0.15" max="1" step="0.05" value="${M.layerOpacity(l.id)}" data-o="${l.id}" aria-label="${esc(shortName(l))} opacity"></div>` : ''}</div>`; };
  const sec = (id, title, sub, body, count) => `<details class="lyr-sec" data-sec="${id}" ${open.has(id) || q() ? 'open' : ''}><summary>
      <span class="t"><b>${title}</b><span class="muted">${sub}</span></span>${count ? `<span class="badge">${count} on</span>` : ''}${icon('chevR', { size: 18, cls: 'fold-chev' })}</summary><div class="lyr-body">${body}</div></details>`;

  const draw = () => {
    const s = q();
    const ls = M.allLayers().filter((l) => !s || (l.name + ' ' + l.group).toLowerCase().includes(s));
    let html = SECTIONS.map(([g, title, sub]) => {
      const items = ls.filter((l) => (l.group || 'Custom') === g).sort((a, b) => (a.id === 'wmu' ? -1 : b.id === 'wmu' ? 1 : shortName(a).localeCompare(shortName(b))));
      return items.length ? sec(g, title, sub, items.map(row).join(''), items.filter((l) => M.layerOn(l.id)).length) : '';
    }).join('');
    // Wildlife & harvest
    if (!s || /wild|harvest|grizz|density|success|survey/.test(s)) {
      const st = W.state; const on = (st.sp && st.metric ? 1 : 0) + (st.griz ? 1 : 0) + (st.surv ? 1 : 0);
      html += sec('Wildlife', 'Wildlife & harvest', 'Where animals are taken, success rates, grizzly density', `
        <div class="grid2" style="margin:8px 0 4px">
          <label>Species <select id="wSp"><option value="">Off</option>${['Moose', 'Elk', 'Mule Deer', 'White-tailed Deer', 'Black Bear', 'Mountain Goat', 'Mountain Sheep', 'Caribou', 'Cougar', 'Wolf', 'Turkey'].map((x) => `<option ${st.sp === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          <label>Show <select id="wMet">${Object.entries(W.METRICS).map(([k, m]) => `<option value="${k}" ${(st.metric || 'kpa') === k ? 'selected' : ''}>${m.name}</option>`).join('')}</select></label>
        </div>
        <div id="wLegend" class="w-legend"></div>
        <div class="lyr-row"><label class="lyr-main"><span class="swatch" style="background:#a0612f"></span><span class="t"><b>Grizzly density (2018)</b><span class="muted">Bears per 1,000 km², by population unit</span></span>
          <span class="switch"><input type="checkbox" id="wGriz" ${st.griz ? 'checked' : ''}></span></label></div>
        <div class="lyr-row"><label class="lyr-main"><span class="swatch" style="background:#7b3fb5"></span><span class="t"><b>Aerial survey densities</b><span class="muted">Moose, goat, mule deer counts per km² (22 areas)</span></span>
          <span class="switch"><input type="checkbox" id="wSurv" ${st.surv ? 'checked' : ''}></span></label></div>
        <p class="muted fine">Harvest data: BC resident Hunter Sample survey, 5-year average. It measures hunting results, not a census: a high number means animals AND hunters. Tap a unit to see its numbers.</p>`, on);
    }
    // Unit visibility
    const groups = wmuByRegion(); const hiddenN = M.getState().hiddenWmu.length;
    const regions = groups.map(([r, mus]) => {
      const list = s ? mus.filter((m) => m.includes(s) || r.toLowerCase().includes(s)) : mus; if (!list.length) return '';
      const hidden = list.filter((m) => M.wmuHidden(m)).length;
      return `<details class="region" data-r="${esc(r)}" ${s || drawOpenR.has(r) ? 'open' : ''}><summary>${icon('chevR', { size: 16 })}<span class="name">${esc(r)}</span>
        <span class="muted tnum">${list.length - hidden}/${list.length}</span><button class="small" data-region-all="${esc(r)}" data-show="${hidden ? 1 : 0}">${hidden ? 'Show all' : 'Hide all'}</button></summary>
        <div class="wmu-chips">${list.map((m) => `<button class="wmu-chip" data-mu="${m}" aria-pressed="${!M.wmuHidden(m)}">${m}</button>`).join('')}</div></details>`;
    }).join('');
    if (!s || regions) html += sec('Units', 'Unit visibility', hiddenN ? `${hiddenN} unit${hiddenN > 1 ? 's' : ''} hidden` : 'Hide or show individual WMUs',
      groups.length ? `<div class="row" style="justify-content:space-between;margin:4px 0 6px"><span class="muted fine" style="margin:0">Tap a number to hide or show it.</span>${hiddenN ? '<button class="small" id="wmuAll">Show all units</button>' : ''}</div>${regions}` : '<p class="muted">Loading units…</p>', 0);
    if (!s) html += sec('Mine', 'My waypoints & routes', `${store.spots.length} waypoints · ${store.tracks.length} routes`,
      `<p class="muted fine" style="margin:2px 0 8px">Hide or show by type, hunt, group, year or hunter on the Waypoints page.</p><button class="small" id="goWp">${icon('pin', { size: 16 })}Open Waypoints</button>`, 0);
    v.querySelector('#lyrSecs').innerHTML = html || '<p class="muted">No layer matches.</p>';
    drawOnNow();
    if (!groups.length) setTimeout(() => v.isConnected && draw(), 700);
  };
  const drawOpenR = render.openR || (render.openR = new Set());

  draw();
  v.querySelector('#lyrSearch').oninput = draw;
  // one listener per panel element (renders reuse #view); ignore toggles when another view is showing
  if (!v._lyrToggle) v._lyrToggle = true, v.addEventListener('toggle', (e) => {
    if (!v.querySelector('#lyrSearch')) return;
    const t = e.target; if (q()) return;
    if (t.dataset?.sec) { t.open ? open.add(t.dataset.sec) : open.delete(t.dataset.sec); saveOpen(); }
    if (t.dataset?.r) t.open ? drawOpenR.add(t.dataset.r) : drawOpenR.delete(t.dataset.r);
  }, true);
  const legend = async () => {
    const el = v.querySelector('#wLegend'); if (!el) return;
    const sp = v.querySelector('#wSp').value, mt = v.querySelector('#wMet').value;
    const r = await W.setChoropleth(sp, mt);
    if (!r || !r.breaks.length) { el.innerHTML = ''; return; }
    const m = W.METRICS[mt]; const lab = ['Lowest', ...r.breaks.map((b) => (b >= 10 ? Math.round(b) : b))];
    el.innerHTML = `<div class="w-ramp">${r.ramp.map((c, i) => `<span style="background:${c}"></span>`).join('')}</div>
      <div class="w-ticks">${lab.map((x, i) => `<span>${i ? (m.invert ? '≤' : '≥') + x : ''}</span>`).join('')}</div>
      <p class="muted fine" style="margin:4px 0 0">${esc(sp)}: ${esc(m.name.toLowerCase())} (${esc(m.unit)}), ${r.years[0]}–${r.years[1]} average. ${esc(m.help)}</p>`;
  };
  v.onchange = (e) => {
    const t = e.target;
    if (t.id === 'wSp' || t.id === 'wMet') { legend(); return; }
    if (t.id === 'wGriz') { W.setGrizzly(t.checked); return; }
    if (t.id === 'wSurv') { W.setSurveys(t.checked); return; }
    const id = t.dataset.l; if (id) { M.setLayer(id, t.checked); saveMapPrefs(); draw(); }
  };
  legend();
  v.oninput = (e) => { if (e.target.dataset.o) { M.setOpacity(e.target.dataset.o, +e.target.value); saveMapPrefs(); } };
  v.onclick = (e) => {
    const off = e.target.closest('[data-off]'); if (off) { M.setLayer(off.dataset.off, false); saveMapPrefs(); draw(); return; }
    if (e.target.closest('#goWp')) { showTabPublic('log'); return; }
    if (e.target.closest('#wmuAll')) { M.setWmuHidden([]); if (!M.layerOn('wmu')) M.setLayer('wmu', true); saveMapPrefs(); draw(); return; }
    const chip = e.target.closest('[data-mu]');
    if (chip) {
      const show = chip.getAttribute('aria-pressed') !== 'true';
      M.toggleWmu(chip.dataset.mu, show); chip.setAttribute('aria-pressed', String(show));
      if (show && !M.layerOn('wmu')) M.setLayer('wmu', true);
      const d = chip.closest('details'); const all = d.querySelectorAll('.wmu-chip'); const on = d.querySelectorAll('.wmu-chip[aria-pressed=true]').length;
      d.querySelector('.tnum').textContent = `${on}/${all.length}`;
      const btn = d.querySelector('[data-region-all]'); btn.dataset.show = on < all.length ? 1 : 0; btn.textContent = on < all.length ? 'Show all' : 'Hide all';
      saveMapPrefs(); return;
    }
    const rb = e.target.closest('[data-region-all]');
    if (rb) {
      e.preventDefault();
      const mus = wmuByRegion().find(([r]) => r === rb.dataset.regionAll)?.[1] || [];
      const hid = new Set(M.getState().hiddenWmu);
      if (rb.dataset.show === '1') mus.forEach((m) => hid.delete(m)); else mus.forEach((m) => hid.add(m));
      M.setWmuHidden([...hid]); drawOpenR.add(rb.dataset.regionAll); saveMapPrefs(); draw();
    }
  };
}
