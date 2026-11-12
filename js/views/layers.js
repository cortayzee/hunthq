import * as M from '../map.js?v=20261112230233-4f3bcaf';
import { KINDS } from '../config.js?v=20261112230233-4f3bcaf';
import { store, hunters } from '../db.js?v=20261112230233-4f3bcaf';
import { esc } from '../util.js?v=20261112230233-4f3bcaf';
import { icon } from '../icons.js?v=20261112230233-4f3bcaf';
import { saveMapPrefs } from '../main.js?v=20261112230233-4f3bcaf';
import { muSort } from '../seasons.js?v=20261112230233-4f3bcaf';
import * as V from '../vis.js?v=20261112230233-4f3bcaf';

const GROUPS = ['Boundaries', 'Access', 'LEH', 'Land', 'Custom'];
const REGION_ORDER = ['Vancouver Island', 'Lower Mainland', 'Thompson', 'Kootenay', 'Cariboo', 'Skeena', 'Omineca', 'Peace', 'Okanagan'];

function wmuByRegion() {
  const feats = M.WMU_GEO?.features || [];
  const m = new Map();
  for (const f of feats) { const r = f.properties.r || 'Other'; if (!m.has(r)) m.set(r, []); m.get(r).push(f.properties.id); }
  for (const l of m.values()) l.sort(muSort);
  return [...m].sort((a, b) => (REGION_ORDER.indexOf(a[0]) + 99) % 99 - (REGION_ORDER.indexOf(b[0]) + 99) % 99 || +a[1][0].split('-')[0] - +b[1][0].split('-')[0]);
}

