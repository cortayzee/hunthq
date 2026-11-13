// Road access per WMU / LEH zone (data/access.json, built by hunt-hq-handoff/scripts/build_access.py from the BC road atlas).
// g = paved + gravel km per 100 km², d = all drivable (incl. rough/4x4) km per 100 km².
let DATA = null, P = null;
export const loadAccess = () => P || (P = fetch('hunt-hq-handoff/data/access.json').then((r) => r.json()).then((j) => (DATA = j)).catch(() => (DATA = { wmu: {}, leh: {} })));
export const LEVELS = {
  easy: { name: 'Easy access', cls: 'ok', help: 'A good network of paved and gravel roads.' },
  rough: { name: 'Rough roads', cls: 'warn', help: 'Roads exist, but many are rough 4x4 or overgrown. Plan on a truck or ATV and some walking.' },
  remote: { name: 'Remote', cls: 'bad', help: 'Few mapped roads, or roads that don’t connect to the highway network. Expect a long hike, boat or fly-in.' },
};
// remote: few roads, or almost no paved road and little gravel (typical of coastal inlets reached by boat).
export function level(rec) { if (!rec) return null; if (rec.d < 15 || (rec.p < 5 && rec.g < 15)) return 'remote'; return rec.g >= 20 ? 'easy' : 'rough'; }
export const forWmu = (mu) => DATA?.wmu?.[mu] || null;
export const forKey = (key, mu) => DATA?.leh?.[key] || DATA?.wmu?.[mu] || null;
export function detail(rec) {
  if (!rec) return '';
  const lv = LEVELS[level(rec)];
  return `${lv.help} About ${rec.g} km of paved and gravel road per 100 km² (${rec.d} km counting rough 4x4 roads) over ${rec.a.toLocaleString('en-CA')} km². From the BC road atlas: gates, washouts, motor vehicle closures and private land aren't counted, so check before you go.`;
}
