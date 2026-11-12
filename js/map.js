// MapLibre map: base styles, 3D terrain, BC WMS overlays, identify, waypoints/tracks, open-WMU shading.
import { BASES, TERRAIN_TILES, BC_LAYERS, BC_WMS, WMU_LAYER, WMU_FIELD, kindColor, KINDS } from './config.js';
import { store } from './db.js';
import { esc, earthLink, fmtDT } from './util.js';

export let map;
const state = { base: 'sat', terrain: false, layers: {}, opacity: {}, shade: null, custom: [] };
let clickHandler = null;

const wmsTiles = (layer, { cql, sld, styles = '' } = {}) => {
  const p = new URLSearchParams({ service: 'WMS', request: 'GetMap', version: '1.1.1', layers: 'pub:' + layer, styles, format: 'image/png', transparent: 'true', srs: 'EPSG:3857', width: '256', height: '256' });
  if (cql) p.set('CQL_FILTER', cql);
  if (sld) p.set('SLD_BODY', sld);
  return `${BC_WMS}?${p.toString()}&bbox={bbox-epsg-3857}`;
};

export const allLayers = () => [...BC_LAYERS, ...state.custom];

export function initMap(container, saved = {}) {
  Object.assign(state, saved.map || {});
  state.custom = (saved.customLayers || []).map((c) => ({ ...c, id: 'custom_' + c.layer, group: 'Custom', identify: true }));
  map = new maplibregl.Map({
    container,
    style: { version: 8, sources: {}, layers: [] },
    center: state.center || [-122.5, 53.5], zoom: state.zoom ?? 5, pitch: 0, maxPitch: 80,
    attributionControl: { compact: true }, hash: false,
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showAccuracyCircle: true }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
  return new Promise((res) => map.on('load', () => {
    setBase(state.base, true);
    map.addSource('terrain', { type: 'raster-dem', tiles: [TERRAIN_TILES], encoding: 'terrarium', tileSize: 256, maxzoom: 15 });
    map.addSource('hillshade-dem', { type: 'raster-dem', tiles: [TERRAIN_TILES], encoding: 'terrarium', tileSize: 256, maxzoom: 15 });
    for (const l of allLayers()) if (state.layers[l.id] ?? l.on) addWms(l);
    addDataLayers();
    if (state.terrain) setTerrain(true);
    map.on('click', (e) => clickHandler && clickHandler(e));
    res(map);
  }));
}

export const mapState = () => ({ base: state.base, terrain: state.terrain, layers: state.layers, opacity: state.opacity, center: map.getCenter().toArray(), zoom: map.getZoom() });
export const onMapClick = (fn) => (clickHandler = fn);

export function setBase(id, first = false) {
  state.base = id; const b = BASES[id];
  if (map.getLayer('base')) map.removeLayer('base');
  if (map.getSource('base')) map.removeSource('base');
  map.addSource('base', { type: 'raster', tiles: b.tiles, tileSize: 256, maxzoom: b.max, attribution: b.attr });
  const before = map.getStyle().layers.find((l) => l.id !== 'base')?.id;
  map.addLayer({ id: 'base', type: 'raster', source: 'base' }, first ? undefined : before);
}

export function setTerrain(on) {
  state.terrain = on;
  if (on) {
    map.setTerrain({ source: 'terrain', exaggeration: 1.4 });
    if (!map.getLayer('hillshade')) map.addLayer({ id: 'hillshade', type: 'hillshade', source: 'hillshade-dem', paint: { 'hillshade-exaggeration': 0.25 } }, map.getStyle().layers[1]?.id);
    if (map.getPitch() < 30) map.easeTo({ pitch: 60, duration: 800 });
  } else {
    map.setTerrain(null);
    if (map.getLayer('hillshade')) map.removeLayer('hillshade');
    map.easeTo({ pitch: 0, duration: 600 });
  }
}
export const terrainOn = () => state.terrain;

function firstDataLayer() { return ['shade-open', 'shade-foot', 'hot-fill', 'tracks-line'].find((id) => map.getLayer(id)); }

function addWms(l) {
  const id = 'wms-' + l.id;
  if (map.getSource(id)) return;
  map.addSource(id, { type: 'raster', tiles: [wmsTiles(l.layer, { cql: l.cql })], tileSize: 256, attribution: 'BC Gov (OGL-BC)' });
  map.addLayer({ id, type: 'raster', source: id, minzoom: l.minzoom || 0, paint: { 'raster-opacity': state.opacity[l.id] ?? 0.8 } }, firstDataLayer());
}
function removeWms(l) { const id = 'wms-' + l.id; if (map.getLayer(id)) map.removeLayer(id); if (map.getSource(id)) map.removeSource(id); }

export function setLayer(id, on) {
  const l = allLayers().find((x) => x.id === id); if (!l) return;
  state.layers[id] = on; on ? addWms(l) : removeWms(l);
}
export const layerOn = (id) => { const l = allLayers().find((x) => x.id === id); return !!(state.layers[id] ?? l?.on); };
export const layerOpacity = (id) => state.opacity[id] ?? 0.8;
export function setOpacity(id, v) { state.opacity[id] = v; if (map.getLayer('wms-' + id)) map.setPaintProperty('wms-' + id, 'raster-opacity', v); }
export function setCustomLayers(list) {
  for (const l of state.custom) removeWms(l);
  state.custom = list.map((c) => ({ ...c, id: 'custom_' + c.layer, group: 'Custom', identify: true }));
  for (const l of state.custom) if (state.layers[l.id]) addWms(l);
}

// ---- Open-WMU shading: one short SLD (fill colour only) + CQL_FILTER per class (plain open / footnoted) ----
const sldFill = (fill) => `<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld"><NamedLayer><Name>pub:${WMU_LAYER}</Name><UserStyle><FeatureTypeStyle><Rule><PolygonSymbolizer><Fill><CssParameter name="fill">${fill}</CssParameter><CssParameter name="fill-opacity">0.45</CssParameter></Fill><Stroke><CssParameter name="stroke">${fill}</CssParameter><CssParameter name="stroke-width">1.2</CssParameter></Stroke></PolygonSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
export function shadeOpen(rows) {
  clearShade();
  if (!rows || !rows.length) return;
  const plain = new Set(), foot = new Set();
  for (const r of rows) for (const m of r.mu) (r.n ? foot : plain).add(m);
  for (const m of plain) foot.delete(m);
  const add = (id, mus, fill) => {
    if (!mus.size) return;
    const cql = `${WMU_FIELD} IN (${[...mus].map((m) => `'${m}'`).join(',')})`;
    map.addSource(id, { type: 'raster', tiles: [wmsTiles(WMU_LAYER, { sld: sldFill(fill), cql })], tileSize: 256 });
    map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': 0.85 } }, 'hot-fill');
  };
  add('shade-open', plain, '#2fbf4a'); add('shade-foot', foot, '#f2c200');
  state.shade = [...plain, ...foot];
}
export function clearShade() {
  for (const id of ['shade-open', 'shade-foot']) { if (map.getLayer(id)) map.removeLayer(id); if (map.getSource(id)) map.removeSource(id); }
  state.shade = null;
}

// ---- Identify (WMS GetFeatureInfo across queryable layers) ----
export async function identify(lngLat, layerIds) {
  const layers = allLayers().filter((l) => l.identify && (layerIds ? layerIds.includes(l.id) : (l.id === 'wmu' || layerOn(l.id))));
  // Always query WMU and MVPR areas, even if hidden
  for (const id of ['wmu', 'mvpr', 'parks', 'reserves']) if (!layers.find((l) => l.id === id)) layers.push(BC_LAYERS.find((l) => l.id === id));
  const uniq = [...new Map(layers.map((l) => [l.layer, l])).values()];
  const p = map.project(lngLat); const c = map.unproject(p);
  // small bbox around click (~8 px) in EPSG:4326 to avoid projection maths
  const a = map.unproject([p.x - 4, p.y + 4]), b = map.unproject([p.x + 4, p.y - 4]);
  const params = new URLSearchParams({
    service: 'WMS', request: 'GetFeatureInfo', version: '1.1.1', layers: uniq.map((l) => 'pub:' + l.layer).join(','),
    query_layers: uniq.map((l) => 'pub:' + l.layer).join(','), styles: '', srs: 'EPSG:4326',
    bbox: [a.lng, a.lat, b.lng, b.lat].join(','), width: '9', height: '9', x: '4', y: '4',
    info_format: 'application/json', feature_count: '20',
  });
  try {
    const r = await fetch(`${BC_WMS}?${params}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const out = {};
    for (const f of j.features || []) {
      const fid = (f.id || '').toUpperCase();
      const l = uniq.find((x) => fid.includes(x.layer.split('.').pop().toUpperCase()))
        || (f.properties && WMU_FIELD in f.properties ? uniq.find((x) => x.id === 'wmu') : null)
        || { id: fid.replace(/\.[^.]*$/, '') || 'other', name: fid.replace(/\.[^.]*$/, '') || 'Other' };
      (out[l.id] ||= { layer: l, feats: [] }).feats.push(f.properties || {});
    }
    return { ok: true, at: c, results: out };
  } catch (e) {
    console.warn('identify failed', e);
    return { ok: false, error: String(e), results: {} };
  }
}
export const wmuFromIdentify = (res) => res.results?.wmu?.feats?.[0]?.[WMU_FIELD] || null;

