// Static configuration. The Supabase publishable key is safe in client code: RLS protects the data.
export const SUPABASE_URL = 'https://mdzvqqhreqaxyclbjqbb.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_dbNASohIgm97ZB62246_Ug__H25ffF_';

export const SEASONS_URL = 'hunt-hq-handoff/data/bc_seasons_2026_2028.json';
export const SYNOPSIS_RANGE = ['2026-07-01', '2028-06-30'];
export const REGS_URL = 'https://www.gov.bc.ca/hunting';

export const BC_WMS = 'https://openmaps.gov.bc.ca/geo/pub/wms';
export const BC_WFS = 'https://openmaps.gov.bc.ca/geo/pub/wfs';

// Field names on BC layers (adjust here if the layer schema differs; More → Layer diagnostics shows real fields).
export const WMU_LAYER = 'WHSE_WILDLIFE_MANAGEMENT.WAA_WILDLIFE_MGMT_UNITS_SVW';
export const WMU_FIELD = 'WILDLIFE_MGMT_UNIT_ID';
export const LEH_LAYER = 'WHSE_WILDLIFE_MANAGEMENT.WAA_LTD_HNT_ZONE_CURR_YEAR_SVW';
export const LEH_TYPE_FIELD = 'LTD_ENTRY_HUNTING_ZONE_TYPE';
export const MVPR_LAYER = 'WHSE_WILDLIFE_MANAGEMENT.WAA_MVPR_AREAS_SP';

const ESRI = (s) => [`https://server.arcgisonline.com/ArcGIS/rest/services/${s}/MapServer/tile/{z}/{y}/{x}`];
// max = deepest zoom Esri actually has imagery for in rural BC; beyond it MapLibre enlarges the last real tile
// instead of fetching Esri's 'Map data not yet available' placeholder.
export const BASES = {
  sat: { name: 'Satellite', tiles: ESRI('World_Imagery'), max: 17, attr: 'Imagery © Esri, Maxar, Earthstar Geographics' },
  hybrid: { name: 'Hybrid', tiles: ESRI('World_Imagery'), max: 17, ref: true, attr: 'Imagery © Esri, Maxar, Earthstar Geographics' },
  topo: { name: 'Topo', tiles: ESRI('World_Topo_Map'), max: 16, attr: '© Esri, USGS, NRCan' },
  otm: { name: 'OpenTopoMap', tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://b.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'], max: 17, attr: '© OpenTopoMap (CC-BY-SA), © OpenStreetMap contributors' },
  natgeo: { name: 'NatGeo', tiles: ESRI('NatGeo_World_Map'), max: 16, attr: '© Esri, National Geographic' },
  relief: { name: 'Shaded relief', tiles: ESRI('World_Shaded_Relief'), max: 13, attr: '© Esri' },
  street: { name: 'Streets', tiles: ESRI('World_Street_Map'), max: 17, attr: '© Esri, HERE, OpenStreetMap contributors' },
  osm: { name: 'OpenStreetMap', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], max: 19, attr: '© OpenStreetMap contributors' },
  dark: { name: 'Dark', tiles: ESRI('Canvas/World_Dark_Gray_Base'), max: 16, attr: '© Esri' },
};
// Roads + place names drawn over any base (always on for Hybrid).
export const REF_TILES = [...ESRI('Reference/World_Transportation'), ...ESRI('Reference/World_Boundaries_and_Places')];
export const GLYPHS = 'vendor/fonts/{fontstack}/{range}.pbf';
export const WMU_GEO_URL = 'hunt-hq-handoff/data/wmu_2026.geojson';
export const WMU_LABELS_URL = 'hunt-hq-handoff/data/wmu_labels.geojson';
export const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

