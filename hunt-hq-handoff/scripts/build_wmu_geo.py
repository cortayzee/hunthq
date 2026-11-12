"""Build data/wmu_2026.geojson (simplified WMU polygons) and data/wmu_labels.geojson (label points)
from the BC WMU layer. Used by the app for WMU numbers, tap lookup, per-unit hide and season shading.
Exact boundaries still come from the BC WMS layer.

Fetch the source first (≈58 MB):
  curl -o wmu_full.json 'https://openmaps.gov.bc.ca/geo/pub/wfs?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326&typeName=pub:WHSE_WILDLIFE_MANAGEMENT.WAA_WILDLIFE_MGMT_UNITS_SVW&propertyName=WILDLIFE_MGMT_UNIT_ID,REGION_RESPONSIBLE_NAME,GAME_MANAGEMENT_ZONE_NAME,GEOMETRY'
Then: python3 build_wmu_geo.py wmu_full.json ../data   (needs shapely)
"""
import json, sys
from shapely.geometry import shape, mapping
from shapely.ops import polylabel, unary_union

src, out = sys.argv[1], sys.argv[2]
feats = json.load(open(src))['features']

def rnd(o, nd=4):
    if isinstance(o, (list, tuple)):
        return [rnd(x, nd) for x in o] if not isinstance(o[0], (int, float)) else [round(o[0], nd), round(o[1], nd)]
    return o

polys, labels = [], []
groups = {}
for f in feats:
    groups.setdefault(f['properties']['WILDLIFE_MGMT_UNIT_ID'], []).append(f)
for mu, fs in sorted(groups.items()):
    p = fs[0]['properties']
    g = unary_union([shape(f['geometry']) for f in fs])
    s = g.simplify(0.0015, preserve_topology=True)
    if s.is_empty:
        s = g
    polys.append({'type': 'Feature', 'properties': {'id': mu, 'r': p['REGION_RESPONSIBLE_NAME'], 'gmz': p.get('GAME_MANAGEMENT_ZONE_NAME')},
                  'geometry': rnd(mapping(s)['coordinates']) and {'type': mapping(s)['type'], 'coordinates': rnd(mapping(s)['coordinates'])}})
    big = max(g.geoms, key=lambda x: x.area) if g.geom_type == 'MultiPolygon' else g
    pt = polylabel(big.simplify(0.002), tolerance=0.002)
    labels.append({'type': 'Feature', 'properties': {'id': mu, 'r': p['REGION_RESPONSIBLE_NAME'], 'a': round(g.area, 4)},
                   'geometry': {'type': 'Point', 'coordinates': [round(pt.x, 4), round(pt.y, 4)]}})

json.dump({'type': 'FeatureCollection', 'features': polys}, open(f'{out}/wmu_2026.geojson', 'w'), separators=(',', ':'))
json.dump({'type': 'FeatureCollection', 'features': labels}, open(f'{out}/wmu_labels.geojson', 'w'), separators=(',', ':'))
print(len(polys), 'WMUs')
