// Animal + place silhouettes for map markers and pickers. Drawn as solid shapes (not thin outlines) so they read
// at a glance: each animal has its own tell (moose bell + palm antlers, elk sweeping rack, bear hump, curled ram horn…).
// Coordinates are a 64×64 box, animal facing left, ground at y≈56. `f` = filled paths, `s` = stroked paths.
const leg = (t, b) => `M23 ${b} Q23 ${t} 30 ${t} L46 ${t} Q52 ${t} 52.5 ${t + 5} L54 ${t + 3.5} L54.5 ${t + 6} L52.5 ${t + 10} L52 ${b} L50 ${b + 2} L50 56 L47 56 L46.5 ${b + 2} L45 ${b + 2} L45 56 L42 56 L41.5 ${b} L33 ${b} L32 56 L29 56 L28.5 ${b + 1} L27 ${b + 1} L27 56 L24 56 L23.5 ${b} Z`;

export const ANIMALS = {
  deer: { name: 'Deer', f: [leg(28, 40), 'M23 34 L27 31 L22.5 17 L18 18 Z', 'M22.5 16 Q20 14 16.5 15 L9 19 Q8 21 10 21.5 L18.5 22 L23.5 20 Z', 'M21.5 15 L27.5 11.5 L25 16.5 Z'],
    s: ['M20.5 15 C18 9 13 8.5 10.5 11.5', 'M15.6 9.6 L14.6 5.4', 'M18.5 10.4 L19 6.4', 'M12.6 10 L12 7'], sw: 2.4 },
  elk: { name: 'Elk', f: [leg(23, 40), 'M23 33 L31 25.5 L24 13.5 L16.5 16 Z', 'M22.5 13.5 Q19 11.5 15 12.5 L5.5 17.5 Q4.5 20.5 7 21 L17 21 L24 17.5 Z', 'M21 12.5 L26 9 L24.5 14 Z', 'M23 30 L31 25 L33 31 Z'],
    s: ['M20 12.5 C20 5 27 1.5 42 3.5', 'M20.1 8.8 L13 6', 'M21.8 5.6 L15.5 1.8', 'M27 2.6 L26.6 0', 'M33 2.4 L34 0', 'M38.5 3 L40 0.8'], sw: 2.5 },
  moose: { name: 'Moose', f: [leg(25, 38), 'M28 25 Q34 18 41 24 Z', 'M23 32 L31 26 L25 18 L18 20 Z', 'M24 17 Q18 15.5 14 18 L6.5 24 Q5.5 28.5 9 28.5 L13 27.5 L18 25.5 L25 22 Z', 'M16.5 25 L15.5 32 L19 31 L19.5 25 Z',
    'M21 18 Q15 10 8.5 12.5 L10 9.5 L6.5 7.5 L11 6.5 L9 3 L14 5 L15 1.5 L18.5 6 Q22.5 10 22.5 16 Z'], s: [] },
  caribou: { name: 'Caribou', f: [leg(27, 40), 'M23 33 L28 29 L22.5 16 L17 18 Z', 'M22 15.5 Q19 13.5 15.5 14.5 L8 18.5 Q7 21 9.5 21 L18 21.5 L23 19 Z', 'M17 21 L18 27 L21 24 Z'],
    s: ['M20 14 C14 9 18 3 26 2', 'M16.2 9 L11 9', 'M18 5.2 L13.5 4', 'M22.5 2.6 L22 0.7', 'M19 13 L14 13.5'] },
  bear: { name: 'Bear', f: ['M18 37 Q16 26 26 22 Q33 17 42 21 Q53 23 53.5 33 L53.5 42 L50.5 44 L50.5 56 L45 56 L44 45.5 L33 45.5 L32 56 L26.5 56 L25.5 44.5 L21.5 42 Z',
    'M21 31 Q14 26 8 30 L4.5 33 Q4.5 36.5 8 36.5 L14 37.5 L22.5 38.5 Z', 'M13.5 27.5 L14.5 23.5 L18.5 27 Z'], s: [] },
  sheep: { name: 'Sheep', f: [leg(29, 41), 'M23 35 L27 32 L22.5 22 L17 24 Z', 'M21.5 22 Q18 21 15 22 L9.5 26 Q8.5 28.5 11 28.5 L17 28.5 L22.5 26 Z'],
    s: ['M20 21.5 C23 13 33 15 30.5 23.5 C28.5 29 21.5 28.5 22 24'], sw: 3.6 },
  goat: { name: 'Mountain goat', f: [leg(28, 41), 'M24 29 Q29 21.5 35 28 Z', 'M23 36 L28 31 L22.5 20 L17 22 Z', 'M21.5 20 Q18 19 15 20 L9 26 Q8 28.5 10.5 28.5 L15 27.5 L22.5 24 Z', 'M10 28 L11.5 34.5 L15 28 Z', 'M23.5 41 L24 46 L28.5 42 L33 46 L33.5 41 Z'],
    s: ['M19 20 Q18.5 13.5 22.5 11.5'] },
  wolf: { name: 'Wolf / coyote', f: [leg(30, 40), 'M52 32 Q61 36 58.5 47 Q55.5 41 51 37 Z', 'M24 35 L28.5 31 L23.5 25 L19 27 Z', 'M23.5 24 Q20 23 17 24 L7.5 28 L8.5 30.5 L18 31.5 L24.5 29.5 Z', 'M19 25 L19.5 18.5 L23.5 24 Z'], s: [] },
  cougar: { name: 'Cougar / cat', f: [leg(31, 41), 'M24 34.5 Q22.5 27 16.5 28 Q11 29 11 33.5 Q12 37.5 17 37.5 L24.5 38.5 Z', 'M16.5 28.3 L18 24.5 L21 28 Z'],
    s: ['M52 34 Q61 40 57.5 51 Q56.5 55 60.5 54'], sw: 3.4 },
  grouse: { name: 'Grouse / upland', f: ['M14 34 Q14 24 26 24 Q38 24 46 30 L58 25 L54.5 36.5 Q48 45 32 45 Q18 45 14 34 Z', 'M14 22 m-5.5 0 a5.5 5.5 0 1 0 11 0 a5.5 5.5 0 1 0 -11 0', 'M9 20.5 L4.5 23 L9 24.5 Z'],
    s: ['M28 44 L27.5 54', 'M35 44 L36 54'] },
  turkey: { name: 'Turkey', f: ['M40 33 L33 9 L41 7 L47 9 L53 13 L57 19 L58 26 Z', 'M14 36 Q14 26 26 26 Q38 26 44 32 L44 40 Q40 46 30 46 Q17 46 14 36 Z', 'M16 30 L13 18 L17 17 L19 29 Z', 'M15 16 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0', 'M11 14.5 L7.5 16.5 L11 18 Z', 'M12.5 19 Q11.5 23 13.5 24 L14 19 Z'],
    s: ['M27 45 L26.5 54', 'M33 45 L34 54'] },
  duck: { name: 'Duck / goose', f: ['M10 41 Q10 33 22 33 L44 33 Q53 33 58 37 Q55 47 40 47 L20 47 Q10 47 10 41 Z', 'M16 26 m-6.5 0 a6.5 6.5 0 1 0 13 0 a6.5 6.5 0 1 0 -13 0', 'M10 25 L2.5 28 L10.5 30 Z', 'M13 30 L19.5 35 L22.5 30 Z'], s: [] },
  hare: { name: 'Hare', f: ['M16 44 Q14 30 30 28 Q46 27 50 38 Q52 46 46 48 L22 48 Q16 48 16 44 Z', 'M20 30 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0', 'M16 25 Q14 9 19 8 Q21 12 20 25 Z', 'M21 25 Q22 10 27 10 Q27 15 24 26 Z', 'M50 38 m-3.5 0 a3.5 3.5 0 1 0 7 0 a3.5 3.5 0 1 0 -7 0', 'M20 46 L13 50 L26 50 Z'], s: [] },
  // Places / non-animal kinds
  camp: { name: 'Camp', f: ['M32 8 L58 52 L6 52 Z'], cut: ['M32 30 L41 52 L23 52 Z'], s: ['M32 8 L28 2', 'M32 8 L36 2'] },
  trailcam: { name: 'Trail cam', f: ['M12 18 Q12 14 16 14 L48 14 Q52 14 52 18 L52 48 Q52 52 48 52 L16 52 Q12 52 12 48 Z'], cut: ['M32 35 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0', 'M17 19 L25 19 L25 24 L17 24 Z'], dot: [32, 35, 5.5] },
  stand: { name: 'Stand / blind', f: ['M14 14 L50 14 L50 24 L14 24 Z'], s: ['M20 24 L14 58', 'M44 24 L50 58', 'M18.5 34 L45.5 34', 'M16.5 46 L47.5 46', 'M14 14 L14 6', 'M50 14 L50 6', 'M14 6 L50 6'], sw: 4 },
  access: { name: 'Access / parking', f: ['M8 30 L14 18 Q15.5 15 19 15 L41 15 Q44.5 15 46 18 L52 30 L56 31 Q58 32 58 35 L58 44 L6 44 L6 35 Q6 32 8 30 Z', 'M18 44 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0', 'M46 44 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0'], cut: ['M15 29 L19 20 L30 20 L30 29 Z', 'M34 29 L34 20 L41 20 L45 29 Z'] },
  note: { name: 'Note', f: ['M32 32 m-11 0 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0'] },
};

