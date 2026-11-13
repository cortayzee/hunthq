// Rut / breeding calendars for BC game species, moon drawing, and solunar periods.
// Dates are typical for BC (interior unless noted) and shift with latitude, elevation and year: a guide, not a rule.

// Each stage: [name, start MM-DD, end MM-DD, what animals are doing[], how to hunt it[]]
export const RUT = {
  'White-tailed Deer': { note: 'Kootenay / Peace / Okanagan whitetails. Peak breeding is usually mid-to-late November.', stages: [
    ['Pre-rut', '10-01', '10-25', ['Bachelor groups break up; bucks rub trees and start to spar', 'Still on a feeding pattern, mostly at first and last light'],
      ['Sit food sources in the evening and travel routes from bedding', 'Find fresh rub lines; light rattling (tickling antlers) late in the phase']],
    ['Seeking', '10-26', '11-08', ['Scrapes open up and get checked often', 'Bucks start cruising in daylight, checking doe groups'],
      ['Rattling and grunt calls work best now', 'Hunt downwind of scrape lines and between doe bedding areas']],
    ['Chasing', '11-09', '11-16', ['Bucks chase does hard; does are edgy and look behind them', 'Big bucks move at midday'],
      ['Sit all day; funnels and pinch points between bedding areas', 'Doe bleats and grunts; when a doe runs past, wait for the buck']],
    ['Peak breeding', '11-17', '11-27', ['Bucks "lock down" with a doe for a day or two, often in thick cover', 'Movement can seem to drop, then bucks look for the next doe'],
      ['Hunt the edges of doe bedding cover and glass for tending pairs', 'Stay patient through midday; a buck between does can show up anytime']],
    ['Post-rut', '11-28', '12-20', ['Worn-out bucks feed hard to recover', 'Unbred does come back into heat ~28 days later (a small "second rut" in mid-December)'],
      ['Back to food sources, especially on cold afternoons', 'Hunt the evening before and after a cold front']],
  ] },
  'Mule Deer': { note: 'Interior mule deer. Peak rut is usually mid-November to early December, often after many general seasons close. Check your unit.', stages: [
    ['Pre-rut', '10-15', '11-05', ['Bucks drift from summer range toward wintering does', 'Rubbing and sparring; still fairly secretive'],
      ['Glass open slopes and cut blocks at first and last light', 'Cover lots of country; look for big-bodied bucks alone']],
    ['Early rut', '11-06', '11-14', ['Bucks roam between doe groups, sometimes in daylight', 'Satellite bucks hang around the edges of doe groups'],
      ['Find the does and check each group again and again', 'Glass midday too; bucks get up to check does']],
    ['Peak rut', '11-15', '12-01', ['Mature bucks tend doe groups in the open and are less cautious', 'Fights between bucks; lots of daytime movement'],
      ['Spot-and-stalk: find does, then glass for the buck with them', 'Stay on the glass all day; doe groups move and bucks follow']],
    ['Post-rut', '12-02', '12-20', ['Bucks are run down and feed heavily on south-facing winter range', 'Bucks often bed close to feed and move little'],
      ['Glass south slopes and winter range at midday', 'Be selective; bucks can look thin and older than they are']],
  ] },
  'Black-tailed Deer': { note: 'Coastal and Vancouver Island blacktails rut earlier than interior mule deer, peaking late October to mid-November.', stages: [
    ['Pre-rut', '10-01', '10-20', ['Mostly nocturnal in heavy cover', 'Rubs show up on small trees along trails'],
      ['Still-hunt slowly on trails between cover and cut blocks', 'Sit cut-block edges at first and last light']],
    ['Seeking', '10-21', '10-31', ['Bucks start moving in daylight, checking does', 'Scrapes on old roads and block edges'],
      ['Rattling works very well on blacktails', 'Hunt old logging roads and the edges of young cut blocks']],
    ['Peak rut', '11-01', '11-15', ['Bucks are bold and chase does; the best daytime movement of the year', 'Even big bucks come to rattling'],
      ['Rattle and grunt every 20–30 min from a spot you can see out of', 'Sit all day on edges and saddles']],
    ['Post-rut', '11-16', '12-10', ['Bucks go back to heavy cover and feed', 'Quiet again; a few late does keep some bucks moving'],
      ['Slow still-hunting in timber after rain', 'Watch food edges right at last light']],
  ] },
  Elk: { note: 'Rocky Mountain and Roosevelt elk. Bugling peaks mid-September to early October.', stages: [
    ['Pre-rut', '08-25', '09-07', ['Bulls rub off velvet; occasional bugles at first light', 'Bachelor groups break up as cows gather'],
      ['Scout wallows, rubs and feeding meadows', 'Soft cow calls; keep pressure low so bulls stay in the area']],
    ['Building', '09-08', '09-18', ['Herd bulls gather cows and bugle more each day', 'Satellite bulls trail the herds'],
      ['Locate bulls with a bugle at first light, then close the gap', 'Set up between bedding and feeding areas; play the wind']],
    ['Peak rut', '09-19', '10-05', ['Constant bugling; herd bulls defend harems, satellites look for a chance', 'Bulls respond aggressively to challenges'],
      ['Get close (under 100 m) before calling; challenge bugles can pull a herd bull', 'Cow-call to satellites; the caller sets up 30–50 m behind the shooter']],
    ['Post-rut', '10-06', '10-31', ['Bulls go quiet and head to dark timber to recover', 'Small bull groups form; a few late cows spark short bugling flurries'],
      ['Hunt timber benches and north slopes near water', 'Glass feeding areas at last light; track in fresh snow']],
  ] },
  Moose: { note: 'Peak breeding is usually the last week of September into early October.', stages: [
    ['Pre-rut', '09-01', '09-15', ['Bulls shed velvet and rub saplings', 'Bulls start digging rut pits (wallows)'],
      ['Scout fresh rubs, rut pits and willow flats', 'Glass cut blocks and swamp edges at first and last light']],
    ['Peak rut', '09-16', '10-08', ['Bulls travel looking for cows and answer calls; cows call loudly', 'Bulls grunt and thrash brush'],
      ['Cow calls, then raking brush and sloshing water like a bull', 'Wait a long time after calling; bulls come in slow and quiet']],
    ['Post-rut', '10-09', '10-31', ['Bulls feed heavily and rest; much less responsive', 'Often bed close to willow and cut-block browse'],
      ['Glass browse areas and burns; still-hunt timber edges', 'Track in snow; check the same feeding areas at dawn and dusk']],
  ] },
  Caribou: { note: 'Northern BC mountain caribou. Rut is late September to mid-October.', stages: [
    ['Pre-rut', '09-10', '09-25', ['Bulls rub off velvet and spar', 'Groups start to gather on open alpine'],
      ['Glass alpine basins and ridges from high points', 'Cover country; look for bulls moving between groups']],
    ['Peak rut', '09-26', '10-15', ['Bulls gather cows and chase rivals; little feeding', 'Bulls are distracted and travel a lot'],
      ['Find cow groups and wait for the bull to show', 'Get ahead of a moving group rather than chasing it']],
    ['Post-rut', '10-16', '11-10', ['Bulls are worn down and feed; groups move to winter range', ''],
      ['Glass lichen-rich slopes and timberline', '']],
  ] },
  'Mountain Sheep': { note: 'Bighorn and thinhorn rams rut in November and December, mostly after the general seasons close.', stages: [
    ['Pre-rut', '10-20', '11-10', ['Rams leave ram bands and drift toward ewe groups', 'More sparring and head-butting'],
      ['Glass ewe range edges for rams moving in', 'Watch for rams crossing between drainages']],
    ['Rut', '11-11', '12-15', ['Rams test ewes, fight, and are visible in daylight', 'Peak is usually late November'],
      ['Find the ewes; the rams will be there', 'Mostly a viewing season; check your unit and LEH for any open hunts']],
    ['Post-rut', '12-16', '12-31', ['Rams separate from ewes and feed hard on winter range', ''],
      ['Glass windblown south slopes', '']],
  ] },
  'Mountain Goat': { note: 'Goats rut in November; billies join nanny groups.', stages: [
    ['Pre-rut', '10-15', '10-31', ['Billies move down toward nanny groups', 'Billies dig rut pits and posture'],
      ['Glass cliffs near nanny groups for lone billies', 'Judge carefully: a nanny with no kid can look like a billy']],
    ['Rut', '11-01', '12-05', ['Billies tend nannies and stand off rivals', 'More time out in the open'],
      ['Glass early and plan the stalk from above', 'Only shoot where you can recover the goat safely']],
    ['Post-rut', '12-06', '12-31', ['Billies separate and move to winter cliffs', ''], ['Glass south-facing cliffs at midday', '']],
  ] },
  Bison: { note: 'Plains/wood bison rut in summer, peaking in early August.', stages: [
    ['Pre-rut', '07-01', '07-20', ['Bulls rejoin the herds', 'Wallowing and bellowing begin'], ['Locate herds by sign and sound', '']],
    ['Peak rut', '07-21', '08-25', ['Bulls bellow, fight and tend cows', 'Bulls are aggressive; keep your distance'], ['Glass herds from a distance; plan a safe approach', '']],
    ['Post-rut', '08-26', '09-30', ['Bulls drift away from herds into small groups', ''], ['Look for lone bulls and small bull groups', '']],
  ] },
  'Black Bear': { note: 'Bears breed in late spring and early summer (no fall rut). This is the spring season pattern.', stages: [
    ['Green-up', '04-10', '05-15', ['Bears leave dens and feed on new grass and clover', 'Boars come out first; sows with cubs later'],
      ['Glass south-facing green slopes, road edges and avalanche chutes in the evening', 'Never shoot a cub or a sow with cubs']],
    ['Breeding', '05-16', '07-10', ['Boars roam widely looking for sows and are active in daylight', 'Big boars push younger bears off food'],
      ['Sit good glassing spots longer; boars travel a lot', 'Look for big, blocky heads and small-looking ears']],
    ['Summer', '07-11', '08-15', ['Bears go to berries and higher country', ''], ['Glass berry patches at first and last light', '']],
  ] },
  Turkey: { note: 'Spring gobbling season (Kootenay / Okanagan).', stages: [
    ['Early', '04-01', '04-20', ['Winter flocks break up; toms gobble hard at the roost', 'Toms are often with hens'],
      ['Roost birds the evening before; set up close at first light', 'Call softly; hens will lead the tom']],
    ['Peak', '04-21', '05-10', ['Hens start nesting; toms are lonely by mid-morning', 'Toms answer calls readily'],
      ['Hunt mid-morning to midday when hens go to nests', 'Run-and-gun with locator calls']],
    ['Late', '05-11', '05-31', ['Toms are call-shy but still looking for hens', ''], ['Set up and wait longer; soft purrs and clucks', '']],
  ] },
};
export const RUT_SPECIES = Object.keys(RUT);

