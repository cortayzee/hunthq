// MapLibre map: base styles, 3D terrain, BC WMS overlays, identify, waypoints/tracks, open-WMU shading.
import { BASES, REF_TILES, GLYPHS, WMU_GEO_URL, WMU_LABELS_URL, TERRAIN_TILES, BC_LAYERS, BC_WMS, WMU_LAYER, WMU_FIELD, kindColor, KINDS } from './config.js?v=20261113010538-c99624f';
import { store } from './db.js?v=20261113010538-c99624f';
import { MODES, fmtKm } from './elevation.js?v=20261113010538-c99624f';
import { badgeImage, glyphFor, glyphSVG, spotLabel, sexTerms } from './animals.js?v=20261113010538-c99624f';
import { esc, earthLink, fmtDT } from './util.js?v=20261113010538-c99624f';

export let map;
const state = { base: 'sat', terrain: false, exag: 1.5, hillshade: false, ref: false, hiddenWmu: [], layers: {}, opacity: {}, shade: null, custom: [] };
const listeners = new Set();
export const onMapState = (fn) => listeners.add(fn);
const changed = () => listeners.forEach((fn) => fn(state));
let clickHandler = null;

const wmsTiles = (layer, { cql, sld, styles = '' } = {}) => {
  const p = new URLSearchParams({ service: 'WMS', request: 'GetMap', version: '1.1.1', layers: 'pub:' + layer, styles, format: 'image/png', transparent: 'true', srs: 'EPSG:3857', width: '256', height: '256' });
  if (cql) p.set('CQL_FILTER', cql);
  if (sld) p.set('SLD_BODY', sld);
  return `${BC_WMS}?${p.toString()}&bbox={bbox-epsg-3857}`;
};

