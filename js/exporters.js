import { KINDS, kindColor } from './config.js?v=20261113060050-30af831';
import { download, esc, toCSV, todayISO } from './util.js?v=20261113060050-30af831';

const kmlColor = (hex) => { const h = hex.replace('#', ''); return 'ff' + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2); };
const desc = (s) => [s.species && `Species: ${s.species} ${s.sex || ''}`, s.hunter && `Hunter: ${s.hunter}`, s.observed_at && `When: ${s.observed_at}`, s.wmu && `WMU: ${s.wmu}`, s.weapon && `Weapon: ${s.weapon}`, s.notes].filter(Boolean).join('\n');

export function kmlString(spots, tracks = []) {
  const styles = KINDS.map((k) => `<Style id="k_${k.id}"><IconStyle><color>${kmlColor(k.color)}</color><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle></Style>`).join('');
  const folders = KINDS.map((k) => {
    const ps = spots.filter((s) => (s.kind || 'note') === k.id); if (!ps.length) return '';
    return `<Folder><name>${esc(k.name)}</name>${ps.map((s) => `<Placemark><name>${esc(s.name || s.species || k.name)}</name>${s.observed_at ? `<TimeStamp><when>${esc(s.observed_at)}</when></TimeStamp>` : ''}<description>${esc(desc(s))}</description><styleUrl>#k_${k.id}</styleUrl>
<ExtendedData><Data name="kind"><value>${esc(s.kind)}</value></Data><Data name="hunter"><value>${esc(s.hunter || '')}</value></Data><Data name="species"><value>${esc(s.species || '')}</value></Data></ExtendedData>
<Point><coordinates>${s.lon},${s.lat}</coordinates></Point></Placemark>`).join('\n')}</Folder>`;
  }).join('\n');
  const tr = tracks.length ? `<Folder><name>Tracks</name>${tracks.map((t) => `<Placemark><name>${esc(t.name || 'Track')}</name><Style><LineStyle><color>ff7f3dff</color><width>3</width></LineStyle></Style><LineString><tessellate>1</tessellate><coordinates>${(t.coords || []).map((c) => `${c[0]},${c[1]}${c[2] != null ? ',' + c[2] : ''}`).join(' ')}</coordinates></LineString></Placemark>`).join('\n')}</Folder>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Hunt HQ export ${todayISO()}</name>${styles}\n${folders}\n${tr}</Document></kml>`;
}
export const exportKML = (spots, tracks) => download(`hunthq_${todayISO()}.kml`, kmlString(spots, tracks), 'application/vnd.google-earth.kml+xml');

export function exportGPX(spots, tracks = []) {
  const g = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Hunt HQ" xmlns="http://www.topografix.com/GPX/1/1">
${spots.map((s) => `<wpt lat="${s.lat}" lon="${s.lon}">${s.observed_at ? `<time>${esc(s.observed_at)}</time>` : ''}<name>${esc(s.name || s.species || s.kind)}</name><desc>${esc(desc(s))}</desc><type>${esc(s.kind)}</type></wpt>`).join('\n')}
${tracks.map((t) => `<trk><name>${esc(t.name || 'Track')}</name><trkseg>${(t.coords || []).map((c) => `<trkpt lat="${c[1]}" lon="${c[0]}">${c[2] != null ? `<ele>${c[2]}</ele>` : ''}${c[3] ? `<time>${esc(c[3])}</time>` : ''}</trkpt>`).join('')}</trkseg></trk>`).join('\n')}
</gpx>`;
  download(`hunthq_${todayISO()}.gpx`, g, 'application/gpx+xml');
}
export const exportCSV = (rows, name = 'waypoints') => download(`hunthq_${name}_${todayISO()}.csv`, toCSV(rows.map((r) => { const x = { ...r }; delete x.user_id; return x; })), 'text/csv');
