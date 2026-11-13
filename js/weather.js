// Weather (Open-Meteo, no key) + an hour-by-hour movement index for big game.
// The movement index is a transparent rule-based estimate from known drivers (light, rut, temperature change,
// pressure, wind, precipitation, moon). It is NOT trained on trail-cam data; the UI says so.
import { rutStatus, solunar } from './rut.js?v=20261113080841-f7d0de8';

const H = 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation_probability,precipitation,snowfall,pressure_msl,cloud_cover,is_day,relative_humidity_2m';
const D = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset';
const C = 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,precipitation,is_day,relative_humidity_2m,cloud_cover';
const cache = new Map();
export function fetchWx(lat, lon) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`; const hit = cache.get(key);
  if (hit && Date.now() - hit.t < 20 * 60000) return hit.p;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&hourly=${H}&daily=${D}&current=${C}&timezone=auto&timeformat=unixtime&forecast_days=7&past_days=3&wind_speed_unit=kmh`;
  const p = fetch(url).then((r) => { if (!r.ok) throw new Error('Weather service ' + r.status); return r.json(); }).then(shape);
  p.catch(() => cache.delete(key));
  cache.set(key, { t: Date.now(), p }); return p;
}
function shape(j) {
  const h = j.hourly, d = j.daily;
  const hours = h.time.map((t, i) => ({ t: new Date(t * 1000), temp: h.temperature_2m[i], feels: h.apparent_temperature[i], code: h.weather_code[i], wind: h.wind_speed_10m[i], dir: h.wind_direction_10m[i],
    gust: h.wind_gusts_10m[i], pop: h.precipitation_probability[i], mm: h.precipitation[i], snow: h.snowfall[i], hpa: h.pressure_msl[i], cloud: h.cloud_cover[i], day: !!h.is_day[i], rh: h.relative_humidity_2m[i] }));
  const days = d.time.map((t, i) => ({ t: new Date(t * 1000), code: d.weather_code[i], hi: d.temperature_2m_max[i], lo: d.temperature_2m_min[i], mm: d.precipitation_sum[i], snow: d.snowfall_sum[i], pop: d.precipitation_probability_max[i],
    wind: d.wind_speed_10m_max[i], gust: d.wind_gusts_10m_max[i], dir: d.wind_direction_10m_dominant[i], sunrise: new Date(d.sunrise[i] * 1000), sunset: new Date(d.sunset[i] * 1000) }));
  const c = j.current;
  return { tz: j.utc_offset_seconds || 0, tzName: j.timezone, tzAbbr: j.timezone_abbreviation, elev: j.elevation, hours, days,
    now: { t: new Date(c.time * 1000), temp: c.temperature_2m, feels: c.apparent_temperature, code: c.weather_code, wind: c.wind_speed_10m, dir: c.wind_direction_10m, gust: c.wind_gusts_10m, hpa: c.pressure_msl, mm: c.precipitation, day: !!c.is_day, rh: c.relative_humidity_2m, cloud: c.cloud_cover } };
}

