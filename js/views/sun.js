import { esc, fmtTime, todayISO, tip } from '../util.js?v=20261113181344-c6f16a5';
import { moonSVG } from '../rut.js?v=20261113181344-c6f16a5';
import { icon } from '../icons.js?v=20261113181344-c6f16a5';
import * as M from '../map.js?v=20261113181344-c6f16a5';

const PH = [[0.03, 'New moon', '🌑'], [0.22, 'Waxing crescent', '🌒'], [0.28, 'First quarter', '🌓'], [0.47, 'Waxing gibbous', '🌔'], [0.53, 'Full moon', '🌕'], [0.72, 'Waning gibbous', '🌖'], [0.78, 'Last quarter', '🌗'], [0.97, 'Waning crescent', '🌘'], [1.01, 'New moon', '🌑']];
const add = (d, min) => (d && !isNaN(d) ? new Date(d.getTime() + min * 60000) : null);

// BC: hunting is lawful from one half hour before sunrise to one half hour after sunset (verify in synopsis).
export function sunInfo(date, lat, lon) {
  const t = SunCalc.getTimes(date, lat, lon); const mi = SunCalc.getMoonIllumination(date); const mt = SunCalc.getMoonTimes(date, lat, lon);
  const ph = PH.find((p) => mi.phase < p[0]);
  return { sunrise: fmtTime(t.sunrise), sunset: fmtTime(t.sunset), legalStart: fmtTime(add(t.sunrise, -30)), legalEnd: fmtTime(add(t.sunset, 30)),
    dawn: fmtTime(t.dawn), dusk: fmtTime(t.dusk), noon: fmtTime(t.solarNoon), moonName: ph[1], moonIcon: moonSVG(mi.phase, 18), moonPct: Math.round(mi.fraction * 100),
    moonrise: mt.alwaysUp ? 'up all day' : mt.alwaysDown ? 'down all day' : fmtTime(mt.rise), moonset: fmtTime(mt.set), raw: t };
}

let pos = null;
const fpos = () => { try { const p = JSON.parse(localStorage.getItem('hunthq_fpos')); return p && isFinite(p.lat) ? p : null; } catch { return null; } };
export function render(v) {
  const c = pos || fpos() || M.map.getCenter(); const date = render.date || todayISO();
  v.innerHTML = `<button class="back-link" data-back>${icon('chevL', { size: 16 })}Forecast</button><div class="page-h"><h2>Sun &amp; moon times</h2></div>
  <label>Starting <input type="date" id="sDate" value="${date}"></label>
  <p class="list-note tip-h" style="margin:8px 4px 12px">For ${esc(c.label || `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`)}${tip('This uses your forecast spot. Change it on the Forecast page.')}</p><div id="sOut"></div>`;
  const draw = () => {
    const d = v.querySelector('#sDate').value || todayISO(); render.date = d;
    const s = sunInfo(new Date(d + 'T12:00'), c.lat, c.lng);
    let week = '';
    for (let i = 0; i < 14; i++) { const dd = new Date(d + 'T12:00'); dd.setDate(dd.getDate() + i); const x = sunInfo(dd, c.lat, c.lng);
      week += `<tr><td>${dd.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}</td><td class="tnum">${x.legalStart} – ${x.legalEnd}</td><td><span class="row" style="gap:6px;flex-wrap:nowrap">${x.moonIcon}<span class="tnum">${x.moonPct}%</span></span></td></tr>`; }
    const r = (k, val) => `<div class="list-row static"><span class="lr-t"><span>${k}</span></span><b class="tnum">${val}</b></div>`;
    v.querySelector('#sOut').innerHTML = `<div class="list-group">
      ${r(`Legal light${tip(`Legal hunting hours in BC run from half an hour before sunrise to half an hour after sunset. Check the synopsis for exceptions. Civil dawn ${s.dawn}, civil dusk ${s.dusk}.`)}`, `${s.legalStart} – ${s.legalEnd}`)}${r('Sunrise and sunset', `${s.sunrise} – ${s.sunset}`)}
      <div class="list-row static"><span class="lr-t"><span>Moon</span></span><b class="row" style="gap:8px">${moonSVG(SunCalc.getMoonIllumination(new Date(d + 'T12:00')).phase, 22)}${s.moonPct}% · ${esc(s.moonName.toLowerCase())}</b></div>
      ${r('Moonrise and moonset', `${s.moonrise} – ${s.moonset}`)}</div>
      <h3 class="list-h">Next 14 days</h3><div class="table-wrap"><table><thead><tr><th>Day</th><th>Legal light</th><th>Moon</th></tr></thead><tbody>${week}</tbody></table></div>`;
  };
  v.querySelector('[data-back]').onclick = () => import('../main.js?v=20261113181344-c6f16a5').then((m) => m.showTabPublic('insights'));
  v.querySelector('#sDate').onchange = draw;
  draw();
}
