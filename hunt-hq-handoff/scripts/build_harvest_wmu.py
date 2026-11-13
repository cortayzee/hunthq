import csv, json, collections, math
SP = {'MOOS': 'Moose', 'ELK': 'Elk', 'DEMU': 'Mule Deer', 'DEWT': 'White-tailed Deer', 'BEAB': 'Black Bear', 'BEAG': 'Grizzly Bear', 'GOAT': 'Mountain Goat', 'SHEE': 'Mountain Sheep', 'CARI': 'Caribou', 'COUG': 'Cougar', 'WOLF': 'Wolf', 'TURK': 'Turkey'}
rows = list(csv.DictReader(open('hs_wmu.csv', encoding='utf-8-sig')))
num = lambda v: float(v) if v not in ('', None) else None
def mu(code):
    code = code.strip()
    if len(code) != 3 or code.endswith('00') or code in ('770', '780'): return None
    return f'{code[0]}-{int(code[1:])}'
data = collections.defaultdict(lambda: collections.defaultdict(dict))  # sp -> mu -> year -> stats
for r in rows:
    s = SP.get(r['Species']); m = mu(r['WMU'])
    if not s or not m: continue
    data[s][m][int(r['Year'])] = {'h': num(r['Hunters']), 'd': num(r['Days']), 'k': num(r['Kills']), 'male': num(r['Male Ratio'])}
geo = json.load(open('/home/user/hunthq/hunt-hq-handoff/data/wmu_2026.geojson'))
def area_km2(geom):  # rough spherical polygon area
    R = 6371.0
    def ring(c):
        a = 0
        for i in range(len(c) - 1):
            x1, y1 = map(math.radians, c[i]); x2, y2 = map(math.radians, c[i + 1])
            a += (x2 - x1) * (2 + math.sin(y1) + math.sin(y2))
        return abs(a * R * R / 2)
    polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    return sum(ring(p[0]) - sum(ring(h) for h in p[1:]) for p in polys)
area = {f['properties']['id']: area_km2(f['geometry']) for f in geo['features']}
YEARS = range(2020, 2025)
out = {'years': [YEARS[0], YEARS[-1]], 'source': 'BC Hunter Sample Survey Estimates 1976-2024 (WMU level)', 'area': {k: round(v) for k, v in area.items()}, 'species': {}}
for s, mus in data.items():
    sp = {}
    for m, yrs in mus.items():
        rec = [yrs[y] for y in YEARS if y in yrs]
        if not rec: continue
        H = sum(r['h'] or 0 for r in rec) / len(rec); D = sum(r['d'] or 0 for r in rec) / len(rec); K = sum(r['k'] or 0 for r in rec) / len(rec)
        old = [yrs[y] for y in range(2010, 2015) if y in yrs]; Kold = sum(r['k'] or 0 for r in old) / len(old) if old else None
        series = {y: [round(yrs[y]['h'] or 0), round(yrs[y]['k'] or 0)] for y in range(2005, 2025) if y in yrs}
        a = area.get(m)
        sp[m] = {'h': round(H), 'd': round(D), 'k': round(K, 1), 'succ': round(100 * K / H, 1) if H else None, 'dpk': round(D / K, 1) if K else None,
                 'kpa': round(100 * K / a, 2) if a else None, 'hpa': round(100 * H / a, 2) if a else None,
                 'trend': round(100 * (K - Kold) / Kold) if Kold and Kold >= 5 else None, 'n': len(rec), 'series': series}
    out['species'][s] = sp
json.dump(out, open('/home/user/hunthq/hunt-hq-handoff/data/harvest_wmu.json', 'w'), separators=(',', ':'))
print({s: len(v) for s, v in out['species'].items()})
print('4-24 elk', out['species']['Elk'].get('4-24')); print('5-3 mule', out['species']['Mule Deer'].get('5-3'))
