export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function html(strings, ...vals) {
  return strings.reduce((a, s, i) => a + s + (i < vals.length ? (vals[i]?.__raw ?? esc(vals[i])) : ''), '');
}
export const raw = (s) => ({ __raw: s });

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
}));

export const pad = (n) => String(n).padStart(2, '0');
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const localDT = (d) => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const TZ = 'America/Vancouver';
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: TZ }) : '';
export const fmtDT = (d) => d ? new Date(d).toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '';
export const fmtTime = (d) => (d && !isNaN(d)) ? d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '—';
export const yearOf = (d) => d ? new Date(d).getFullYear() : null;
export const num = (v) => (v === '' || v == null || isNaN(+v)) ? null : +v;

export function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('off');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('off'), ms);
}

// Modals track unsaved edits: closing by backdrop / ✕ / Esc asks first instead of silently dropping changes.
export function modal(content, { wide = false } = {}) {
  const m = $('#modal'); const body = $('#modalBody');
  body.innerHTML = ''; if (typeof content === 'string') body.innerHTML = content; else body.append(content);
  m.querySelector('.modal-card').classList.toggle('wide', wide);
  m.classList.remove('hidden'); m.classList.remove('dirty'); m.dataset.dirty = '';
  const mark = (e) => { if (e.target.closest('form')) markDirty(); };
  body.addEventListener('input', mark); body.addEventListener('change', mark);
  import('./icons.js?v=20261112230233-4f3bcaf').then((i) => i.hydrateIcons(body));
  return body;
}
export function markDirty() { const m = $('#modal'); m.dataset.dirty = '1'; m.classList.add('dirty'); }
export const closeModal = () => { const m = $('#modal'); m.classList.add('hidden'); m.dataset.dirty = ''; m.classList.remove('dirty'); };
export function requestClose() {
  const m = $('#modal'); if (m.classList.contains('hidden')) return;
  if (m.dataset.dirty && !confirm('You have unsaved changes. Discard them?')) return;
  closeModal();
}

export function download(name, text, type = 'application/octet-stream') {
  const blob = text instanceof Blob ? text : new Blob([text], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else o[el.name] = el.value === '' ? null : el.value;
  }
  return o;
}

export function opts(list, sel, { blank = false } = {}) {
  const items = list.map((x) => (typeof x === 'string' ? { id: x, name: x || '—' } : x));
  return (blank ? '<option value=""></option>' : '') + items.map((x) => `<option value="${esc(x.id)}" ${String(x.id) === String(sel ?? '') ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
}

export function haversineKm(a, b) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toR, dLon = (b[0] - a[0]) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Minimal CSV parser (quotes, commas, newlines in quotes).
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  const delim = (text.split('\n')[0].match(/\t/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? '\t' : ',';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!clean.length) return [];
  const head = clean[0].map((h) => h.trim());
  return clean.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

export function toCSV(rows, cols) {
  cols = cols || [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const q = (v) => { v = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n');
}

export const earthLink = (lat, lon, alt = 1000) => `https://earth.google.com/web/@${(+lat).toFixed(6)},${(+lon).toFixed(6)},${alt}a,1500d,35y,0h,45t,0r`;

export function parseLatLon(s) {
  if (!s) return null;
  const m = String(s).match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  let a = +m[1], b = +m[2];
  // BC: lat ~48–60, lon ~-139…-114. Accept either order.
  if (Math.abs(a) > 90 || (a < 0 && b > 0)) [a, b] = [b, a];
  return { lat: a, lon: b };
}

export function groupBy(arr, fn) {
  const m = new Map();
  for (const x of arr) { const k = fn(x); if (k == null) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}
