// Data layer: Supabase (synced) or local mode (localStorage). Everything is cached in `store`.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=20261114194315-8bbd867';
import { uuid } from './util.js?v=20261114194315-8bbd867';

export const TABLES = { spots: 'hunt_spots', trips: 'hunt_trips', tracks: 'hunt_tracks', tags: 'hunt_tags', leh: 'hunt_leh' };
export const store = { spots: [], trips: [], tracks: [], tags: [], leh: [], prefs: {} };
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const emit = (what) => listeners.forEach((fn) => fn(what));

let sb = null; let mode = null; let user = null;
const LOCAL_KEY = 'hunthq_local_v1';

// ---- Offline: a copy of your data on the phone, plus changes waiting to upload (IndexedDB) ----
const idb = (() => {
  let P = null;
  const open = () => P || (P = new Promise((res, rej) => { const r = indexedDB.open('ridgeline', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (m, fn) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction('kv', m); const q = fn(t.objectStore('kv')); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }); };
  return { get: (k) => tx('readonly', (s) => s.get(k)).catch(() => null), set: (k, v) => tx('readwrite', (s) => s.put(v, k)).catch((e) => console.warn('idb', e)) };
})();
let offline = false; let outbox = []; let flushing = null;
const syncL = new Set();
export const onSync = (fn) => syncL.add(fn);
const syncEmit = () => syncL.forEach((fn) => fn({ offline, pending: outbox.length }));
export const syncState = () => ({ offline, pending: outbox.length });
const uk = (k) => `${k}:${user?.id || 'anon'}`;
let snapT = 0;
const snapshot = () => { if (mode !== 'remote') return; clearTimeout(snapT); snapT = setTimeout(() => idb.set(uk('snap'), JSON.parse(JSON.stringify(store))), 400); };
const saveOutbox = () => idb.set(uk('outbox'), outbox);
// A network failure (no signal, timeout), as opposed to the server refusing the change.
const isNet = (e) => !navigator.onLine || e?.name === 'TypeError' || e?.name === 'AbortError' || /fetch|network|load failed|timeout|offline/i.test(e?.message || String(e));
const timed = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
function queue(op) { outbox.push(op); saveOutbox(); offline = offline || !navigator.onLine; syncEmit(); snapshot(); }
const mustQueue = () => mode === 'remote' && (outbox.length > 0 || !navigator.onLine);

export function client() {
  if (!sb) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  return sb;
}
export const getMode = () => mode;
export const getUser = () => user;
// Shown on data pages in local mode so an empty list is never mistaken for lost data.
export const localNote = () => (mode === 'local' ? `<div class="local-note" role="note"><span>Local mode: showing what's saved in this browser only.</span><button class="small" data-signin>Sign in</button></div>` : '');

export async function restoreSession() {
  if (localStorage.getItem('hunthq_mode') === 'local') { mode = 'local'; return true; }
  try {
    const { data } = await timed(client().auth.getSession(), 6000);
    if (data.session) { user = data.session.user; mode = 'remote'; return true; }
  } catch (e) { console.warn(e); }
  // No signal: the saved sign-in can't be refreshed, but the user (and their saved data) is still known.
  if (localStorage.getItem('hunthq_mode') === 'remote') {
    try {
      const k = Object.keys(localStorage).find((x) => /^sb-.*-auth-token$/.test(x)); const s = k && JSON.parse(localStorage.getItem(k));
      const u = s?.user || s?.currentSession?.user; if (u?.id) { user = u; mode = 'remote'; offline = true; return true; }
    } catch {}
  }
  return false;
}
export async function signIn(email, password) {
  const { data, error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error; user = data.user; mode = 'remote'; localStorage.setItem('hunthq_mode', 'remote');
}
export async function signUp(email, password, name) {
  const { data, error } = await client().auth.signUp({ email, password, options: { emailRedirectTo: location.href.split('#')[0], data: name ? { name } : undefined } });
  if (error) throw error;
  if (data.session) { user = data.user; mode = 'remote'; localStorage.setItem('hunthq_mode', 'remote'); return true; }
  return false; // email confirmation required
}
export async function resetPassword(email) {
  const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] }); if (error) throw error;
}
export async function updatePassword(password) { const { error } = await client().auth.updateUser({ password }); if (error) throw error; }
// Fires when someone opens the reset link from their email.
export function onRecovery(fn) { client().auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') fn(); }); }
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

async function fetchRemote() {
  const keys = Object.keys(TABLES);
  const res = await Promise.all(keys.map((k) => fetchAll(TABLES[k])));
  const { data, error } = await client().from('hunt_prefs').select('*').maybeSingle(); if (error) throw error;
  keys.forEach((k, i) => (store[k] = res[i]));
  store.prefs = data?.data || {};
}
// Signed in: upload anything waiting, then load from the server. With no signal (or a 12 s stall) use the copy on the phone.
export async function loadAll() {
  if (mode === 'local') {
    const d = localLoad();
    for (const k of Object.keys(TABLES)) store[k] = d[k] || [];
    store.prefs = d.prefs || {};
  } else {
    outbox = (await idb.get(uk('outbox'))) || [];
    try {
      if (!navigator.onLine) throw new Error('offline');
      if (outbox.length) await flush();
      if (outbox.length) throw new Error('offline');
      await timed(fetchRemote(), 12000);
      offline = false; snapshot();
    } catch (e) {
      if (!isNet(e)) throw e;
      const snap = await idb.get(uk('snap'));
      if (!snap) throw new Error('No signal, and nothing saved on this phone yet');
      for (const k of Object.keys(TABLES)) store[k] = snap[k] || [];
      store.prefs = snap.prefs || {};
      offline = true;
    }
    syncEmit();
  }
  emit('all');
}

// Upload queued changes in order. Stops at the first network failure; a change the server refuses is dropped.
export function flush() {
  if (mode !== 'remote' || !outbox.length) return Promise.resolve(true);
  return (flushing ||= (async () => {
    try {
      while (outbox.length) {
        const op = outbox[0];
        try {
          if (op.op === 'insert') { const { error } = await client().from(TABLES[op.key]).upsert(op.rows.map(strip)); if (error) throw error; }
          else if (op.op === 'update') { const { error } = await client().from(TABLES[op.key]).update(op.patch).eq('id', op.id); if (error) throw error; }
          else if (op.op === 'remove') { const { error } = await client().from(TABLES[op.key]).delete().in('id', op.ids); if (error) throw error; }
          else if (op.op === 'prefs') {
            const { data: cur, error: e1 } = await client().from('hunt_prefs').select('data').maybeSingle(); if (e1) throw e1;
            const { error } = await client().from('hunt_prefs').upsert({ user_id: user.id, data: { ...(cur?.data || {}), ...op.patch }, updated_at: new Date().toISOString() }); if (error) throw error;
          }
        } catch (e) {
          if (isNet(e)) { offline = true; return false; }
          console.warn('Dropped a change the server refused', op, e);
        }
        outbox.shift(); await saveOutbox(); syncEmit();
      }
      offline = false; return true;
    } finally { flushing = null; syncEmit(); }
  })());
}
if (typeof window !== 'undefined') {
  addEventListener('online', () => { if (mode === 'remote') flush(); });
  addEventListener('offline', () => { if (mode === 'remote') { offline = true; syncEmit(); } });
  setInterval(() => { if (mode === 'remote' && outbox.length && navigator.onLine) flush(); }, 45000);
}
// Run a server write; if there's no signal, apply it here and queue it for later.
async function orQueue(run, op) {
  if (mustQueue()) { queue(op); return null; }
  try { return await run(); } catch (e) { if (isNet(e)) { queue(op); return null; } throw e; }
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
    const local = rows.map((r) => ({ created_at: new Date().toISOString(), ...r }));
    saved = await orQueue(async () => {
      const out = [];
      for (let i = 0; i < rows.length; i += 500) {
        const { data, error } = await client().from(TABLES[key]).upsert(rows.slice(i, i + 500).map(strip)).select();
        if (error) throw error; out.push(...data);
      }
      return out;
    }, { op: 'insert', key, rows: local });
    saved ||= local;
    store[key].push(...saved); snapshot();
  }
  emit(key); return saved;
}