// ---- Display helpers ----
export const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const dirName = (deg) => DIRS[Math.round(deg / 22.5) % 16];
// Arrow points the way the wind is blowing (from `deg` toward the opposite side).
export const windArrow = (deg, size = 16) => `<svg class="wind-arrow" width="${size}" height="${size}" viewBox="0 0 24 24" style="transform:rotate(${deg}deg)" aria-hidden="true"><path d="M12 3v16M6 13l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export function wxName(code) {
  if (code === 0) return 'Clear'; if (code <= 2) return code === 1 ? 'Mostly clear' : 'Partly cloudy'; if (code === 3) return 'Cloudy';
  if (code <= 48) return 'Fog'; if (code <= 57) return 'Drizzle'; if (code <= 67) return code >= 66 ? 'Freezing rain' : 'Rain';
  if (code <= 77) return 'Snow'; if (code <= 82) return 'Rain showers'; if (code <= 86) return 'Snow showers'; return 'Thunderstorm';
}
const SUN = '<circle cx="12" cy="12" r="4.2" fill="#f4b740" stroke="none"/><path stroke="#f4b740" d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4 7 7M17 17l1.6 1.6M5.4 18.6 7 17M17 7l1.6-1.6"/>';
const MOON = '<path d="M17.5 14.6A6.6 6.6 0 0 1 9.4 6.5a6.6 6.6 0 1 0 8.1 8.1Z" fill="#cfd6e6" stroke="none"/>';
const CLOUD = (y = 0, f = '#aab3c2') => `<path d="M7 ${19 + y}h10.2a3.8 3.8 0 0 0 .5-7.6A5.4 5.4 0 0 0 7.4 12 3.6 3.6 0 0 0 7 ${19 + y}Z" fill="${f}" stroke="none"/>`;
export function wxIcon(code, day = true, size = 26) {
  let g;
  if (code === 0) g = day ? SUN : MOON;
  else if (code <= 2) g = `<g transform="translate(-3 -4) scale(.85)">${day ? SUN : MOON}</g>${CLOUD(1)}`;
  else if (code === 3) g = CLOUD(-1, '#9aa3b2');
  else if (code <= 48) g = `${CLOUD(-4)}<path stroke="#aab3c2" d="M4 19h16M6 22h12"/>`;
  else if ((code >= 71 && code <= 77) || code === 85 || code === 86) g = `${CLOUD(-4)}<g fill="#e8eef8" stroke="none"><circle cx="8" cy="19.5" r="1.3"/><circle cx="12" cy="21.5" r="1.3"/><circle cx="16" cy="19.5" r="1.3"/></g>`;
  else if (code >= 95) g = `${CLOUD(-4, '#7f8899')}<path d="m12.5 15.5-2.5 4h3l-2 4" stroke="#f4c430" stroke-width="1.8"/>`;
  else g = `${CLOUD(-4)}<path stroke="#5aa9ff" stroke-width="1.8" d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>`;
  return `<svg class="wx-ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">${g}</svg>`;
}
// Times are shown in the location's own clock using the forecast's UTC offset (device time-zone data can be stale).
const shift = (d, off) => new Date(d.getTime() + off * 1000);
export const tFmt = (d, off, o = {}) => shift(d, off).toLocaleTimeString('en-CA', { hour: 'numeric', minute: o.h ? undefined : '2-digit', timeZone: 'UTC' }).replace(/\s?([ap])\.?m\.?/i, o.h ? '$1m' : ' $1m');
export const dFmt = (d, off, o = { weekday: 'short' }) => shift(d, off).toLocaleDateString('en-CA', { ...o, timeZone: 'UTC' });
export const dayKey = (d, off) => shift(d, off).toISOString().slice(0, 10); // YYYY-MM-DD
export const hourIn = (d, off) => shift(d, off).getUTCHours();
// ---- Movement index ----
const gauss = (x, s) => Math.exp(-(x * x) / (2 * s * s));
const RUT_HOT = /seeking|chasing|peak|^rut$|breeding|building|early rut/i;
// How common the species is in this WMU, from harvest density vs. every other BC unit (0 = none recorded).
// Returns { f: multiplier, label, note } or null when there's no data for the species at all.
export function abundance(harvestData, sp, mu) {
  const key = sp === 'Black-tailed Deer' ? 'Mule Deer' : sp;
  const rows = harvestData?.species?.[key]; if (!rows || !mu) return null;
  const r = rows[mu];
  if (!r || !r.k) return { f: 0.3, label: 'Few or none', note: `no ${sp.toLowerCase()} harvest recorded in WMU ${mu}` };
  if (r.k < 2) return { f: 0.42, label: 'Very few', note: `very few ${sp.toLowerCase()} taken in WMU ${mu}` };
  const all = Object.values(rows).map((x) => x.kpa).filter((x) => x != null).sort((a, b) => a - b);
  const p = all.findIndex((x) => x >= r.kpa) / Math.max(1, all.length - 1);
  const label = p >= 0.8 ? 'High' : p >= 0.4 ? 'Average' : p >= 0.15 ? 'Low' : 'Very low';
  return { f: 0.55 + 0.45 * p, label, p, note: `${label.toLowerCase()} ${sp.toLowerCase()} numbers in WMU ${mu}` };
}
export function movement(wx, sp, lat, lon, abund = null) {
  const { hours, days, tz } = wx;
  const byDay = new Map(days.map((d) => [dayKey(d.t, tz), d]));
  // Recent baseline: mean of daily mean temps over the past 3 days + today.
  const mean = (d) => (d.hi + d.lo) / 2;
  const solCache = new Map();
  const sol = (dk, t) => { if (!solCache.has(dk)) solCache.set(dk, solunar(t, lat, lon)); return solCache.get(dk); };
  const out = hours.map((h, i) => {
    const dk = dayKey(h.t, tz); const d = byDay.get(dk); if (!d) return null;
    const di = days.indexOf(d); const base = days.slice(Math.max(0, di - 3), di).map(mean);
    const recent = base.length ? base.reduce((a, b) => a + b, 0) / base.length : mean(d);
    const f = [];
    const hr = (x) => (h.t - x) / 36e5;
    const crep = Math.max(gauss(hr(d.sunrise) - 0.3, 1.25), gauss(hr(d.sunset) + 0.1, 1.25));
    const dark = h.t < d.sunrise - 36e5 || h.t > +d.sunset + 36e5;
    let s = (dark ? 0.13 : 0.09) + 0.3 * crep;
    const rs = rutStatus(sp, h.t); const hot = rs?.cur && RUT_HOT.test(rs.cur.name);
    if (hot) { const add = 0.08 + 0.1 * (1 - crep) * (dark ? 0.3 : 1); s += add; f.push([add, `the ${rs.cur.name.toLowerCase()} phase of the rut`]); }
    const dev = mean(d) - recent;
    if (Math.abs(dev) >= 2) { const v = Math.max(-0.12, Math.min(0.12, -dev * 0.02)); s += v; f.push([v, dev < 0 ? `${Math.round(-dev)}° colder than recent days` : `${Math.round(dev)}° warmer than recent days`]); }
    if (h.temp > 14) { const v = -Math.min(0.12, (h.temp - 14) * 0.015); s += v; f.push([v, 'warm temperatures']); }
    const p3 = hours[i - 3]?.hpa; if (p3 != null) {
      const dp = h.hpa - p3;
      if (dp <= -1.5) { s += 0.05; f.push([0.05, 'falling pressure ahead of a front']); }
      else if (dp >= 1.2 && h.hpa < 1016) { s += 0.07; f.push([0.07, 'rising pressure after a front']); }
    }
    if (h.wind >= 30) { s -= 0.14; f.push([-0.14, `strong wind (${Math.round(h.wind)} km/h)`]); }
    else if (h.wind >= 20) { s -= 0.06; f.push([-0.06, `breezy (${Math.round(h.wind)} km/h)`]); }
    if (h.gust >= 55) { s -= 0.06; f.push([-0.06, 'gusts over 55 km/h']); }
    if (h.mm >= 2) { s -= 0.14; f.push([-0.14, 'heavy precipitation']); }
    else if (h.mm >= 0.4) { s -= 0.05; f.push([-0.05, h.snow > 0.2 ? 'steady snow' : 'steady rain']); }
    else { const prev = hours.slice(Math.max(0, i - 8), i).reduce((a, x) => a + (x.mm || 0), 0); if (prev >= 3) { s += 0.08; f.push([0.08, 'the storm clearing out']); } }
    const w = sol(dk, h.t).find((x) => h.t >= x.s && h.t <= x.e);
    if (w) { const v = w.kind === 'major' ? 0.04 : 0.02; s += v; f.push([v, `a solunar ${w.kind} (${w.what})`]); }
    if (abund) { const before = s; s *= abund.f; if (Math.abs(s - before) >= 0.02) f.push([s - before, abund.note]); }
    const legal = h.t >= d.sunrise - 18e5 && h.t <= +d.sunset + 18e5;
    return { ...h, pct: Math.round(Math.max(2, Math.min(90, s * 100))), f, legal, dk, crep };
  }).filter(Boolean);
  return out;
}
export const level = (p) => (p >= 65 ? 'Very high' : p >= 48 ? 'High' : p >= 28 ? 'Moderate' : 'Low');
export const levelCls = (p) => (p >= 65 ? 'vh' : p >= 48 ? 'hi' : p >= 28 ? 'md' : 'lo');
// Best legal-light hour for each day + a one-line "why".
export function bestByDay(mv, tz) {
  const m = new Map();
  for (const h of mv) { if (!h.legal) continue; const c = m.get(h.dk); if (!c || h.pct > c.best.pct) m.set(h.dk, { best: h, min: Math.min(c?.min ?? 99, h.pct), max: Math.max(c?.max ?? 0, h.pct) }); else { c.min = Math.min(c.min, h.pct); } }
  for (const [, v] of m) v.why = why(v.best, tz);
  return m;
}
export function why(h, tz) {
  const hh = hourIn(h.t, tz);
  const part = h.crep > 0.5 ? (hh < 12 ? 'first light' : 'last light') : hh < 11 ? 'the morning' : hh < 15 ? 'midday' : 'the afternoon';
  const pos = h.f.filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 2).map((x) => x[1]);
  const neg = h.f.filter((x) => x[0] < 0).sort((a, b) => a[0] - b[0]).slice(0, 2).map((x) => x[1]);
  let s = `Your best window is around ${part}`;
  if (pos.length) s += `, with ${pos.join(' and ')} helping`;
  if (neg.length) s += `${pos.length ? ',' : ','} though ${neg.join(' and ')} ${neg.length > 1 ? 'are' : 'is'} working against you`;
  return s + '.';
}
