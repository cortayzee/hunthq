import * as db from '../db.js?v=20261113155857-f37cc7b';
import { store } from '../db.js?v=20261113155857-f37cc7b';
import { esc, download, toast, todayISO, fmtDate, tip } from '../util.js?v=20261113155857-f37cc7b';
import { exportKML } from '../exporters.js?v=20261113155857-f37cc7b';
import { BC_WMS, BC_WFS, LEH_LAYER, LEH_TYPE_FIELD, MVPR_LAYER, WMU_LAYER } from '../config.js?v=20261113155857-f37cc7b';
import { icon } from '../icons.js?v=20261113155857-f37cc7b';
import * as M from '../map.js?v=20261113155857-f37cc7b';

const theme = () => { try { return localStorage.getItem('hunthq_theme') || 'system'; } catch { return 'system'; } };
function setTheme(t) {
  try { if (t === 'system') localStorage.removeItem('hunthq_theme'); else localStorage.setItem('hunthq_theme', t); } catch {}
  if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}
export function render(v) {
  const mode = db.getMode(); const u = db.getUser();
  const custom = store.prefs.customLayers || [];
  const row = (id, ic, title, sub, right = icon('chevR', { size: 18 })) => `<button class="list-row" id="${id}"><span class="lr-ic">${icon(ic, { size: 20 })}</span><span class="lr-t"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</span>${right}</button>`;
  v.innerHTML = `<div class="page-h"><h2>More</h2></div>
  <div class="list-group">
    <div class="list-row static"><span class="lr-ic">${icon('user', { size: 20 })}</span><span class="lr-t"><b>${mode === 'local' ? 'Local mode' : esc(u?.email || 'Signed in')}</b><span>${mode === 'local' ? 'Saved in this browser only' : 'Synced to your account'}</span></span><button class="small" id="signOut">${mode === 'local' ? 'Sign in' : 'Sign out'}</button></div>
  </div>
  <div class="list-group" style="margin-top:8px"><label class="list-row static"><span class="lr-ic">${icon('tag', { size: 20 })}</span><span class="lr-t"><b class="tip-h">Your name in logs${tip('Kills logged under Me or this name count against your tags and bag limits. Separate several names with commas.')}</b><input id="myName" value="${esc(store.prefs.myName || '')}" placeholder="e.g. Andrew" style="margin-top:6px"></span></label></div>
  <h3 class="list-h">Appearance</h3>
  <div class="seg seg-full" role="radiogroup" aria-label="Appearance">${[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([k, n]) => `<button role="radio" data-theme="${k}" aria-checked="${theme() === k}" class="${theme() === k ? 'on' : ''}">${n}</button>`).join('')}</div>
  <h3 class="list-h tip-h">Your data${tip('The free database plan has no automatic backups, so download one now and then.')}</h3>
  <div class="list-group">
    ${row('goImport', 'upload', 'Import from onX or iHunter', 'KML, KMZ, GPX, GeoJSON or CSV')}
    ${row('bExp', 'download', 'Download a backup', store.prefs.lastBackup ? 'Last backup ' + fmtDate(store.prefs.lastBackup) : 'Never backed up', '')}
    <label class="list-row" for="bImp"><span class="lr-ic">${icon('history', { size: 20 })}</span><span class="lr-t"><b>Restore a backup</b><span>From a Ridgeline .json file</span></span><input type="file" id="bImp" accept=".json" class="visually-hidden"></label>
    ${row('kmlAll', 'globe', 'Export to Google Earth', 'All waypoints and tracks as KML', '')}
  </div>
  <details class="list-more"><summary><h3 class="list-h">Tracks <span class="muted tnum">${store.tracks.length}</span></h3>${icon('chevR', { size: 16 })}</summary>
  <div class="list-group">${store.tracks.map((t) => `<div class="list-row static"><span class="lr-t"><b>${esc(t.name || 'Track')}</b><span>${[t.hunter, t.distance_km != null ? t.distance_km + ' km' : '', t.source].filter(Boolean).map(esc).join(', ')}</span></span><button class="small" data-zoom="${t.id}">Show</button><button class="icon-btn" data-del="${t.id}" aria-label="Delete track">${icon('trash', { size: 18 })}</button></div>`).join('') || '<div class="list-row static"><span class="lr-t"><span>Routes you draw and tracks you import show up here.</span></span></div>'}</div></details>
  <details class="list-more"><summary><h3 class="list-h">Advanced</h3>${icon('chevR', { size: 16 })}</summary>
  <div class="card"><h4 style="margin-top:0">Custom BC map layers</h4>
  <p class="muted">Add any BC openmaps layer by its name, e.g. <code>WHSE_FOREST_TENURE.FTEN_ROAD_SECTION_LINES_SVW</code> for resource roads.</p>
  ${custom.map((c, i) => `<div class="row" style="justify-content:space-between"><span>${esc(c.name)}</span><button class="small danger" data-rm="${i}">Remove</button></div>`).join('')}
  <div class="grid2"><input id="cName" placeholder="Display name" aria-label="Display name"><input id="cLayer" placeholder="SCHEMA.LAYER_NAME" aria-label="Layer name"></div><button id="cAdd" style="margin-top:8px">Add layer</button></div>
  <div class="card"><h4 style="margin-top:0">Layer check</h4>
  <p class="muted">Checks that BC map services respond and lists the closure and LEH layers they return.</p>
  <button id="diag">Run check</button><pre id="diagOut" style="white-space:pre-wrap;font-size:12px"></pre></div></details>
  <p class="list-note tip-h">Data sources${tip('Seasons: 2026–2028 BC Hunting & Trapping Regulations Synopsis (general open seasons). Always confirm in the synopsis and in-season changes at gov.bc.ca/hunting. Map data © Province of BC, Esri, OpenTopoMap, OpenStreetMap contributors. Terrain © Mapzen / AWS. Weather © Open-Meteo.', 'Data sources')}</p>`;
  v.querySelector('#goImport').onclick = () => import('../main.js?v=20261113155857-f37cc7b').then((m) => m.showTabPublic('import'));
  v.querySelector('#myName').onchange = async (e) => { await db.savePrefs({ myName: e.target.value.trim() }); toast('Saved'); };
  v.querySelector('#signOut').onclick = async () => { await db.signOut(); location.reload(); };
  v.querySelector('#bExp').onclick = async () => { download(`ridgeline_backup_${todayISO()}.json`, db.backupJSON(), 'application/json'); await db.savePrefs({ lastBackup: new Date().toISOString() }).catch(() => {}); };
  v.querySelector('#bImp').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const c = await db.restoreJSON(JSON.parse(await f.text())); toast('Restored: ' + Object.entries(c).map(([k, n]) => `${n} ${k}`).join(', '), 5000); render(v); } catch (err) { toast('Restore failed: ' + err.message, 6000); }
  };
  v.querySelector('#kmlAll').onclick = () => exportKML(store.spots, store.tracks);
  v.onclick = async (e) => {
    const th = e.target.closest('[data-theme]'); if (th) { setTheme(th.dataset.theme); render(v); return; }
    const d = e.target.closest('button')?.dataset || {};
    if (d.zoom) { const t = store.tracks.find((x) => x.id === d.zoom); M.fitTo(t.coords.map((c) => [c[0], c[1]])); }
    if (d.del && confirm('Delete track?')) { await db.remove('tracks', d.del); render(v); }
    if (d.rm != null && e.target.matches('[data-rm]')) { const list = custom.filter((_, i) => i !== +d.rm); await db.savePrefs({ customLayers: list }); M.setCustomLayers(list); render(v); }
  };
  v.querySelector('#cAdd').onclick = async () => {
    const layer = v.querySelector('#cLayer').value.trim().replace(/^pub:/, ''); if (!layer) return;
    const list = [...custom, { name: v.querySelector('#cName').value.trim() || layer, layer, color: '#00a0c8' }];
    await db.savePrefs({ customLayers: list }); M.setCustomLayers(list); M.setLayer('custom_' + layer, true); toast('Layer added to Layers'); render(v);
  };
  v.querySelector('#diag').onclick = () => diagnostics(v.querySelector('#diagOut'));
}