export function render(v) {
  v.innerHTML = `<h2>Map layers</h2>
  <input id="lyrSearch" type="search" placeholder="Search layers or a WMU (e.g. 4-24)" style="width:100%" aria-label="Search layers">
  <div id="lyrList"></div>
  <div class="section-h"><h3>Wildlife Management Units</h3><div class="row"><button class="small" id="wmuAll">Show all</button></div></div>
  <p class="muted" style="margin:2px 0 6px">Tap a unit number to hide or show it. Numbers appear on the map from province zoom.</p>
  <div id="wmuList"></div>
  <div class="section-h"><h3>My waypoints</h3></div>
  <div id="kindList"></div>
  <label style="margin-top:10px">Hunter <select id="spotHunter"><option value="">All hunters</option>${hunters().map((h) => `<option>${esc(h)}</option>`).join('')}</select></label>
  <p class="muted">${store.spots.length} waypoints · ${store.tracks.length} tracks. Hide by hunt, group or year in Waypoints. Base map, roads &amp; 3D are on the map button at right.</p>
  <p class="muted">BC layers © Province of BC (OGL-BC). Tap the map to see the WMU, seasons and whatever layers are switched on.</p>`;
  const q = () => v.querySelector('#lyrSearch').value.trim().toLowerCase();

  const drawLayers = () => {
    const s = q();
    const ls = M.allLayers().filter((l) => !s || (l.name + ' ' + l.group).toLowerCase().includes(s));
    v.querySelector('#lyrList').innerHTML = GROUPS.map((g) => {
      const items = ls.filter((l) => (l.group || 'Custom') === g).sort((a, b) => (a.id === 'wmu' ? -1 : b.id === 'wmu' ? 1 : a.name.localeCompare(b.name)));
      if (!items.length) return '';
      return `<div class="group-label">${g === 'Access' ? 'Access & closures' : g === 'LEH' ? 'LEH zones (current year)' : g}</div>` + items.map((l) => `
        <div class="layer-item"><label class="switch" style="min-height:0;flex:1"><input type="checkbox" data-l="${l.id}" ${M.layerOn(l.id) ? 'checked' : ''}>
        <span class="swatch" style="background:${l.color || '#888'}"></span><span class="name">${esc(l.name.replace(/^LEH zones – /, ''))}</span></label>
        <input type="range" min="0.15" max="1" step="0.05" value="${M.layerOpacity(l.id)}" data-o="${l.id}" aria-label="${esc(l.name)} opacity" title="Opacity"></div>`).join('');
    }).join('') || '<p class="muted">No layer matches.</p>';
  };

  const drawWmu = () => {
    const s = q(); const groups = wmuByRegion();
    if (!groups.length) { v.querySelector('#wmuList').innerHTML = '<p class="muted">Loading units…</p>'; setTimeout(drawWmu, 600); return; }
    const openSet = drawWmu.open || (drawWmu.open = new Set());
    v.querySelector('#wmuList').innerHTML = groups.map(([r, mus]) => {
      const list = s ? mus.filter((m) => m.includes(s) || r.toLowerCase().includes(s)) : mus;
      if (!list.length) return '';
      const hidden = list.filter((m) => M.wmuHidden(m)).length;
      return `<details class="region" data-r="${esc(r)}" ${s || openSet.has(r) ? 'open' : ''}><summary>${icon('chevR', { size: 16 })}<span class="name">${esc(r)}</span>
        <span class="muted tnum">${list.length - hidden}/${list.length}</span>
        <button class="small" data-region-all="${esc(r)}" data-show="${hidden ? 1 : 0}">${hidden ? 'Show all' : 'Hide all'}</button></summary>
        <div class="wmu-chips">${list.map((m) => `<button class="wmu-chip" data-mu="${m}" aria-pressed="${!M.wmuHidden(m)}">${m}</button>`).join('')}</div></details>`;
    }).join('');
  };

  drawLayers(); drawWmu();
  v.querySelector('#lyrSearch').oninput = () => { drawLayers(); drawWmu(); };
  const list = v.querySelector('#lyrList');
  list.onchange = (e) => { const id = e.target.dataset.l; if (id) { M.setLayer(id, e.target.checked); saveMapPrefs(); } };
  list.oninput = (e) => { if (e.target.dataset.o) { M.setOpacity(e.target.dataset.o, +e.target.value); saveMapPrefs(); } };

  const wl = v.querySelector('#wmuList');
  wl.addEventListener('toggle', (e) => { const r = e.target.dataset?.r; if (r) e.target.open ? drawWmu.open.add(r) : drawWmu.open.delete(r); }, true);
  wl.onclick = (e) => {
    const chip = e.target.closest('[data-mu]');
    if (chip) {
      const show = chip.getAttribute('aria-pressed') !== 'true';
      M.toggleWmu(chip.dataset.mu, show); chip.setAttribute('aria-pressed', String(show));
      if (show && !M.layerOn('wmu')) { M.setLayer('wmu', true); drawLayers(); }
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
      M.setWmuHidden([...hid]); drawWmu.open.add(rb.dataset.regionAll); drawWmu(); saveMapPrefs();
    }
  };
  v.querySelector('#wmuAll').onclick = () => { M.setWmuHidden([]); if (!M.layerOn('wmu')) M.setLayer('wmu', true); drawLayers(); drawWmu(); saveMapPrefs(); };

  const kl = v.querySelector('#kindList');
  kl.innerHTML = KINDS.map((k) => `<div class="layer-item"><label class="switch" style="min-height:0;flex:1"><input type="checkbox" data-k="${k.id}" ${V.shown('kinds', k.id) ? 'checked' : ''}>
    <span class="swatch" style="background:${k.color};border-radius:50%"></span><span class="name">${k.name}</span></label><span class="muted tnum">${store.spots.filter((s) => s.kind === k.id).length}</span></div>`).join('');
  kl.onchange = (e) => { const k = e.target.dataset.k; if (k) V.setShown('kinds', k, e.target.checked); };
  v.querySelector('#spotHunter').onchange = (e) => { for (const h of hunters()) V.setShown('hunters', h, !e.target.value || e.target.value === h); };
}
