// What's shown on the map: hide by hunt (trip), group, waypoint type, year or hunter.
// Stored in prefs.vis as lists of hidden keys so new hunts/groups/years show by default.
import * as db from './db.js?v=20261112232336-49fa4b1';
import { store } from './db.js?v=20261112232336-49fa4b1';
import * as M from './map.js?v=20261112232336-49fa4b1';
import { uuid } from './util.js?v=20261112232336-49fa4b1';

const KEYS = ['trips', 'groups', 'kinds', 'years', 'hunters', 'tracks'];
const vis = () => { const v = store.prefs.vis || {}; return Object.fromEntries(KEYS.map((k) => [k, new Set(v[k] || [])])); };

export const spotYear = (s) => {
  const d = s.observed_at || s.extra?.date_range?.[0] || (s.extra?.trip_id && store.trips.find((t) => t.id === s.extra.trip_id)?.date_start);
  return d ? String(new Date(d.length === 10 ? d + 'T12:00' : d).getFullYear()) : 'none';
};
export const tripOf = (s) => (s.extra?.trip_id ? store.trips.find((t) => t.id === s.extra.trip_id) : null);
export const groupOf = (s) => (s.extra?.group_id ? groups().find((g) => g.id === s.extra.group_id) : null);
export const groups = () => store.prefs.groups || [];
export const tripTitle = (t) => t.name || [t.area, t.species].filter(Boolean).join(' · ') || 'Hunt';
export const tripSpots = (t) => store.spots.filter((s) => s.extra?.trip_id === t.id);
// A hunt counts as a harvest if its result says so or it has a kill waypoint.
export const harvested = (t) => t.result === 'harvest' || store.spots.some((s) => s.kind === 'kill' && s.extra?.trip_id === t.id);

export function isVisible(s, v = vis()) {
  if (v.kinds.has(s.kind || 'note')) return false;
  if (v.hunters.has(s.hunter || 'Me')) return false;
  if (s.extra?.trip_id && v.trips.has(s.extra.trip_id)) return false;
  if (s.extra?.group_id && v.groups.has(s.extra.group_id)) return false;
  // Year filter applies to dated hunt finds; grouped "permanent" spots (camps, stands…) ignore it.
  if (!s.extra?.group_id && v.years.has(spotYear(s))) return false;
  return true;
}
export const shown = (kind, key) => !vis()[kind].has(key);

export function trackVisible(t, v = vis()) {
  if (v.kinds.has('route')) return false;
  if (t.extra?.trip_id && v.trips.has(t.extra.trip_id)) return false;
  if (t.extra?.group_id && v.groups.has(t.extra.group_id)) return false;
  return !v.tracks?.has(t.id);
}
export function apply() { const v = vis(); M.setSpotFilter((s) => isVisible(s, v)); M.setTrackFilter((t) => trackVisible(t, v)); }

let saveT;
export function setShown(kind, key, on) {
  const v = store.prefs.vis || {}; const set = new Set(v[kind] || []);
  on ? set.delete(key) : set.add(key);
  store.prefs.vis = { ...v, [kind]: [...set] };
  apply();
  clearTimeout(saveT); saveT = setTimeout(() => db.savePrefs({ vis: store.prefs.vis }).catch(console.warn), 600);
}
export function showAll() { store.prefs.vis = {}; apply(); db.savePrefs({ vis: {} }).catch(console.warn); }
export const anyHidden = () => KEYS.some((k) => (store.prefs.vis?.[k] || []).length);

// ---- Groups ----
const GROUP_COLORS = ['#2ca02c', '#1f77b4', '#9467bd', '#ff7f0e', '#17becf', '#8c564b', '#e377c2', '#7f7f7f'];
export async function addGroup(name) {
  const g = { id: 'grp_' + uuid().slice(0, 8), name: name.trim(), color: GROUP_COLORS[groups().length % GROUP_COLORS.length] };
  await db.savePrefs({ groups: [...groups(), g] }); return g;
}
export async function renameGroup(id, name) { await db.savePrefs({ groups: groups().map((g) => (g.id === id ? { ...g, name } : g)) }); }
export async function deleteGroup(id) {
  for (const s of store.spots.filter((x) => x.extra?.group_id === id)) { const extra = { ...s.extra }; delete extra.group_id; await db.update('spots', s.id, { extra }); }
  await db.savePrefs({ groups: groups().filter((g) => g.id !== id) });
}