// ---- Waypoints & tracks ----
function addDataLayers() {
  map.addSource('tracks', { type: 'geojson', data: tracksGeo() });
  map.addLayer({ id: 'tracks-line', type: 'line', source: 'tracks', paint: { 'line-color': '#ff3d7f', 'line-width': 3, 'line-opacity': 0.85 } });
  map.addSource('spots', { type: 'geojson', data: spotsGeo() });
  map.addLayer({ id: 'spots-halo', type: 'circle', source: 'spots', paint: { 'circle-radius': 9, 'circle-color': '#fff', 'circle-opacity': 0.9 } });
  map.addLayer({ id: 'spots-dot', type: 'circle', source: 'spots', paint: { 'circle-radius': 6.5, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#000', 'circle-stroke-width': 0.5 } });
  map.addSource('hot', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'hot-fill', type: 'fill', source: 'hot', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.35, 'fill-outline-color': ['get', 'color'] } }, 'tracks-line');
  map.addSource('sel', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'sel-line', type: 'line', source: 'sel', paint: { 'line-color': '#ff4d4d', 'line-width': 3.5 } }, 'tracks-line');
  for (const l of ['spots-dot', 'tracks-line']) {
    map.on('mouseenter', l, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', l, () => (map.getCanvas().style.cursor = ''));
  }
}
let spotFilter = () => true;
export function setSpotFilter(fn) { spotFilter = fn || (() => true); refreshData(); }
function spotsGeo() {
  return { type: 'FeatureCollection', features: store.spots.filter(spotFilter).map((s) => ({ type: 'Feature', id: undefined, properties: { id: s.id, kind: s.kind, color: kindColor(s.kind) }, geometry: { type: 'Point', coordinates: [s.lon, s.lat] } })) };
}
function tracksGeo() {
  return { type: 'FeatureCollection', features: store.tracks.map((t) => ({ type: 'Feature', properties: { id: t.id, name: t.name }, geometry: { type: 'LineString', coordinates: (t.coords || []).map((c) => [c[0], c[1]]) } })) };
}
export function refreshData() {
  if (!map?.getSource('spots')) return;
  map.getSource('spots').setData(spotsGeo()); map.getSource('tracks').setData(tracksGeo());
}
export function setSelection(fc) { map.getSource('sel')?.setData(fc || { type: 'FeatureCollection', features: [] }); }
export function setHotspots(fc) { map.getSource('hot')?.setData(fc || { type: 'FeatureCollection', features: [] }); }

export function spotPopupHTML(s) {
  const k = KINDS.find((x) => x.id === s.kind)?.name || s.kind;
  return `<div class="popup"><h4><span class="swatch" style="background:${kindColor(s.kind)}"></span> ${esc(s.name || k)}</h4>
  <dl><dt>Kind</dt><dd>${esc(k)}</dd>${s.species ? `<dt>Species</dt><dd>${esc(s.species)} ${esc(s.sex || '')}</dd>` : ''}
  <dt>Hunter</dt><dd>${esc(s.hunter || '')}</dd>${s.observed_at ? `<dt>When</dt><dd>${esc(fmtDT(s.observed_at))}</dd>` : ''}
  ${s.wmu ? `<dt>WMU</dt><dd>${esc(s.wmu)}</dd>` : ''}${s.weapon ? `<dt>Weapon</dt><dd>${esc(s.weapon)}</dd>` : ''}
  <dt>Lat/Lon</dt><dd>${(+s.lat).toFixed(5)}, ${(+s.lon).toFixed(5)}</dd></dl>
  ${s.notes ? `<div class="muted">${esc(s.notes)}</div>` : ''}
  <div class="row" style="margin-top:6px"><button class="small" data-act="edit-spot" data-id="${s.id}">Edit</button>
  <a class="small" href="${earthLink(s.lat, s.lon)}" target="_blank" rel="noopener">Open in Google Earth</a></div></div>`;
}

export function flyTo(lon, lat, zoom = 13) { map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), zoom) }); }
export function fitTo(coords) {
  if (!coords.length) return;
  const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
  map.fitBounds(b, { padding: 60, maxZoom: 14 });
}
