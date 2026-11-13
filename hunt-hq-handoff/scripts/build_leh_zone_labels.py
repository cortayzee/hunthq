# Build data/leh_zone_labels.geojson: one label point per current-year LEH zone (polylabel of the largest part).
# Source: curl the WFS for WAA_LTD_HNT_ZONE_CURR_YEAR_SVW (srsName EPSG:4326) to lehall.json first.
import json, re, sys
from shapely.geometry import shape
from shapely.ops import polylabel
src = sys.argv[1] if len(sys.argv) > 1 else 'lehall.json'
out = []
for f in json.load(open(src))['features']:
    p = f['properties']; g = shape(f['geometry'])
    big = max(g.geoms, key=lambda x: x.area) if g.geom_type == 'MultiPolygon' else g
    pt = polylabel(big.simplify(0.003), tolerance=0.003)
    lab = p['LTD_ENTRY_HUNTING_ZONE_LABEL'] or ''
    m = re.match(r'Zone (\w+) of (.+)', lab)
    short = f"{m.group(2)} {m.group(1)}" if m else lab   # "4-24 A" or whole-unit "4-24"
    out.append({'type': 'Feature', 'properties': {'t': p['LTD_ENTRY_HUNTING_ZONE_TYPE'], 'l': short, 'z': m.group(1) if m else '', 'a': round(g.area, 4)},
                'geometry': {'type': 'Point', 'coordinates': [round(pt.x, 4), round(pt.y, 4)]}})
json.dump({'type': 'FeatureCollection', 'features': out}, open('/home/user/hunthq/hunt-hq-handoff/data/leh_zone_labels.geojson', 'w'), separators=(',', ':'))
print(len(out))
