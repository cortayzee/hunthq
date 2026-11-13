// Bag limits (2026–2028 BC Hunting & Trapping Regulations Synopsis, pp. 13–14) and the user's own tally against them.
import { store } from './db.js?v=20261113160120-5c3f45d';

// Provincial bag limits per licence year. Regional limits can be lower (see the synopsis region sections).
export const PROVINCIAL = { Deer: 3, Elk: 1, Moose: 1, 'Black Bear': 2, Cougar: 2, Wolf: 3, 'Mountain Goat': 1, 'Mountain Sheep': 1, Caribou: 1, Bison: 1, Bobcat: 5, Lynx: 1, Wolverine: 1 };
// Deer, per region: mule (black-tailed) bucks / antlerless / total, white-tailed bucks / antlerless / total, all deer.
// Mule bucks in Regions 3–8 share one combined limit of 1 (MULE_BUCK_3_8).
export const DEER = {
  1: { mb: 2, ma: 2, mt: 3, wb: 0, wa: 0, wt: 0, all: 3 },
  2: { mb: 2, ma: 1, mt: 2, wb: 0, wa: 0, wt: 0, all: 2 },
  3: { mb: null, ma: 1, mt: 1, wb: 2, wa: 2, wt: 2, all: 3 },
  4: { mb: null, ma: 0, mt: 1, wb: 1, wa: 1, wt: 2, all: 2, note: 'One extra deer (any) is allowed in the Jan 5–31 Cranbrook deer hunt, within the provincial limit of 3.' },
  5: { mb: null, ma: 1, mt: 2, wb: 1, wa: 1, wt: 2, all: 3 },
  6: { mb: null, ma: 1, mt: 2, wb: 1, wa: 1, wt: 2, all: 3, note: 'Haida Gwaii has its own deer limits.' },
  '7A': { mb: null, ma: 1, mt: 1, wb: 1, wa: 1, wt: 2, all: 3 },
  '7B': { mb: null, ma: 1, mt: 1, wb: 1, wa: 1, wt: 2, all: 2 },
  8: { mb: null, ma: 1, mt: 1, wb: 1, wa: 1, wt: 2, all: 3 },
};
export const MULE_BUCK_3_8 = 1;
export const REGION_NAMES = { 1: 'Vancouver Island', 2: 'Lower Mainland', 3: 'Thompson', 4: 'Kootenay', 5: 'Cariboo', 6: 'Skeena', '7A': 'Omineca', '7B': 'Peace', 8: 'Okanagan' };
// Species you can buy a licence (tag) for, in the order hunters think about them.
export const TAG_SPECIES = ['White-tailed Deer', 'Mule Deer', 'Elk', 'Moose', 'Black Bear', 'Cougar', 'Wolf', 'Mountain Goat', 'Mountain Sheep', 'Caribou', 'Bison', 'Turkey'];

// BC licence year runs April 1 to March 31; we name it by its starting year (2026 = 2026–27).
export const licenceYear = (d) => { const x = d instanceof Date ? d : new Date(d); return x.getMonth() >= 3 ? x.getFullYear() : x.getFullYear() - 1; };
export const yearLabel = (y) => `${y}–${String(y + 1).slice(2)}`;
export const regionOf = (mu) => { const m = /^(\d)-(\d+)/.exec(mu || ''); if (!m) return null; return m[1] === '7' ? (+m[2] <= 30 ? '7A' : '7B') : m[1]; };
const isDeer = (sp) => /deer/i.test(sp || '');
export const deerKind = (sp) => (/white/i.test(sp || '') ? 'wt' : 'mule');
export const speciesGroup = (sp) => (isDeer(sp) ? 'Deer' : sp);