async function diagnostics(out) {
  const log = (s) => (out.textContent += s + '\n'); out.textContent = '';
  try {
    const r = await fetch(`${BC_WMS}?service=WMS&request=GetCapabilities&version=1.3.0&namespace=pub`);
    const t = await r.text(); const names = [...t.matchAll(/<Name>pub:([^<]+)<\/Name>/g)].map((m) => m[1]);
    log(`WMS OK, ${names.length} layers`);
    log('MVPR layers: ' + (names.filter((n) => /MVPR|MOTOR/i.test(n)).join(', ') || 'none found'));
    log('Wildlife mgmt layers: ' + names.filter((n) => n.startsWith('WHSE_WILDLIFE_MANAGEMENT.WAA')).join(', '));
  } catch (e) { log('GetCapabilities failed: ' + e.message); }
  const sample = async (layer, label) => {
    try {
      const r = await fetch(`${BC_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeName=pub:${layer}&count=200&outputFormat=application/json&propertyName=${label || ''}`.replace(/&propertyName=$/, ''));
      const j = await r.json(); const f = j.features || [];
      log(`\n${layer}: ${f.length} sample features. Fields: ${Object.keys(f[0]?.properties || {}).join(', ')}`);
      return f;
    } catch (e) { log(`${layer}: WFS failed (${e.message})`); return []; }
  };
  const leh = await sample(LEH_LAYER);
  log(`${LEH_TYPE_FIELD} values: ` + [...new Set(leh.map((f) => f.properties[LEH_TYPE_FIELD]))].join(' | '));
  const mv = await sample(MVPR_LAYER);
  if (mv[0]) log('MVPR example: ' + JSON.stringify(mv[0].properties).slice(0, 600));
  const w = await sample(WMU_LAYER);
  if (w[0]) log('WMU example: ' + JSON.stringify(w[0].properties).slice(0, 400));
}