// Map a free-text species to an icon.
export function animalFor(species = '') {
  const s = species.toLowerCase();
  if (!s) return null;
  if (/moose/.test(s)) return 'moose';
  if (/elk|wapiti/.test(s)) return 'elk';
  if (/caribou/.test(s)) return 'caribou';
  if (/deer|whitetail|muley|blacktail/.test(s)) return 'deer';
  if (/bear|bison/.test(s)) return 'bear';
  if (/sheep|bighorn|thinhorn|stone|dall|ram/.test(s)) return 'sheep';
  if (/goat/.test(s)) return 'goat';
  if (/cougar|lion|lynx|bobcat|cat/.test(s)) return 'cougar';
  if (/wolf|coyote|fox/.test(s)) return 'wolf';
  if (/turkey/.test(s)) return 'turkey';
  if (/duck|goose|geese|brant|teal|mallard|waterfowl|coot|swan/.test(s)) return 'duck';
  if (/hare|rabbit/.test(s)) return 'hare';
  if (/grouse|ptarmigan|pheasant|quail|partridge|chukar|bird|pigeon|dove|snipe/.test(s)) return 'grouse';
  return null;
}
// Which glyph a waypoint shows: the animal if it has one, else its kind's place symbol.
export const glyphFor = (spot) => (['camp', 'trailcam', 'stand', 'access'].includes(spot.kind) ? spot.kind : animalFor(spot.species) || (spot.kind === 'note' ? 'note' : 'note'));