const dOY = (md, y) => { const [m, d] = md.split('-').map(Number); return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 864e5); };
// Where a date falls in a species' calendar.
export function rutStatus(sp, date = new Date()) {
  const R = RUT[sp]; if (!R) return null; const y = date.getFullYear();
  const t = Math.round((Date.UTC(y, date.getMonth(), date.getDate()) - Date.UTC(y, 0, 1)) / 864e5);
  const st = R.stages.map(([name, a, b, does, tips], i) => ({ i, name, a, b, s: dOY(a, y), e: dOY(b, y), does: does.filter(Boolean), tips: tips.filter(Boolean) }));
  const peak = st.find((s) => /peak|^rut$|breeding/i.test(s.name)) || st[Math.floor(st.length / 2)];
  const cur = st.find((s) => t >= s.s && t <= s.e) || null;
  const first = st[0], last = st[st.length - 1];
  let headline;
  if (cur) {
    const next = st[cur.i + 1];
    headline = cur === peak ? `${cur.name} now · day ${t - cur.s + 1} of ${cur.e - cur.s + 1}` : next ? `${cur.name} · ${next.s - t} day${next.s - t === 1 ? '' : 's'} until ${next.name.toLowerCase()}` : `${cur.name} · ends ${fmtMD(cur.b)}`;
  } else if (t < first.s) headline = `${first.s - t} days until the ${first.name.toLowerCase()}`;
  else if (t > last.e) headline = `Done for the year · ${first.name.toLowerCase()} starts ${fmtMD(first.a)}`;
  else { const nx = st.find((s) => s.s > t); headline = `${nx.s - t} days until ${nx.name.toLowerCase()}`; }
  return { stages: st, cur, peak, t, headline, note: R.note, span: [first.s, last.e] };
}
export const fmtMD = (md) => new Date(`2026-${md}T12:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

// ---- Moon ----
export const PHASES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
export const phaseIdx = (p) => Math.round(p * 8) % 8;
// Named phases: quarters / full / new only within ~1 day of the exact moment, crescent & gibbous between.
const PH_CUT = [[0.03, 0], [0.22, 1], [0.28, 2], [0.47, 3], [0.53, 4], [0.72, 5], [0.78, 6], [0.97, 7], [1.01, 0]];
export const phaseName = (p) => PHASES[PH_CUT.find((c) => p < c[0])[1]];
// Draw the moon as it looks (northern hemisphere): lit part from the phase (0 new, .5 full).
export function moonSVG(phase, size = 28) {
  const r = size / 2 - 1, c = size / 2, f = (1 - Math.cos(2 * Math.PI * phase)) / 2, wax = phase < 0.5;
  const rx = Math.max(0.01, r * Math.abs(1 - 2 * f));
  const lit = f < 0.01 ? '' : f > 0.99 ? `<circle cx="${c}" cy="${c}" r="${r}" fill="#f3e7c4"/>`
    : `<path d="M${c} ${c - r}A${r} ${r} 0 0 ${wax ? 1 : 0} ${c} ${c + r}A${rx} ${r} 0 0 ${(f < 0.5) === wax ? 0 : 1} ${c} ${c - r}Z" fill="#f3e7c4"/>`;
  return `<svg class="moon" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" fill="#2b2f38" stroke="#5a6070" stroke-width="1"/>${lit}</svg>`;
}
export const MOON_TIPS = {
  'New moon': ['Dark nights mean less night feeding, so animals tend to move well at first and last light.', 'Good evenings for food-source sits.'],
  'Waxing crescent': ['Moon sets early in the evening; nights stay mostly dark.', 'Evening movement is usually solid.'],
  'First quarter': ['Moon is high overhead around sunset, a solunar "major" in the evening.', 'Favour evening sits.'],
  'Waxing gibbous': ['Brighter nights; some feeding shifts into the night.', 'Mornings can slow down. Evenings are still decent.'],
  'Full moon': ['Bright all night: animals often feed at night and bed early.', 'Many hunters see more late-morning and midday movement (10 am–2 pm). Stay out longer instead of heading in at 9.'],
  'Waning gibbous': ['Moon is up through the morning; still bright nights.', 'Midday sits can pay off; late mornings are worth staying for.'],
  'Last quarter': ['Moon is overhead around sunrise, a solunar "major" in the morning.', 'Favour morning sits.'],
  'Waning crescent': ['Nights getting dark again; movement returns to first and last light.', 'Mornings are usually good.'],
};

