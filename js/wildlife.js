// Wildlife & harvest map layers: BC Hunter Sample harvest stats per WMU (choropleth), 2018 grizzly density by
// population unit, and aerial-survey density areas. Data files are built by hunt-hq-handoff/scripts/*.
import * as M from './map.js?v=20261113060050-30af831';

const cache = {};
const get = (k, url) => cache[k] || (cache[k] = fetch(url).then((r) => r.json()));
export const harvest = () => get('h', 'hunt-hq-handoff/data/harvest_wmu.json');
const grizzly = () => get('g', 'hunt-hq-handoff/data/grizzly_density_2018.geojson');
const surveys = () => get('s', 'hunt-hq-handoff/data/survey_density.geojson');

export const METRICS = {
  kpa: { name: 'Harvest density', unit: 'kills / 100 km²', help: 'Animals taken per 100 km² per year. Best free proxy for where animals are (and get hunted).' },
  succ: { name: 'Hunter success', unit: '% of hunters', help: 'Share of hunters who killed one (resident hunter survey).' },
  dpk: { name: 'Days per kill', unit: 'days', help: 'Hunter-days per animal taken. Lower is easier.', invert: true },
  hpa: { name: 'Hunting pressure', unit: 'hunters / 100 km²', help: 'Hunters per 100 km². Higher means more competition.' },
};
const RAMP = ['#fff3c4', '#fdd26a', '#f99b3c', '#e5582a', '#b5232b'];
const KEY = 'hunthq_wild';
export const state = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

function quantiles(vals, n = 5) {
  const v = vals.filter((x) => x != null && isFinite(x)).sort((a, b) => a - b); if (!v.length) return [];
  return Array.from({ length: n - 1 }, (_, i) => v[Math.floor(((i + 1) * v.length) / n)]);
}
export async function setChoropleth(species, metric) {
  state.sp = species; state.metric = metric; save();
  const m = M.map; if (!m.getSource('wmu-geo')) return;
  if (!m.getLayer('wmu-choro')) {
    m.addLayer({ id: 'wmu-choro', type: 'fill', source: 'wmu-geo', paint: { 'fill-color': '#000', 'fill-opacity': 0 } }, 'wmu-fill');
  }
  if (!species || !metric) { m.setPaintProperty('wmu-choro', 'fill-opacity', 0); state.legend = null; return null; }
  const h = await harvest(); const rows = h.species[species] || {};
  const breaks = quantiles(Object.values(rows).map((r) => r[metric]));
  const ramp = METRICS[metric].invert ? RAMP.slice().reverse() : RAMP;
  const expr = ['match', ['get', 'id']];
  for (const [mu, r] of Object.entries(rows)) {
    const v = r[metric]; if (v == null) continue;
    const i = breaks.findIndex((b) => v < b); expr.push(mu, ramp[i < 0 ? ramp.length - 1 : i]);
  }
  expr.push('rgba(0,0,0,0)');
  m.setPaintProperty('wmu-choro', 'fill-color', expr.length > 3 ? expr : '#000');
  m.setPaintProperty('wmu-choro', 'fill-opacity', expr.length > 3 ? 0.55 : 0);
  return { breaks, ramp, years: h.years };
}

export async function setGrizzly(on) {
  state.griz = on; save(); const m = M.map;
  if (on && !m.getSource('griz')) {
    m.addSource('griz', { type: 'geojson', data: await grizzly() });
    m.addLayer({ id: 'griz-fill', type: 'fill', source: 'griz', paint: { 'fill-color': ['interpolate', ['linear'], ['get', 'dens'], 0, '#f3e9dc', 10, '#d6a77a', 25, '#a0612f', 45, '#5b2c0f'], 'fill-opacity': 0.5 } }, 'wmu-fill');
    m.addLayer({ id: 'griz-line', type: 'line', source: 'griz', paint: { 'line-color': '#5b2c0f', 'line-width': 1 } }, 'wmu-fill');
    m.addLayer({ id: 'griz-label', type: 'symbol', source: 'griz', minzoom: 5.5, layout: { 'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'dens']], ' / 1000 km²'], 'text-font': ['Open Sans Semibold'], 'text-size': 11 },
      paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(40,20,5,.9)', 'text-halo-width': 1.4 } });
  }
  for (const id of ['griz-fill', 'griz-line', 'griz-label']) if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
}
export async function setSurveys(on) {
  state.surv = on; save(); const m = M.map;
  if (on && !m.getSource('surv')) {
    m.addSource('surv', { type: 'geojson', data: await surveys() });
    m.addLayer({ id: 'surv-fill', type: 'fill', source: 'surv', paint: { 'fill-color': '#7b3fb5', 'fill-opacity': 0.18 } }, 'wmu-fill');
    m.addLayer({ id: 'surv-line', type: 'line', source: 'surv', paint: { 'line-color': '#7b3fb5', 'line-width': 2, 'line-dasharray': [2, 1] } }, 'wmu-fill');
    m.addLayer({ id: 'surv-label', type: 'symbol', source: 'surv', minzoom: 6, layout: { 'text-field': ['concat', ['get', 'sp'], ' ', ['to-string', ['get', 'dens']], '/km² (', ['to-string', ['get', 'year']], ')'], 'text-font': ['Open Sans Semibold'], 'text-size': 11 },
      paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(40,10,60,.9)', 'text-halo-width': 1.4 } });
  }
  for (const id of ['surv-fill', 'surv-line', 'surv-label']) if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
}
// Re-apply saved choices after the map loads.
export async function restore() {
  if (state.sp && state.metric) await setChoropleth(state.sp, state.metric);
  if (state.griz) await setGrizzly(true);
  if (state.surv) await setSurveys(true);
}
export async function statsFor(mu) {
  const h = await harvest(); const out = [];
  for (const [sp, rows] of Object.entries(h.species)) if (rows[mu] && rows[mu].h >= 5) out.push({ sp, ...rows[mu] });
  return { years: h.years, rows: out.sort((a, b) => b.k - a.k) };
}
