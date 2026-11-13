import { esc, fmtTime, todayISO } from '../util.js?v=20261113015250-f350ee7';
import * as M from '../map.js?v=20261113015250-f350ee7';

const PH = [[0.03, 'New moon', '🌑'], [0.22, 'Waxing crescent', '🌒'], [0.28, 'First quarter', '🌓'], [0.47, 'Waxing gibbous', '🌔'], [0.53, 'Full moon', '🌕'], [0.72, 'Waning gibbous', '🌖'], [0.78, 'Last quarter', '🌗'], [0.97, 'Waning crescent', '🌘'], [1.01, 'New moon', '🌑']];
const add = (d, min) => (d && !isNaN(d) ? new Date(d.getTime() + min * 60000) : null);

// BC: hunting is lawful from one half hour before sunrise to one half hour after sunset (verify in synopsis).
export function sunInfo(date, lat, lon) {
  const t = SunCalc.getTimes(date, lat, lon); const mi = SunCalc.getMoonIllumination(date); const mt = SunCalc.getMoonTimes(date, lat, lon);
  const ph = PH.find((p) => mi.phase < p[0]);
  return { sunrise: fmtTime(t.sunrise), sunset: fmtTime(t.sunset), legalStart: fmtTime(add(t.sunrise, -30)), legalEnd: fmtTime(add(t.sunset, 30)),
    dawn: fmtTime(t.dawn), dusk: fmtTime(t.dusk), noon: fmtTime(t.solarNoon), moonName: ph[1], moonIcon: ph[2], moonPct: Math.round(mi.fraction * 100),
    moonrise: mt.alwaysUp ? 'up all day' : mt.alwaysDown ? 'down all day' : fmtTime(mt.rise), moonset: fmtTime(mt.set), raw: t };
}

let pos = null;
export function render(v) {
  const c = pos || M.map.getCenter(); const date = render.date || todayISO();
  v.innerHTML = `<h2>Sun &amp; moon</h2>
  <div class="grid2"><label>Date <input type="date" id="sDate" value="${date}"></label>
  <div style="align-self:end" class="row"><button id="sCenter">Use map centre</button><button id="sGps">GPS</button></div></div>
  <p class="muted">Location ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}</p><div id="sOut"></div>`;
  const draw = () => {
    const d = v.querySelector('#sDate').value || todayISO(); render.date = d;
    const s = sunInfo(new Date(d + 'T12:00'), c.lat, c.lng);
    let week = '';
    for (let i = 0; i < 14; i++) { const dd = new Date(d + 'T12:00'); dd.setDate(dd.getDate() + i); const x = sunInfo(dd, c.lat, c.lng);
      week += `<tr><td>${dd.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}</td><td>${x.legalStart}</td><td>${x.legalEnd}</td><td>${x.moonIcon} ${x.moonPct}%</td><td class="muted">${x.moonrise} / ${x.moonset}</td></tr>`; }
    v.querySelector('#sOut').innerHTML = `<div class="kpis">
      <div class="kpi"><b>${s.legalStart}</b><span>legal light starts</span></div><div class="kpi"><b>${s.legalEnd}</b><span>legal light ends</span></div>
      <div class="kpi"><b>${s.sunrise}</b><span>sunrise</span></div><div class="kpi"><b>${s.sunset}</b><span>sunset</span></div>
      <div class="kpi"><b>${s.moonIcon} ${s.moonPct}%</b><span>${esc(s.moonName)}</span></div><div class="kpi"><b>${s.moonrise}</b><span>moonrise · set ${s.moonset}</span></div></div>
      <p class="muted">Civil dawn ${s.dawn} · solar noon ${s.noon} · civil dusk ${s.dusk}. Legal hours = ½ h before sunrise to ½ h after sunset (BC general rule; check synopsis for exceptions). Times in your device's time zone.</p>
      <h3>Next 14 days</h3><table><thead><tr><th>Day</th><th>Legal start</th><th>Legal end</th><th>Moon</th><th>Rise / set</th></tr></thead><tbody>${week}</tbody></table>`;
  };
  v.querySelector('#sDate').onchange = draw;
  v.querySelector('#sCenter').onclick = () => { pos = null; render(v); };
  v.querySelector('#sGps').onclick = () => navigator.geolocation?.getCurrentPosition((p) => { pos = { lat: p.coords.latitude, lng: p.coords.longitude }; render(v); }, (e) => alert(e.message));
  draw();
}
