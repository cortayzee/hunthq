// Data layer: Supabase (synced) or local mode (localStorage). Everything is cached in `store`.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=20261113010538-c99624f';
import { uuid } from './util.js?v=20261113010538-c99624f';

export const TABLES = { spots: 'hunt_spots', trips: 'hunt_trips', tracks: 'hunt_tracks', tags: 'hunt_tags', leh: 'hunt_leh' };
export const store = { spots: [], trips: [], tracks: [], tags: [], leh: [], prefs: {} };
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const emit = (what) => listeners.forEach((fn) => fn(what));

let sb = null; let mode = null; let user = null;
const LOCAL_KEY = 'hunthq_local_v1';

export function client() {
  if (!sb) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  return sb;
}
export const getMode = () => mode;
export const getUser = () => user;

export async function restoreSession() {
  if (localStorage.getItem('hunthq_mode') === 'local') { mode = 'local'; return true; }
  try {
    const { data } = await client().auth.getSession();
    if (data.session) { user = data.session.user; mode = 'remote'; return true; }
  } catch (e) { console.warn(e); }
  return false;
}
export async function signIn(email, password) {
  const { data, error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error; user = data.user; mode = 'remote'; localStorage.setItem('hunthq_mode', 'remote');
}
export async function signUp(email, password) {
  const { data, error } = await client().auth.signUp({ email, password, options: { emailRedirectTo: location.href.split('#')[0] } });
  if (error) throw error;
  if (data.session) { user = data.user; mode = 'remote'; localStorage.setItem('hunthq_mode', 'remote'); return true; }
  return false; // email confirmation required
}
export function useLocal() { mode = 'local'; localStorage.setItem('hunthq_mode', 'local'); }
export async function signOut() {
  if (mode === 'remote') await client().auth.signOut();
  localStorage.removeItem('hunthq_mode'); mode = null; user = null;
}

function localLoad() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; } catch { return {}; } }
function localSave() { localStorage.setItem(LOCAL_KEY, JSON.stringify(store)); }

async function fetchAll(table) {
  const out = []; const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await client().from(table).select('*').order('created_at', { ascending: true }).range(from, from + size - 1);
    if (error) throw error; out.push(...data); if (data.length < size) break;
  }
  return out;
}

export async function loadAll() {
  if (mode === 'local') {
    const d = localLoad();
    for (const k of Object.keys(TABLES)) store[k] = d[k] || [];
    store.prefs = d.prefs || {};
  } else {
    const keys = Object.keys(TABLES);
    const res = await Promise.all(keys.map((k) => fetchAll(TABLES[k])));
    keys.forEach((k, i) => (store[k] = res[i]));
    const { data } = await client().from('hunt_prefs').select('*').maybeSingle();
    store.prefs = data?.data || {};
  }
  emit('all');
}

const strip = (row) => { const r = { ...row }; delete r.user_id; return r; };

export async function insert(key, rows) {
  rows = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ ...r, id: r.id || uuid() }));
  if (!rows.length) return [];
  let saved;
  if (mode === 'local') {
    saved = rows.map((r) => ({ created_at: new Date().toISOString(), ...r }));
    store[key].push(...saved); localSave();
  } else {
    saved = [];
    for (let i = 0; i < rows.length; i += 500) {
      const { data, error } = await client().from(TABLES[key]).insert(rows.slice(i, i + 500).map(strip)).select();
      if (error) throw error; saved.push(...data);
    }
    store[key].push(...saved);
  }
  emit(key); return saved;
}

export async function update(key, id, patch) {
  patch = strip(patch); delete patch.id; delete patch.created_at;
  let row;
  if (mode === 'local') {
    row = store[key].find((r) => r.id === id); Object.assign(row, patch); localSave();
  } else {
    const { data, error } = await client().from(TABLES[key]).update(patch).eq('id', id).select().single();
    if (error) throw error; row = data;
    const i = store[key].findIndex((r) => r.id === id); store[key][i] = row;
  }
  emit(key); return row;
}

export async function remove(key, ids) {
  ids = Array.isArray(ids) ? ids : [ids];
  if (mode !== 'local') {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await client().from(TABLES[key]).delete().in('id', ids.slice(i, i + 200));
      if (error) throw error;
    }
  }
  const set = new Set(ids); store[key] = store[key].filter((r) => !set.has(r.id));
  if (mode === 'local') localSave();
  emit(key);
}

export async function savePrefs(patch) {
  store.prefs = { ...store.prefs, ...patch };
  if (mode === 'local') localSave();
  else {
    // Read-merge-write so a stale tab can't wipe keys another device (or Claude) saved.
    const { data: cur } = await client().from('hunt_prefs').select('data').maybeSingle();
    store.prefs = { ...(cur?.data || {}), ...store.prefs, ...patch };
    const { error } = await client().from('hunt_prefs').upsert({ user_id: user.id, data: store.prefs, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
  emit('prefs');
}

export const hunters = () => [...new Set(['Me', ...['spots', 'trips', 'tracks', 'tags', 'leh'].flatMap((k) => store[k].map((r) => r.hunter)).filter(Boolean)])].sort((a, b) => (a === 'Me' ? -1 : b === 'Me' ? 1 : a.localeCompare(b)));

// Backup: full JSON of all tables + prefs. Restore inserts rows whose id isn't already present.
export function backupJSON() {
  return JSON.stringify({ app: 'hunt-hq', version: 1, exported_at: new Date().toISOString(), ...Object.fromEntries(Object.keys(TABLES).map((k) => [k, store[k]])), prefs: store.prefs }, null, 1);
}
export async function restoreJSON(obj) {
  const counts = {};
  for (const k of Object.keys(TABLES)) {
    const have = new Set(store[k].map((r) => r.id));
    const rows = (obj[k] || []).filter((r) => !have.has(r.id)).map((r) => { const x = { ...r }; delete x.user_id; return x; });
    if (rows.length) await insert(k, rows);
    counts[k] = rows.length;
  }
  if (obj.prefs && Object.keys(obj.prefs).length) await savePrefs({ ...obj.prefs, ...store.prefs });
  return counts;
}