// BC government WMS overlays. `cql` filters a layer; `group` is for display only.
// LEH per-species toggles filter by exact zone type (values verified on the live layer, Nov 2026).
const leh = (sp, pat, color) => ({ id: 'leh_' + sp.toLowerCase().replace(/\W+/g, '_'), name: `LEH zones – ${sp}`, layer: LEH_LAYER, cql: `${LEH_TYPE_FIELD} = '${pat}'`, color, group: 'LEH', identify: true });
export const BC_LAYERS = [
  { id: 'wmu', name: 'Wildlife Management Units', layer: WMU_LAYER, color: '#e0a100', group: 'Boundaries', identify: true, on: true },
  { id: 'gmz', name: 'Game Management Zones', layer: 'WHSE_WILDLIFE_MANAGEMENT.WAA_GAME_MANAGEMENT_ZONES_SVW', color: '#c78b00', group: 'Boundaries', identify: true },
  { id: 'leh_all', name: 'LEH zones – All species', layer: LEH_LAYER, color: '#7b3fb5', group: 'LEH', identify: true },
  leh('Moose', 'MOOSE', '#8a4b08'),
  leh('Elk', 'ELK', '#a0522d'),
  leh('Mule deer', 'MULE DEER', '#6b8e23'),
  leh('White-tailed deer', 'WHITE-TAILED DEER', '#556b2f'),
  leh('Mountain goat', 'MOUNTAIN GOAT', '#708090'),
  leh('Mountain sheep', 'MOUNTAIN SHEEP', '#9370db'),
  leh('Caribou', 'CARIBOU', '#4682b4'),
  leh('Bison', 'BISON', '#5a3825'),
  leh('Turkey', 'TURKEY', '#c0392b'),
  leh('Black bear', 'BLACK BEAR', '#333333'),
  // Motor-vehicle prohibitions, split by PROHIBITION_TYPE like iHunter. `match` routes identify results to the toggle that shows them.
  { id: 'mv_hca', name: 'MVHCA – motor vehicle hunting closed', layer: MVPR_LAYER, cql: "PROHIBITION_TYPE = 'Motor Vehicle Hunting Closed Areas'", match: (p) => p.PROHIBITION_TYPE === 'Motor Vehicle Hunting Closed Areas', color: '#ff7a00', group: 'Access', identify: true },
  { id: 'mv_ca', name: 'Motor vehicle closed areas', layer: MVPR_LAYER, cql: "PROHIBITION_TYPE = 'Motor Vehicle Closed Areas'", match: (p) => p.PROHIBITION_TYPE === 'Motor Vehicle Closed Areas', color: '#e0262b', group: 'Access', identify: true },
  { id: 'mv_atv', name: 'ATV / e-bike closed areas', layer: MVPR_LAYER, cql: "PROHIBITION_TYPE LIKE 'ATV%'", match: (p) => /^ATV/.test(p.PROHIBITION_TYPE || ''), color: '#c2185b', group: 'Access', identify: true },
  { id: 'mv_snow', name: 'Snowmobile closed areas', layer: MVPR_LAYER, cql: "PROHIBITION_TYPE LIKE 'Snowmobile%'", match: (p) => /^Snowmobile/.test(p.PROHIBITION_TYPE || ''), color: '#3f8fd8', group: 'Access', identify: true },
  { id: 'mv_routes', name: 'Motor vehicle route restrictions', layer: 'WHSE_WILDLIFE_MANAGEMENT.WAA_MVPR_ROUTES_SP', color: '#ff4f4f', group: 'Access', identify: true, geom: 'line' },
  // Roads & trails (BC Digital Road Atlas + forest tenure data). `match` splits one road layer into toggles by surface.
  { id: 'rd_main', name: 'Highways & paved roads', layer: 'WHSE_BASEMAPPING.DRA_DGTL_ROAD_ATLAS_MPAR_SP', cql: "ROAD_SURFACE = 'paved' OR ROAD_CLASS IN ('highway','arterial','collector')", match: (p) => p.ROAD_SURFACE === 'paved' || ['highway', 'arterial', 'collector'].includes(p.ROAD_CLASS), color: '#ffd23f', width: 3, geom: 'line', group: 'Roads', identify: true, minzoom: 6 },
  { id: 'rd_gravel', name: 'Gravel roads', layer: 'WHSE_BASEMAPPING.DRA_DGTL_ROAD_ATLAS_MPAR_SP', cql: "ROAD_SURFACE = 'loose'", match: (p) => p.ROAD_SURFACE === 'loose', color: '#ff8c1a', width: 2.2, geom: 'line', group: 'Roads', identify: true, minzoom: 8 },
  { id: 'rd_rough', name: 'Rough & 4x4 roads', layer: 'WHSE_BASEMAPPING.DRA_DGTL_ROAD_ATLAS_MPAR_SP', cql: "ROAD_SURFACE = 'rough'", match: (p) => p.ROAD_SURFACE === 'rough', color: '#ff4d6d', width: 1.8, dash: '6 3', geom: 'line', group: 'Roads', identify: true, minzoom: 9, note: 'Shows from zoom 9' },
  { id: 'rd_over', name: 'Overgrown & decommissioned', layer: 'WHSE_BASEMAPPING.DRA_DGTL_ROAD_ATLAS_MPAR_SP', cql: "ROAD_SURFACE IN ('overgrown','decommissioned')", match: (p) => ['overgrown', 'decommissioned'].includes(p.ROAD_SURFACE), color: '#c77dff', width: 1.8, dash: '2 3', geom: 'line', group: 'Roads', identify: true, minzoom: 9, note: 'Good walk-in access. Shows from zoom 9' },
  { id: 'fsr', name: 'Forest service roads', layer: 'WHSE_FOREST_TENURE.FTEN_ROAD_SECTION_LINES_SVW', cql: "FILE_TYPE_DESCRIPTION = 'Forest Service Road' AND RETIREMENT_DATE IS NULL", color: '#2ec4b6', width: 2.6, geom: 'line', group: 'Roads', identify: true, minzoom: 7 },
  { id: 'rec_trails', name: 'Recreation trails', layer: 'WHSE_FOREST_TENURE.FTEN_RECREATION_LINES_SVW', cql: 'RETIREMENT_DATE IS NULL', color: '#80ed99', width: 2.2, dash: '4 2', geom: 'line', group: 'Roads', identify: true, minzoom: 8 },
  { id: 'rec_sites', name: 'Recreation sites & campsites', layer: 'WHSE_FOREST_TENURE.FTEN_REC_SITE_POINTS_SVW', color: '#38b000', geom: 'point', group: 'Roads', identify: true, minzoom: 7 },
  // Habitat: young forest after logging or fire is prime feed for deer, elk and moose.
  { id: 'cutblocks', name: 'Cutblocks since 2006', layer: 'WHSE_FOREST_VEGETATION.VEG_CONSOLIDATED_CUT_BLOCKS_SP', cql: 'HARVEST_START_YEAR_CALENDAR >= 2006', color: '#e9c46a', group: 'Habitat', identify: true, minzoom: 8, note: 'Shows from zoom 8' },
  { id: 'burns', name: 'Wildfire burns since 2000', layer: 'WHSE_LAND_AND_NATURAL_RESOURCE.PROT_HISTORICAL_FIRE_POLYS_SP', cql: 'FIRE_YEAR >= 2000', color: '#e63946', group: 'Habitat', identify: true },
  { id: 'parks', name: 'Parks & protected areas', layer: 'WHSE_TANTALIS.TA_PARK_ECORES_PA_SVW', color: '#2e8b57', group: 'Land', identify: true },
  { id: 'reserves', name: 'First Nations reserves', layer: 'WHSE_ADMIN_BOUNDARIES.CLAB_INDIAN_RESERVES', color: '#b5651d', group: 'Land', identify: true },
  { id: 'private', name: 'Private land (ParcelMap BC, zoom 12+)', layer: 'WHSE_CADASTRE.PMBC_PARCEL_FABRIC_POLY_SVW', cql: "OWNER_TYPE = 'Private'", color: '#cc3399', group: 'Land', identify: true, minzoom: 12 },
];

