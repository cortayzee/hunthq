import * as M from '../map.js';
import { KINDS } from '../config.js';
import { store, hunters } from '../db.js';
import { esc } from '../util.js';
import { saveMapPrefs } from '../main.js';

const shown = { kinds: new Set(KINDS.map((k) => k.id)), hunter: '' };

export function render(v) {
  v.innerHTML = `<h2>Map layers</h2>
  <input id="lyrSearch" placeholder="Search layers…" style="width:100%">
  <div id="lyrList"></div>
  <p class="muted">BC layers © Province of BC (openmaps WMS). Tap the map to identify the WMU, LEH zone, closures, parks and what's open there.</p>
  <h3>My waypoints</h3>
  <div id="kindList"></div>
  <label style="margin-top:8px">Hunter <select id="spotHunter"><option value="">All hunters</option>${hunters().map((h) => `<option ${h === shown.hunter ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>
  <p class="muted">${store.spots.length} waypoints · ${store.tracks.length} tracks</p>`;
  const list = v.querySelector('#lyrList');
  const draw = () => {
    const q = v.querySelector('#lyrSearch').value.toLowerCase();
    const ls = M.allLayers().filter((l) => !q || (l.name + ' ' + l.group).toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
    list.innerHTML = ls.map((l) => `<div class="layer-item"><input type="checkbox" data-l="${l.id}" ${M.layerOn(l.id) ? 'checked' : ''} id="cb_${l.id}">
      <span class="swatch" style="background:${l.color || '#888'}"></span><label for="cb_${l.id}" class="name" style="color:var(--ink);font-size:1em">${esc(l.name)}</label>
      <input type="range" min="0.1" max="1" step="0.05" value="${M.layerOpacity(l.id)}" data-o="${l.id}" title="Opacity"></div>`).join('') || '<p class="muted">No match.</p>';
  };
  draw();
  v.querySelector('#lyrSearch').oninput = draw;
  list.onchange = (e) => { if (e.target.dataset.l) { M.setLayer(e.target.dataset.l, e.target.checked); saveMapPrefs(); } };
  list.oninput = (e) => { if (e.target.dataset.o) { M.setOpacity(e.target.dataset.o, +e.target.value); saveMapPrefs(); } };
  const kl = v.querySelector('#kindList');
  kl.innerHTML = KINDS.map((k) => `<label class="layer-item" style="color:var(--ink);font-size:1em"><input type="checkbox" data-k="${k.id}" ${shown.kinds.has(k.id) ? 'checked' : ''}><span class="swatch" style="background:${k.color};border-radius:50%"></span><span class="name">${k.name}</span><span class="muted">${store.spots.filter((s) => s.kind === k.id).length}</span></label>`).join('');
  const apply = () => M.setSpotFilter((s) => shown.kinds.has(s.kind || 'note') && (!shown.hunter || s.hunter === shown.hunter));
  kl.onchange = (e) => { const k = e.target.dataset.k; e.target.checked ? shown.kinds.add(k) : shown.kinds.delete(k); apply(); };
  v.querySelector('#spotHunter').onchange = (e) => { shown.hunter = e.target.value; apply(); };
}
