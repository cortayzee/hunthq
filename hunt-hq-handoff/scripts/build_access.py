# Road access per WMU and per LEH zone, from the BC Digital Road Atlas (WHSE_BASEMAPPING.DRA_DGTL_ROAD_ATLAS_MPAR_SP).
# For each polygon: km of road by surface (paved, loose = gravel, rough = 4x4, overgrown/decommissioned), area, and
# densities (km per 100 km²). Output: data/access.json  { wmu: {id: {...}}, leh: {"TYPE|AREA": {...}} }.
# Segments that cross the boundary count in full, so densities are slightly high for small zones.
import json, math, sys, time, urllib.request, urllib.parse, collections
from shapely.geometry import shape
D = '/home/user/hunthq/hunt-hq-handoff/data/'
WFS = 'https://openmaps.gov.bc.ca/geo/pub/wfs'

def area_km2(g):  # spherical polygon area
    R = 6371.0
    def ring(c):
        a = 0
        for i in range(len(c) - 1):
            x1, y1 = map(math.radians, c[i]); x2, y2 = map(math.radians, c[i + 1])
            a += (x2 - x1) * (2 + math.sin(y1) + math.sin(y2))
        return abs(a * R * R / 2)
    polys = [g.exterior] if g.geom_type == 'Polygon' else [p.exterior for p in g.geoms]
    return sum(ring(list(p.coords)) for p in polys)

def wkt(g):
    polys = [g] if g.geom_type == 'Polygon' else list(g.geoms)
    polys = [p for p in polys if p.area > 1e-5] or polys[:1]
    return 'MULTIPOLYGON(' + ','.join('((' + ','.join(f'{x:.4f} {y:.4f}' for x, y in p.exterior.coords) + '))' for p in polys) + ')'

def roads(g):
    km = collections.Counter(); start = 0
    while True:
        body = urllib.parse.urlencode({'service': 'WFS', 'version': '2.0.0', 'request': 'GetFeature', 'typeName': 'pub:WHSE_BASEMAPPING.DRA_DGTL_ROAD_ATLAS_MPAR_SP',
            'outputFormat': 'application/json', 'propertyName': 'SEGMENT_LENGTH_2D,ROAD_SURFACE', 'count': '20000', 'startIndex': str(start),
            'sortBy': 'DIGITAL_ROAD_ATLAS_LINE_ID', 'CQL_FILTER': f'INTERSECTS(GEOMETRY, SRID=4326;{wkt(g)})'}).encode()
        for attempt in range(4):
            try:
                d = json.load(urllib.request.urlopen(urllib.request.Request(WFS, data=body, method='POST'), timeout=240)); break
            except Exception as e:
                if attempt == 3: raise
                time.sleep(5 * (attempt + 1))
        fs = d.get('features', [])
        for f in fs:
            p = f['properties']; km[p.get('ROAD_SURFACE') or 'unknown'] += (p.get('SEGMENT_LENGTH_2D') or 0) / 1000
        if len(fs) < 20000: return km
        start += 20000

def summary(g, km):
    a = max(1.0, area_km2(g))
    p, l, r = km['paved'], km['loose'] + km['seasonal'], km['rough'] + km['unknown']
    o = km['overgrown'] + km['decommissioned']
    good = (p + l) / a * 100; drive = (p + l + r) / a * 100
    return {'a': round(a), 'p': round(p), 'l': round(l), 'r': round(r), 'o': round(o), 'g': round(good, 1), 'd': round(drive, 1)}

out = json.load(open(D + 'access.json')) if len(sys.argv) > 1 and sys.argv[1] == 'resume' else {'wmu': {}, 'leh': {}}
jobs = []
for f in json.load(open(D + 'wmu_2026.geojson'))['features']: jobs.append(('wmu', f['properties']['id'], f['geometry']))
for f in json.load(open(D + 'leh_zones_2026.geojson'))['features']: jobs.append(('leh', f['properties']['k'], f['geometry']))
t0 = time.time()
for i, (kind, key, geom) in enumerate(jobs):
    if key in out[kind]: continue
    g = shape(geom).simplify(0.01, preserve_topology=True)
    if g.is_empty: continue
    try: out[kind][key] = summary(g, roads(g))
    except Exception as e: print('fail', kind, key, e, flush=True); continue
    if i % 25 == 0:
        json.dump(out, open(D + 'access.json', 'w'), separators=(',', ':'))
        print(f'{i + 1}/{len(jobs)} {kind} {key} {out[kind][key]} {time.time() - t0:.0f}s', flush=True)
json.dump(out, open(D + 'access.json', 'w'), separators=(',', ':'))
print('done', len(out['wmu']), 'wmus,', len(out['leh']), 'zones', flush=True)
