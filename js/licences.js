// Licences that expire: PAL (firearms) and the BC hunting licence. Stored in prefs.licences. Reminders are in-app
// (a dot on More, a once-a-day note) plus an optional calendar file, since a web page can't send notifications.
import { store } from './db.js?v=20261113175850-e805291';
import * as db from './db.js?v=20261113175850-e805291';

export const TYPES = {
  pal: { name: 'Firearms licence (PAL)', warn: 180, help: 'Renew before it expires. If a PAL lapses you have to apply for a new one from scratch, and you can’t legally possess firearms until it’s issued. RCMP takes weeks to process a renewal, so start about 3–6 months ahead.' },
  hunting: { name: 'BC hunting licence', warn: 45, help: 'BC hunting licences run April 1 to March 31. Buy the new one (and species licences) on WILD before you hunt after April 1.' },
  residency: { name: 'WILD residency status', warn: 60, help: 'Your BC resident status in WILD expires. Renew it in WILD > Renew/Change Residency by uploading proof of residency (for example a BC driver’s licence or BC Services Card). With it expired you can’t buy resident licences or apply for LEH, so renew before the LEH deadline in June.' },
  other: { name: 'Other licence', warn: 60, help: '' },
};
export const list = () => store.prefs.licences || [];
export const save = (ls) => db.savePrefs({ licences: ls });
const DAY = 864e5;
export function status(l) {
  if (!l.expires) return { cls: '', label: 'No expiry date', days: null };
  const days = Math.ceil((new Date(l.expires + 'T23:59') - Date.now()) / DAY);
  const warn = TYPES[l.type]?.warn ?? 60;
  if (days < 0) return { cls: 'bad', label: 'Expired', days };
  if (days <= warn) return { cls: 'warn', label: days <= 1 ? 'Expires today' : `Renew: ${days} days left`, days };
  return { cls: 'ok', label: 'Valid', days };
}
export const due = () => list().filter((l) => ['warn', 'bad'].includes(status(l).cls));
export const nextHuntingExpiry = () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() + 1 : d.getFullYear(); return `${y}-03-31`; };

// .ics with two alarms (6 and 1 months for a PAL; 2 weeks and 1 day otherwise).
export function ics(l) {
  const t = TYPES[l.type] || TYPES.other; const name = l.name || t.name;
  const d = l.expires.replace(/-/g, ''); const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const alarms = (l.type === 'pal' ? ['-P180D', '-P30D'] : ['-P14D', '-P1D']).map((tr) => `BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Renew ${name}\r\nTRIGGER:${tr}\r\nEND:VALARM`).join('\r\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ridgeline//Licences//EN', 'BEGIN:VEVENT', `UID:${l.id}@ridgeline`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d}`, `SUMMARY:${name} expires`, `DESCRIPTION:${(t.help || 'Renew before it expires.').replace(/[,;]/g, '\\$&')}`, alarms, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