function draw(ctx, g, color) {
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = g.sw || 2.6;
  for (const d of g.f || []) ctx.fill(new Path2D(d));
  for (const d of g.s || []) ctx.stroke(new Path2D(d));
}
// Badge image: coloured disc + white ring + soft shadow, white silhouette. Returned as ImageData for map.addImage.
export function badgeImage(glyph, color, { size = 46, ratio = 2, kill = false } = {}) {
  const px = size * ratio, c = document.createElement('canvas'); c.width = c.height = px;
  const ctx = c.getContext('2d'); ctx.scale(ratio, ratio);
  const r = size / 2 - 3;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1.5;
  ctx.beginPath(); ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.restore();
  ctx.lineWidth = kill ? 3.2 : 2.4; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(size / 2, size / 2, r - (kill ? 1.6 : 1.2), 0, Math.PI * 2); ctx.stroke();
  const g = ANIMALS[glyph] || ANIMALS.note; const inner = r * 1.42; const o = (size - inner) / 2;
  ctx.save(); ctx.translate(o, o + 0.5); ctx.scale(inner / 64, inner / 64);
  draw(ctx, g, '#fff');
  ctx.globalCompositeOperation = 'destination-out'; for (const d of g.cut || []) ctx.fill(new Path2D(d)); ctx.globalCompositeOperation = 'source-over';
  if (g.dot) { ctx.beginPath(); ctx.arc(g.dot[0], g.dot[1], g.dot[2], 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); }
  ctx.restore();
  return { image: ctx.getImageData(0, 0, px, px), ratio };
}
// Inline SVG of a glyph for pickers and lists.
export function glyphSVG(glyph, { size = 32, color = 'currentColor', bg = 'var(--panel)' } = {}) {
  const g = ANIMALS[glyph] || ANIMALS.note;
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><g fill="${color}" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">
    ${(g.f || []).map((d) => `<path d="${d}" stroke="none"/>`).join('')}${(g.s || []).map((d) => `<path d="${d}" fill="none" stroke-width="${g.sw || 2.6}"/>`).join('')}
    ${(g.cut || []).map((d) => `<path d="${d}" fill="${bg}" stroke="none"/>`).join('')}${g.dot ? `<circle cx="${g.dot[0]}" cy="${g.dot[1]}" r="${g.dot[2]}" stroke="none"/>` : ''}</g></svg>`;
}
export const PICKABLE = ['moose', 'elk', 'deer', 'caribou', 'bear', 'sheep', 'goat', 'cougar', 'wolf', 'grouse', 'turkey', 'duck', 'hare'];
