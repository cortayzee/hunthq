# Build data/leh_zones_2026.geojson: simplified current-year LEH zone polygons (type + area id) so the app can
# outline every hunt in the LEH finder's current filter. Source: WFS WAA_LTD_HNT_ZONE_CURR_YEAR_SVW -> lehall.json.
import json, sys
from shapely.geometry import shape, mapping
src = sys.argv[1] if len(sys.argv) > 1 else 'lehall.json'
def rnd(o):
    if isinstance(o, (list, tuple)):
        return [rnd(x) for x in o] if not isinstance(o[0], (int, float)) else [round(o[0], 4), round(o[1], 4)]
    return o
out = []
for f in json.load(open(src))['features']:
    p = f['properties']; g = shape(f['geometry']).simplify(0.004, preserve_topology=True)
    if g.is_empty: continue
    m = mapping(g)
    out.append({'type': 'Feature', 'properties': {'k': p['LTD_ENTRY_HUNTING_ZONE_TYPE'] + '|' + p['LEH_HUNT_AREA_ID']},
                'geometry': {'type': m['type'], 'coordinates': rnd(m['coordinates'])}})
json.dump({'type': 'FeatureCollection', 'features': out}, open('/home/user/hunthq/hunt-hq-handoff/data/leh_zones_2026.geojson', 'w'), separators=(',', ':'))
print(len(out))