// Waypoint types, grouped for the picker. Colour = badge colour on the map.
export const KINDS = [
  { id: 'kill', name: 'Kill', color: '#d62728', group: 'hunt' },
  { id: 'sighting', name: 'Sighting', color: '#1f77b4', group: 'hunt' },
  { id: 'feed', name: 'Feeding area', color: '#7cb342', group: 'scout' },
  { id: 'water', name: 'Water', color: '#0288d1', group: 'scout' },
  { id: 'bedding', name: 'Bedding area', color: '#8d6e63', group: 'scout' },
  { id: 'sign', name: 'Sign (rub, tracks, scat…)', color: '#ef6c00', group: 'scout' },
  { id: 'wallow', name: 'Wallow', color: '#6d4c41', group: 'scout' },
  { id: 'glass', name: 'Glassing spot', color: '#546e7a', group: 'scout' },
  { id: 'trailcam', name: 'Trail cam', color: '#17becf', group: 'scout' },
  { id: 'stand', name: 'Stand / blind', color: '#9467bd', group: 'scout' },
  { id: 'camp', name: 'Camp', color: '#2ca02c', group: 'place' },
  { id: 'access', name: 'Parking / vehicle', color: '#ff7f0e', group: 'place' },
  { id: 'trailhead', name: 'Trailhead / walk-in', color: '#a1887f', group: 'place' },
  { id: 'bridge', name: 'Bridge / crossing', color: '#607d8b', group: 'place' },
  { id: 'gate', name: 'Gate', color: '#ad1457', group: 'place' },
  { id: 'service', name: 'Cell service', color: '#5b5bd6', group: 'place' },
  { id: 'hazard', name: 'Hazard', color: '#f9a825', group: 'place' },
  { id: 'note', name: 'Note', color: '#7f7f7f', group: 'place' },
];
export const SIGN_TYPES = ['Rub', 'Scrape', 'Tracks', 'Droppings', 'Bed', 'Shed', 'Hair', 'Trail', 'Kill site', 'Other'];
export const KIND_GROUPS = [['hunt', 'Hunt'], ['scout', 'Scouting'], ['place', 'Camp & access']];
export const kindColor = (k) => (KINDS.find((x) => x.id === k) || KINDS[KINDS.length - 1]).color;

export const SPECIES = ['Mule Deer', 'White-tailed Deer', 'Moose', 'Elk', 'Black Bear', 'Grizzly Bear', 'Mountain Goat',
  'Bighorn Sheep', 'Thinhorn Sheep', 'Caribou', 'Bison', 'Cougar', 'Wolf', 'Coyote', 'Lynx', 'Bobcat', 'Turkey',
  'Ruffed Grouse', 'Spruce Grouse', 'Blue Grouse (Dusky/Sooty)', 'Sharp-tailed Grouse', 'Ptarmigan', 'Pheasant',
  'Ducks', 'Geese', 'Snowshoe Hare', 'Other'];
export const WEAPONS = ['Rifle', 'Bow', 'Crossbow', 'Shotgun', 'Muzzleloader', 'Handgun'];
export const RESULTS = ['harvest', 'missed', 'seen', 'nothing'];
export const SEXES = ['', 'M', 'F', 'Unknown'];