export const myNames = () => ['me', ...String(store.prefs.myName || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)];
const isMine = (h) => myNames().includes(String(h || 'Me').trim().toLowerCase());
const killDate = (s) => {
  if (s.observed_at) return new Date(s.observed_at);
  if (s.extra?.date_range?.[0]) return new Date(s.extra.date_range[0] + 'T12:00');
  const t = store.trips.find((x) => x.id === s.extra?.trip_id); return t?.date_start ? new Date(t.date_start + 'T12:00') : null;
};
// Antlerless if logged as female or named doe/cow/antlerless; otherwise a buck/bull.
const isAntlerless = (s) => s.sex === 'F' || /\b(doe|cow|antlerless|fawn|calf)\b/i.test(s.name || '');

export function myKills(year) {
  return store.spots.filter((s) => s.kind === 'kill' && s.species && isMine(s.hunter))
    .map((s) => ({ s, d: killDate(s) })).filter((k) => k.d && licenceYear(k.d) === year)
    .sort((a, b) => a.d - b.d);
}

// Each kill fills the oldest open tag of the same species; tags marked filled by hand count too.
export function tagStatus(year) {
  const tags = store.tags.filter((t) => +t.year === year && isMine(t.hunter)).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const by = new Map(tags.map((t) => [t.id, null]));
  const left = [];
  for (const k of myKills(year)) {
    const t = tags.find((x) => by.get(x.id) == null && !x.filled && sameSpecies(x.species, k.s.species));
    if (t) by.set(t.id, k); else left.push(k);
  }
  return { tags: tags.map((t) => ({ t, kill: by.get(t.id), filled: !!t.filled || !!by.get(t.id) })), untagged: left };
}
const sameSpecies = (a, b) => { const A = (a || '').toLowerCase(), B = (b || '').toLowerCase(); if (isDeer(A) && isDeer(B)) return deerKind(A) === deerKind(B); return A === B || A.includes(B) || B.includes(A); };

// Tally against provincial + regional limits for the licence year.
export function tally(year) {
  const kills = myKills(year);
  const deer = kills.filter((k) => isDeer(k.s.species));
  const reg = {};
  for (const k of deer) {
    const r = regionOf(k.s.wmu) || '?'; const o = (reg[r] ||= { mb: 0, ma: 0, wb: 0, wa: 0 });
    const kind = deerKind(k.s.species), anl = isAntlerless(k.s);
    o[(kind === 'wt' ? 'w' : 'm') + (anl ? 'a' : 'b')]++;
  }
  const muleBuck38 = deer.filter((k) => deerKind(k.s.species) === 'mule' && !isAntlerless(k.s) && !['1', '2'].includes(regionOf(k.s.wmu))).length;
  const other = {};
  for (const k of kills) if (!isDeer(k.s.species)) other[k.s.species] = (other[k.s.species] || 0) + 1;
  return { kills, deer: { total: deer.length, wt: deer.filter((k) => deerKind(k.s.species) === 'wt').length, mule: deer.filter((k) => deerKind(k.s.species) === 'mule').length, muleBuck38, reg }, other };
}

// What's still allowed in one region (deer) given this year's tally.
export function deerLeftIn(region, T) {
  const L = DEER[region]; if (!L) return null;
  const r = T.deer.reg[region] || { mb: 0, ma: 0, wb: 0, wa: 0 };
  const provLeft = PROVINCIAL.Deer - T.deer.total;
  const regAll = L.all - (r.mb + r.ma + r.wb + r.wa);
  const cap = (x) => Math.max(0, Math.min(x, provLeft, regAll));
  const muleBuckCap = L.mb != null ? L.mb - r.mb : MULE_BUCK_3_8 - T.deer.muleBuck38;
  const mule = cap(L.mt - (r.mb + r.ma)); const wt = cap(L.wt - (r.wb + r.wa));
  return { region, L, r, provLeft: Math.max(0, provLeft), all: Math.max(0, Math.min(regAll, provLeft)),
    mule, muleBuck: Math.max(0, Math.min(mule, muleBuckCap)), muleAnl: Math.max(0, Math.min(mule, L.ma - r.ma)),
    wt, wtBuck: Math.max(0, Math.min(wt, L.wb - r.wb)), wtAnl: Math.max(0, Math.min(wt, L.wa - r.wa)) };
}