export async function update(key, id, patch) {
  patch = strip(patch); delete patch.id; delete patch.created_at;
  let row;
  if (mode === 'local') {
    row = store[key].find((r) => r.id === id); Object.assign(row, patch); localSave();
  } else {
    const i = store[key].findIndex((r) => r.id === id);
    row = await orQueue(async () => { const { data, error } = await client().from(TABLES[key]).update(patch).eq('id', id).select().single(); if (error) throw error; return data; },
      { op: 'update', key, id, patch });
    row ||= Object.assign(store[key][i] || {}, patch);
    if (i >= 0) store[key][i] = row; snapshot();
  }
  emit(key); return row;
}

export async function remove(key, ids) {
  ids = Array.isArray(ids) ? ids : [ids];
  if (mode !== 'local') {
    await orQueue(async () => {
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await client().from(TABLES[key]).delete().in('id', ids.slice(i, i + 200));
        if (error) throw error;
      }
    }, { op: 'remove', key, ids });
  }
  const set = new Set(ids); store[key] = store[key].filter((r) => !set.has(r.id));
  if (mode === 'local') localSave(); else snapshot();
  emit(key);
}

export async function savePrefs(patch) {
  store.prefs = { ...store.prefs, ...patch };
  if (mode === 'local') localSave();
  else {
    await orQueue(async () => {
      // Read-merge-write so a stale tab can't wipe keys another device (or Claude) saved.
      const { data: cur, error: e1 } = await client().from('hunt_prefs').select('data').maybeSingle(); if (e1) throw e1;
      // Only the keys this call changes win; everything else comes from the server copy (stale tabs can't drop groups etc.).
      store.prefs = { ...(cur?.data || {}), ...patch };
      const { error } = await client().from('hunt_prefs').upsert({ user_id: user.id, data: store.prefs, updated_at: new Date().toISOString() });
      if (error) throw error;
    }, { op: 'prefs', patch });
    snapshot();
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