// iHunter-style overlay look: coloured outline + light tint instead of the layer's default solid fill.
const sldStyle = (l) => {
  const sym = l.geom === 'line'
    ? `<LineSymbolizer><Stroke><CssParameter name="stroke">${l.color}</CssParameter><CssParameter name="stroke-width">3</CssParameter></Stroke></LineSymbolizer>`
    : `<PolygonSymbolizer><Fill><CssParameter name="fill">${l.color}</CssParameter><CssParameter name="fill-opacity">0.12</CssParameter></Fill><Stroke><CssParameter name="stroke">${l.color}</CssParameter><CssParameter name="stroke-width">2</CssParameter></Stroke></PolygonSymbolizer>`;
  return `<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld"><NamedLayer><Name>pub:${l.layer}</Name><UserStyle><FeatureTypeStyle><Rule>${sym}</Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
};

export const allLayers = () => [...BC_LAYERS, ...state.custom];

export function initMap(container, saved = {}) {
  Object.assign(state, saved.map || {});
  state.custom = (saved.customLayers || []).map((c) => ({ ...c, id: 'custom_' + c.layer, group: 'Custom', identify: true }));
  map = new maplibregl.Map({
    container,
    style: { version: 8, glyphs: new URL(GLYPHS, location.href).href.replace('%7Bfontstack%7D', '{fontstack}').replace('%7Brange%7D', '{range}'), sources: {}, layers: [] },
    center: state.center || [-122.5, 53.5], zoom: state.zoom ?? 5, pitch: 0, maxPitch: 80,
    attributionControl: { compact: true }, hash: false,
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showZoom: matchMedia('(pointer: fine)').matches }), 'top-right');
  geolocate = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showAccuracyCircle: true });
  map.addControl(geolocate, 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
  return new Promise((res) => map.on('load', () => {
    if (!BASES[state.base]) state.base = 'sat';
    setBase(state.base, true);
    map.addSource('terrain', { type: 'raster-dem', tiles: [TERRAIN_TILES], encoding: 'terrarium', tileSize: 256, maxzoom: 15 });
    map.addSource('hillshade-dem', { type: 'raster-dem', tiles: [TERRAIN_TILES], encoding: 'terrarium', tileSize: 256, maxzoom: 15 });
    for (const l of allLayers()) if (state.layers[l.id] ?? l.on) addWms(l);
    addDataLayers();
    addWmuVector();
    if (state.hillshade) setHillshade(true);
    if (state.terrain) setTerrain(true, { animate: false });
    map.on('click', (e) => clickHandler && clickHandler(e));
    res(map);
  }));
}

export let geolocate;
export const mapState = () => ({ base: state.base, terrain: state.terrain, exag: state.exag, hillshade: state.hillshade, ref: state.ref, hiddenWmu: state.hiddenWmu, layers: state.layers, opacity: state.opacity, center: map.getCenter().toArray(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() });
export const getState = () => state;
export const onMapClick = (fn) => (clickHandler = fn);

export function setBase(id, first = false) {
  state.base = id; const b = BASES[id];
  if (map.getLayer('base')) map.removeLayer('base');
  if (map.getSource('base')) map.removeSource('base');
  map.addSource('base', { type: 'raster', tiles: b.tiles, tileSize: 256, maxzoom: b.max, attribution: b.attr });
  const before = map.getStyle().layers.find((l) => l.id !== 'base')?.id;
  map.addLayer({ id: 'base', type: 'raster', source: 'base' }, first ? undefined : before);
  // Dark base: lighten WMU labels' contrast stays (white on dark halo), nothing else to do.
  applyRef(); changed();
}
// Roads & place names overlay (forced on for Hybrid).
export function setRef(on) { state.ref = on; applyRef(); changed(); }
export const refOn = () => !!(state.ref || BASES[state.base]?.ref);
function applyRef() {
  const want = refOn();
  for (let i = 0; i < REF_TILES.length; i++) {
    const id = 'ref' + i;
    if (want && !map.getSource(id)) {
      map.addSource(id, { type: 'raster', tiles: [REF_TILES[i]], tileSize: 256, maxzoom: 19 });
      map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': 0.95 } }, map.getStyle().layers.find((l) => l.id !== 'base' && !l.id.startsWith('ref') && l.id !== 'hillshade')?.id);
    } else if (!want && map.getSource(id)) { map.removeLayer(id); map.removeSource(id); }
  }
}

export function setHillshade(on) {
  state.hillshade = on;
  if (on && !map.getLayer('hillshade')) map.addLayer({ id: 'hillshade', type: 'hillshade', source: 'hillshade-dem', paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#1d2a1d' } }, map.getStyle().layers.find((l) => l.id !== 'base')?.id);
  if (!on && map.getLayer('hillshade') && !state.terrain) map.removeLayer('hillshade');
  changed();
}

export function setTerrain(on, { animate = true } = {}) {
  state.terrain = on;
  const ease = { duration: animate && !reducedMotion() ? 700 : 0 };
  if (on) {
    map.setTerrain({ source: 'terrain', exaggeration: state.exag });
    if (!map.getLayer('hillshade')) map.addLayer({ id: 'hillshade', type: 'hillshade', source: 'hillshade-dem', paint: { 'hillshade-exaggeration': 0.25 } }, map.getStyle().layers.find((l) => l.id !== 'base')?.id);
    try { map.setSky({ 'sky-color': '#9cc3e6', 'horizon-color': '#dfe9f2', 'fog-color': '#e7edf2', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.85, 'atmosphere-blend': 0.8 }); } catch {}
    if (map.getPitch() < 30) map.easeTo({ pitch: 62, ...ease });
  } else {
    map.setTerrain(null);
    if (map.getLayer('hillshade') && !state.hillshade) map.removeLayer('hillshade');
    map.easeTo({ pitch: 0, bearing: 0, ...ease });
  }
  changed();
}
export function setExaggeration(v) { state.exag = v; if (state.terrain) map.setTerrain({ source: 'terrain', exaggeration: v }); }
export const terrainOn = () => state.terrain;
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function firstDataLayer() { return ['shade-open', 'shade-foot', 'hot-fill', 'tracks-line'].find((id) => map.getLayer(id)); }

function addWms(l) {
  const id = 'wms-' + l.id;
  if (map.getSource(id)) return;
  let cql = l.cql;
  if (l.id === 'wmu' && state.hiddenWmu.length) cql = `NOT (${WMU_FIELD} IN (${state.hiddenWmu.map((m) => `'${m}'`).join(',')}))`;
  map.addSource(id, { type: 'raster', tiles: [wmsTiles(l.layer, { cql, sld: l.color ? sldStyle(l) : undefined })], tileSize: 256, attribution: 'BC Gov (OGL-BC)' });
  map.addLayer({ id, type: 'raster', source: id, minzoom: l.minzoom || 0, paint: { 'raster-opacity': state.opacity[l.id] ?? 0.9 } }, firstDataLayer());
}
function removeWms(l) { const id = 'wms-' + l.id; if (map.getLayer(id)) map.removeLayer(id); if (map.getSource(id)) map.removeSource(id); }

export function setLayer(id, on) {
  const l = allLayers().find((x) => x.id === id); if (!l) return;
  state.layers[id] = on; on ? addWms(l) : removeWms(l);
  if (id === 'wmu') applyWmuFilter();
  changed();
}
export const layerOn = (id) => { const l = allLayers().find((x) => x.id === id); return !!(state.layers[id] ?? l?.on); };
export const layerOpacity = (id) => state.opacity[id] ?? 0.9;
export function setOpacity(id, v) { state.opacity[id] = v; if (map.getLayer('wms-' + id)) map.setPaintProperty('wms-' + id, 'raster-opacity', v); }
export function setCustomLayers(list) {
  for (const l of state.custom) removeWms(l);
  state.custom = list.map((c) => ({ ...c, id: 'custom_' + c.layer, group: 'Custom', identify: true }));
  for (const l of state.custom) if (state.layers[l.id]) addWms(l);
}

// ---- WMU vector layer: numbers, per-unit hide, season shading (simplified shapes; exact lines stay WMS) ----
export let WMU_GEO = null;
async function addWmuVector() {
  const [geo, lab] = await Promise.all([fetch(WMU_GEO_URL).then((r) => r.json()), fetch(WMU_LABELS_URL).then((r) => r.json())]);
  WMU_GEO = geo;
  map.addSource('wmu-geo', { type: 'geojson', data: geo, promoteId: 'id' });
  map.addSource('wmu-lab', { type: 'geojson', data: lab });
  const before = map.getLayer('hot-fill') ? 'hot-fill' : undefined;
  map.addLayer({ id: 'wmu-fill', type: 'fill', source: 'wmu-geo', paint: { 'fill-color': '#000', 'fill-opacity': 0 } }, before);
  map.addLayer({ id: 'wmu-sel', type: 'fill', source: 'wmu-geo', paint: { 'fill-color': '#ff4d4d', 'fill-opacity': ['case', ['boolean', ['feature-state', 'sel'], false], 0.12, 0] } }, before);
  // Zoomed in, label every tile-piece of the polygon so a number is always on screen.
  map.addLayer({ id: 'wmu-label-hi', type: 'symbol', source: 'wmu-geo', minzoom: 9.5,
    layout: { 'text-field': ['concat', 'WMU ', ['get', 'id']], 'text-font': ['Open Sans Semibold'], 'text-size': 14, 'text-padding': 60, 'symbol-spacing': 600 },
    paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(12,16,12,.9)', 'text-halo-width': 1.6 } });
  map.addLayer({ id: 'wmu-label', type: 'symbol', source: 'wmu-lab', minzoom: 5.2, maxzoom: 9.5,
    layout: { 'text-field': ['step', ['zoom'], ['get', 'id'], 8, ['concat', 'WMU ', ['get', 'id']]], 'text-font': ['Open Sans Semibold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 8, 13, 12, 16], 'symbol-sort-key': ['-', 0, ['get', 'a']], 'text-padding': 4, 'text-letter-spacing': 0.02 },
    paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(12,16,12,.9)', 'text-halo-width': 1.6, 'text-halo-blur': 0.3 } });
  applyWmuFilter(); applyShade();
}
function applyWmuFilter() {
  if (!map.getLayer('wmu-label')) return;
  const hid = ['!', ['in', ['get', 'id'], ['literal', state.hiddenWmu]]];
  for (const id of ['wmu-label', 'wmu-label-hi', 'wmu-fill']) map.setFilter(id, hid);
  for (const id of ['wmu-label', 'wmu-label-hi']) map.setLayoutProperty(id, 'visibility', layerOn('wmu') ? 'visible' : 'none');
}
export function setWmuHidden(list) {
  state.hiddenWmu = [...new Set(list)];
  applyWmuFilter(); applyShade();
  const l = BC_LAYERS.find((x) => x.id === 'wmu'); if (layerOn('wmu')) { removeWms(l); addWms(l); }
  changed();
}
export const wmuHidden = (mu) => state.hiddenWmu.includes(mu);
export function toggleWmu(mu, show) { setWmuHidden(show ? state.hiddenWmu.filter((m) => m !== mu) : [...state.hiddenWmu, mu]); }

let selId = null;
export function selectWmu(mu) {
  if (!map.getSource('wmu-geo')) return;
  if (selId) map.setFeatureState({ source: 'wmu-geo', id: selId }, { sel: false });
  selId = mu || null; if (selId) map.setFeatureState({ source: 'wmu-geo', id: selId }, { sel: true });
}

// Season shading: green = open, yellow = open with a synopsis footnote.
export function shadeOpen(rows) {
  const plain = new Set(), foot = new Set();
  for (const r of rows || []) for (const m of r.mu) (r.n ? foot : plain).add(m);
  for (const m of plain) foot.delete(m);
  state.shade = rows && rows.length ? { plain: [...plain], foot: [...foot] } : null;
  applyShade();
}
export function clearShade() { state.shade = null; applyShade(); }
function applyShade() {
  if (!map.getLayer('wmu-fill')) return;
  const sh = state.shade;
  if (!sh) { map.setPaintProperty('wmu-fill', 'fill-opacity', 0); return; }
  const expr = ['match', ['get', 'id']];
  if (sh.plain.length) expr.push(sh.plain, '#2fbf4a');
  if (sh.foot.length) expr.push(sh.foot, '#f2c200');
  expr.push('rgba(0,0,0,0)');
  map.setPaintProperty('wmu-fill', 'fill-color', expr.length > 3 ? expr : '#000');
  map.setPaintProperty('wmu-fill', 'fill-opacity', expr.length > 3 ? 0.42 : 0);
}

// ---- Identify (WMS GetFeatureInfo across queryable layers) ----
export async function identify(lngLat, layerIds) {
  // Only layers the user has switched on are reported (WMU is always looked up for seasons).
  const on = allLayers().filter((l) => l.identify && (layerIds ? layerIds.includes(l.id) : (l.id === 'wmu' || layerOn(l.id))));
  if (!on.find((l) => l.id === 'wmu') && !layerIds) on.push(BC_LAYERS.find((l) => l.id === 'wmu'));
  const byLayer = new Map(); for (const l of on) { if (!byLayer.has(l.layer)) byLayer.set(l.layer, []); byLayer.get(l.layer).push(l); }
  const p = map.project(lngLat);
  const a = map.unproject([p.x - 4, p.y + 4]), b = map.unproject([p.x + 4, p.y - 4]);
  const names = [...byLayer.keys()].map((n) => 'pub:' + n).join(',');
  const params = new URLSearchParams({
    service: 'WMS', request: 'GetFeatureInfo', version: '1.1.1', layers: names, query_layers: names, styles: '', srs: 'EPSG:4326',
    bbox: [a.lng, a.lat, b.lng, b.lat].join(','), width: '9', height: '9', x: '4', y: '4', info_format: 'application/json', feature_count: '30',
  });
  // GeoServer hit-tests against the rendered style; zoomed in, the default styles are outline-only, so a tap inside a
  // unit would return nothing. Send a filled style for every queried layer so any tap inside a polygon counts.
  params.set('SLD_BODY', `<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld">${[...byLayer].map(([n, ls]) => `<NamedLayer><Name>pub:${n}</Name><UserStyle><FeatureTypeStyle><Rule>${
    ls[0].geom === 'line' ? '<LineSymbolizer><Stroke><CssParameter name="stroke">#000</CssParameter><CssParameter name="stroke-width">9</CssParameter></Stroke></LineSymbolizer>'
      : '<PolygonSymbolizer><Fill><CssParameter name="fill">#000</CssParameter></Fill></PolygonSymbolizer>'}</Rule></FeatureTypeStyle></UserStyle></NamedLayer>`).join('')}</StyledLayerDescriptor>`);
  try {
    const r = await fetch(`${BC_WMS}?${params}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const out = {};
    for (const f of j.features || []) {
      const fid = (f.id || '').toUpperCase(); const props = f.properties || {};
      const key = [...byLayer.keys()].find((n) => fid.includes(n.split('.').pop().toUpperCase())) || (WMU_FIELD in props ? WMU_LAYER : null);
      if (!key) continue;
      const cands = byLayer.get(key) || [];
      const l = cands.length > 1 ? cands.find((c) => !c.match || c.match(props)) : cands.find((c) => !c.match || c.match(props));
      if (!l) continue;
      (out[l.id] ||= { layer: l, feats: [] }).feats.push(props);
    }
    return { ok: true, results: out };
  } catch (e) {
    console.warn('identify failed', e);
    return { ok: false, error: String(e), results: {} };
  }
}
export const wmuFromIdentify = (res) => res.results?.wmu?.feats?.[0]?.[WMU_FIELD] || null;

// ---- Waypoints & tracks ----
function addDataLayers() {
  map.addSource('tracks', { type: 'geojson', data: tracksGeo() });
  map.addLayer({ id: 'tracks-casing', type: 'line', source: 'tracks', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': 'rgba(0,0,0,.55)', 'line-width': 6 } });
  map.addLayer({ id: 'tracks-line', type: 'line', source: 'tracks', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 3.5 } });
  // Labels sit at each route's midpoint (line-placed labels drop out when a long name spans map tiles).
  map.addSource('tracks-mid', { type: 'geojson', data: tracksMid() });
  map.addLayer({ id: 'tracks-label', type: 'symbol', source: 'tracks-mid', minzoom: 10.5,
    layout: { 'text-field': ['get', 'label'], 'text-font': ['Open Sans Semibold'], 'text-size': 12, 'text-max-width': 12, 'text-offset': [0, -1.1], 'text-anchor': 'bottom', 'text-optional': true },
    paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(12,16,12,.9)', 'text-halo-width': 1.5 } });
  // Route drawing + elevation-profile cursor
  map.addSource('draw', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('draw-pts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('cursor', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'draw-casing', type: 'line', source: 'draw', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': 'rgba(0,0,0,.6)', 'line-width': 7 } });
  map.addLayer({ id: 'draw-line', type: 'line', source: 'draw', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffd23f', 'line-width': 4, 'line-dasharray': [2, 1.2] } });
  map.addLayer({ id: 'draw-pts', type: 'circle', source: 'draw-pts', paint: { 'circle-radius': ['case', ['==', ['get', 'end'], 1], 7, 5], 'circle-color': '#ffd23f', 'circle-stroke-color': '#111', 'circle-stroke-width': 2 } });
  map.addSource('spots', { type: 'geojson', data: spotsGeo() });
  // Waypoint badges: kind colour + animal/place silhouette, generated on demand (id 'hq|<kind>|<glyph>').
  map.on('styleimagemissing', (e) => {
    if (!e.id.startsWith('hq|')) return;
    const [, kind, glyph] = e.id.split('|');
    const { image, ratio } = badgeImage(glyph, kindColor(kind), { kill: kind === 'kill' });
    if (!map.hasImage(e.id)) map.addImage(e.id, image, { pixelRatio: ratio });
  });
  map.addLayer({ id: 'spots-dot', type: 'symbol', source: 'spots',
    layout: { 'icon-image': ['get', 'icon'], 'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.65, 11, 0.95, 14, 1.12], 'icon-allow-overlap': true, 'icon-ignore-placement': false,
      'symbol-sort-key': ['get', 'z'],
      'text-field': ['step', ['zoom'], '', 12, ['get', 'name']], 'text-font': ['Open Sans Semibold'], 'text-size': 12, 'text-offset': [0, 1.7], 'text-anchor': 'top', 'text-optional': true, 'text-max-width': 9 },
    paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(12,16,12,.9)', 'text-halo-width': 1.5 } });
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
  return { type: 'FeatureCollection', features: store.spots.filter(spotFilter).map((s) => ({ type: 'Feature', id: undefined, properties: { id: s.id, kind: s.kind, icon: `hq|${KINDS.some((k) => k.id === s.kind) ? s.kind : 'note'}|${glyphFor(s)}`, name: spotLabel(s), z: s.kind === 'kill' ? 3 : s.kind === 'sighting' ? 2 : 1 }, geometry: { type: 'Point', coordinates: [s.lon, s.lat] } })) };
}
function tracksGeo() {
  return { type: 'FeatureCollection', features: store.tracks.filter(trackFilter).map((t) => ({ type: 'Feature',
    properties: { id: t.id, name: t.name, color: MODES[t.extra?.mode]?.color || '#ff3d7f', label: [t.name, t.distance_km ? fmtKm(+t.distance_km) : ''].filter(Boolean).join(' · ') },
    geometry: { type: 'LineString', coordinates: (t.coords || []).map((c) => [c[0], c[1]]) } })) };
}
function tracksMid() {
  return { type: 'FeatureCollection', features: tracksGeo().features.filter((f) => f.geometry.coordinates.length > 1).map((f) => {
    const c = f.geometry.coordinates; let total = 0; const seg = c.slice(1).map((p, i) => { const d = Math.hypot(p[0] - c[i][0], (p[1] - c[i][1]) * 1.5); total += d; return d; });
    let acc = 0, i = 0; while (i < seg.length - 1 && acc + seg[i] < total / 2) acc += seg[i++];
    const t = seg[i] ? (total / 2 - acc) / seg[i] : 0; const a = c[i], b = c[i + 1];
    return { type: 'Feature', properties: f.properties, geometry: { type: 'Point', coordinates: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] } };
  }) };
}
let trackFilter = () => true;
export function setTrackFilter(fn) { trackFilter = fn || (() => true); refreshData(); }
export function setDraw(line, pts) { map.getSource('draw')?.setData(line); map.getSource('draw-pts')?.setData(pts); }
export function setCursor(lon, lat) {
  if (!map.getLayer('cursor-pt')) map.addLayer({ id: 'cursor-pt', type: 'circle', source: 'cursor', paint: { 'circle-radius': 8, 'circle-color': '#fff', 'circle-stroke-color': '#d4661c', 'circle-stroke-width': 4 } });
  map.getSource('cursor').setData(lon == null ? { type: 'FeatureCollection', features: [] } : { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lon, lat] } });
}
export function refreshData() {
  if (!map?.getSource('spots')) return;
  map.getSource('spots').setData(spotsGeo()); map.getSource('tracks').setData(tracksGeo()); map.getSource('tracks-mid')?.setData(tracksMid());
}
export function setSelection(fc) { map.getSource('sel')?.setData(fc || { type: 'FeatureCollection', features: [] }); if (!fc) selectWmu(null); }
export function setHotspots(fc) { map.getSource('hot')?.setData(fc || { type: 'FeatureCollection', features: [] }); }

export function spotPopupHTML(s) {
  const k = KINDS.find((x) => x.id === s.kind)?.name || s.kind;
  return `<div class="popup"><h4><span class="spot-badge" style="background:${kindColor(s.kind)}">${glyphSVG(glyphFor(s), { size: 20, color: "#fff", bg: kindColor(s.kind) })}</span> ${esc(spotLabel(s))}</h4>
  <dl><dt>Kind</dt><dd>${esc(k)}</dd>${s.species ? `<dt>Species</dt><dd>${esc(s.species)}${s.sex === 'M' || s.sex === 'F' ? ' · ' + esc(sexTerms(s.species)[s.sex === 'M' ? 0 : 1]) : ''}${s.extra?.points ? ' · ' + s.extra.points + ' pt' : ''}</dd>` : ''}
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
  map.fitBounds(b, { padding: 60, maxZoom: 14, duration: reducedMotion() ? 0 : 900 });
}