// Solunar: majors = moon overhead / underfoot (±1 h), minors = moonrise / moonset (±30 min).
export function solunar(day, lat, lon) {
  const d0 = new Date(day); d0.setHours(0, 0, 0, 0);
  let hi = { a: -9 }, lo = { a: 9 };
  for (let m = 0; m < 1440; m += 10) { const t = new Date(d0.getTime() + m * 6e4); const a = SunCalc.getMoonPosition(t, lat, lon).altitude; if (a > hi.a) hi = { a, t }; if (a < lo.a) lo = { a, t }; }
  const mt = SunCalc.getMoonTimes(d0, lat, lon);
  const W = (t, min, kind, what) => (t ? { s: new Date(t.getTime() - min * 6e4), e: new Date(t.getTime() + min * 6e4), kind, what } : null);
  return [W(hi.t, 60, 'major', 'moon overhead'), W(lo.t, 60, 'major', 'moon underfoot'), W(mt.rise, 30, 'minor', 'moonrise'), W(mt.set, 30, 'minor', 'moonset')].filter(Boolean).sort((a, b) => a.s - b.s);
}
// A day's moon outlook: phase, solunar windows that land in legal light, and a 1-4 rating.
export function moonDay(day, lat, lon) {
  const noon = new Date(day); noon.setHours(12, 0, 0, 0);
  const mi = SunCalc.getMoonIllumination(noon); const st = SunCalc.getTimes(noon, lat, lon);
  const legal = [new Date(st.sunrise - 30 * 6e4), new Date(+st.sunset + 30 * 6e4)];
  const dawn = [legal[0], new Date(+st.sunrise + 90 * 6e4)], dusk = [new Date(st.sunset - 90 * 6e4), legal[1]];
  const ov = (w, [a, b]) => w.s < b && w.e > a;
  const wins = solunar(noon, lat, lon).filter((w) => ov(w, legal));
  const prime = wins.filter((w) => ov(w, dawn) || ov(w, dusk));
  const nf = Math.abs(Math.cos(2 * Math.PI * mi.phase)); // 1 at new / full, 0 at quarters
  const score = Math.min(4, 1 + Math.round(nf * 1.6) + (prime.some((w) => w.kind === 'major') ? 1 : prime.length ? 0.5 : 0));
  const best = prime.find((w) => w.kind === 'major') || prime[0] || wins.find((w) => w.kind === 'major') || wins[0] || null;
  return { phase: mi.phase, pct: Math.round(mi.fraction * 100), name: phaseName(mi.phase), wins, best, score: Math.round(score), sunrise: st.sunrise, sunset: st.sunset };
}
