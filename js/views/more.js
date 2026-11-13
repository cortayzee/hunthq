import * as db from '../db.js?v=20261113054105-48b1474';
import { store } from '../db.js?v=20261113054105-48b1474';
import { esc, download, toast, todayISO, fmtDate } from '../util.js?v=20261113054105-48b1474';
import { exportKML } from '../exporters.js?v=20261113054105-48b1474';
import { BC_WMS, BC_WFS, LEH_LAYER, LEH_TYPE_FIELD, MVPR_LAYER, WMU_LAYER } from '../config.js?v=20261113054105-48b1474';
import * as M from '../map.js?v=20261113054105-48b1474';

export function render(v) {
  const mode = db.getMode(); const u = db.getUser();
  const custom = store.prefs.customLayers || [];
  v.innerHTML = `<h2>More</h2>
  <div class="card"><h3 style="margin-top:0">Account</h3>
  <p>${mode === 'local' ? '<span class="chip warn">Local mode</span> data lives only in this browser. Export a backup and restore it after signing in to sync.' : `Signed in as ${esc(u?.email || '')} <span class="chip ok">synced</span>`}</p>
  <button id="signOut">${mode === 'local' ? 'Leave local mode' : 'Sign out'}</button></div>

  <div class="card"><h3 style="margin-top:0">Backup</h3>
  <p class="muted">Supabase free plan has no automatic backups and pauses after 7 idle days. Export regularly.</p>
  <div class="row"><button class="primary" id="bExp">Export JSON backup</button><label class="row" style="color:var(--ink)">Restore <input type="file" id="bImp" accept=".json"></label></div>
  <p class="muted">Last backup: ${store.prefs.lastBackup ? fmtDate(store.prefs.lastBackup) : 'never'}</p></div>

  <div class="card"><h3 style="margin-top:0">Google Earth</h3>
  <p class="muted">Export all waypoints &amp; tracks as KML (filtered exports are in Waypoints). Each waypoint popup has an “Open in Google Earth” link.</p>
  <button id="kmlAll">Export all as KML</button></div>

  <div class="card"><h3 style="margin-top:0">Tracks (${store.tracks.length})</h3>
  <table><tbody>${store.tracks.map((t) => `<tr><td>${esc(t.name || 'Track')}<div class="muted">${esc(t.hunter || '')} · ${t.distance_km ?? '?'} km · ${esc(t.source || '')}</div></td><td><button class="small" data-zoom="${t.id}">Zoom</button> <button class="small danger" data-del="${t.id}">Delete</button></td></tr>`).join('') || '<tr><td class="muted">Import GPX/KML tracks in Import.</td></tr>'}</tbody></table></div>

  <div class="card"><h3 style="margin-top:0">Custom BC layers</h3>
  <p class="muted">Add any openmaps layer by name (e.g. <code>WHSE_FOREST_TENURE.FTEN_ROAD_SECTION_LINES_SVW</code> for resource roads).</p>
  ${custom.map((c, i) => `<div class="row"><span>${esc(c.name)}</span><button class="small danger" data-rm="${i}">Remove</button></div>`).join('')}
  <div class="row"><input id="cName" placeholder="Display name"><input id="cLayer" placeholder="SCHEMA.LAYER_NAME"><button id="cAdd">Add</button></div></div>

  <div class="card"><h3 style="margin-top:0">Layer diagnostics</h3>
  <p class="muted">Checks the BC layers respond, lists MVPR layer names and the actual LEH zone type values (used for the per-species LEH toggles).</p>
  <button id="diag">Run diagnostics</button><pre id="diagOut" style="white-space:pre-wrap;font-size:12px"></pre></div>

  <div class="card"><h3 style="margin-top:0">About the data</h3>
  <p class="muted">Seasons: 2026–2028 BC Hunting &amp; Trapping Regulations Synopsis, general open seasons only (394 rows). Some rows have empty classes or footnotes; always check the synopsis and in-season changes at gov.bc.ca/hunting. Map layers © Province of BC, Esri, OpenTopoMap, OpenStreetMap; terrain © Mapzen/AWS Terrain Tiles.</p></div>`;

  v.querySelector('#signOut').onclick = async () => { await db.signOut(); location.reload(); };
  v.querySelector('#bExp').onclick = async () => { download(`hunthq_backup_${todayISO()}.json`, db.backupJSON(), 'application/json'); await db.savePrefs({ lastBackup: new Date().toISOString() }).catch(() => {}); };
  v.querySelector('#bImp').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const c = await db.restoreJSON(JSON.parse(await f.text())); toast('Restored: ' + Object.entries(c).map(([k, n]) => `${n} ${k}`).join(', '), 5000); render(v); } catch (err) { toast('Restore failed: ' + err.message, 6000); }
  };
  v.querySelector('#kmlAll').onclick = () => exportKML(store.spots, store.tracks);
  v.onclick = async (e) => {
    const d = e.target.dataset;
    if (d.zoom) { const t = store.tracks.find((x) => x.id === d.zoom); M.fitTo(t.coords.map((c) => [c[0], c[1]])); }
    if (d.del && confirm('Delete track?')) { await db.remove('tracks', d.del); render(v); }
    if (d.rm != null && e.target.matches('[data-rm]')) { const list = custom.filter((_, i) => i !== +d.rm); await db.savePrefs({ customLayers: list }); M.setCustomLayers(list); render(v); }
  };
  v.querySelector('#cAdd').onclick = async () => {
    const layer = v.querySelector('#cLayer').value.trim().replace(/^pub:/, ''); if (!layer) return;
    const list = [...custom, { name: v.querySelector('#cName').value.trim() || layer, layer, color: '#00a0c8' }];
    await db.savePrefs({ customLayers: list }); M.setCustomLayers(list); M.setLayer('custom_' + layer, true); toast('Layer added (see Layers)'); render(v);
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
