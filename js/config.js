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
export const BASES = {
  sat: { name: 'Satellite', tiles: ESRI('World_Imagery'), max: 19, attr: 'Imagery © Esri, Maxar, Earthstar Geographics' },
  hybrid: { name: 'Hybrid', tiles: ESRI('World_Imagery'), max: 19, ref: true, attr: 'Imagery © Esri, Maxar, Earthstar Geographics' },
  topo: { name: 'Topo', tiles: ESRI('World_Topo_Map'), max: 19, attr: '© Esri, USGS, NRCan' },
  otm: { name: 'OpenTopoMap', tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://b.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'], max: 17, attr: '© OpenTopoMap (CC-BY-SA), © OpenStreetMap contributors' },
  natgeo: { name: 'NatGeo', tiles: ESRI('NatGeo_World_Map'), max: 16, attr: '© Esri, National Geographic' },
  relief: { name: 'Shaded relief', tiles: ESRI('World_Shaded_Relief'), max: 13, attr: '© Esri' },
  street: { name: 'Streets', tiles: ESRI('World_Street_Map'), max: 19, attr: '© Esri, HERE, OpenStreetMap contributors' },
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
  { id: 'leh_all', name: 'LEH zones – all (current year)', layer: LEH_LAYER, color: '#7b3fb5', group: 'LEH', identify: true },
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
  { id: 'parks', name: 'Parks & protected areas', layer: 'WHSE_TANTALIS.TA_PARK_ECORES_PA_SVW', color: '#2e8b57', group: 'Land', identify: true },
  { id: 'reserves', name: 'First Nations reserves', layer: 'WHSE_ADMIN_BOUNDARIES.CLAB_INDIAN_RESERVES', color: '#b5651d', group: 'Land', identify: true },
  { id: 'private', name: 'Private land (ParcelMap BC, zoom 12+)', layer: 'WHSE_CADASTRE.PMBC_PARCEL_FABRIC_POLY_SVW', cql: "OWNER_TYPE = 'Private'", color: '#cc3399', group: 'Land', identify: true, minzoom: 12 },
];

export const KINDS = [
  { id: 'kill', name: 'Kill', color: '#d62728' },
  { id: 'sighting', name: 'Sighting', color: '#1f77b4' },
  { id: 'stand', name: 'Stand / blind', color: '#9467bd' },
  { id: 'camp', name: 'Camp', color: '#2ca02c' },
  { id: 'trailcam', name: 'Trail cam', color: '#17becf' },
  { id: 'access', name: 'Access / parking', color: '#ff7f0e' },
  { id: 'note', name: 'Note', color: '#7f7f7f' },
];
export const kindColor = (k) => (KINDS.find((x) => x.id === k) || KINDS[KINDS.length - 1]).color;

export const SPECIES = ['Mule Deer', 'White-tailed Deer', 'Moose', 'Elk', 'Black Bear', 'Grizzly Bear', 'Mountain Goat',
  'Bighorn Sheep', 'Thinhorn Sheep', 'Caribou', 'Bison', 'Cougar', 'Wolf', 'Coyote', 'Lynx', 'Bobcat', 'Turkey',
  'Ruffed Grouse', 'Spruce Grouse', 'Blue Grouse (Dusky/Sooty)', 'Sharp-tailed Grouse', 'Ptarmigan', 'Pheasant',
  'Ducks', 'Geese', 'Snowshoe Hare', 'Other'];
export const WEAPONS = ['Rifle', 'Bow', 'Crossbow', 'Shotgun', 'Muzzleloader', 'Handgun'];
export const RESULTS = ['harvest', 'missed', 'seen', 'nothing'];
export const SEXES = ['', 'M', 'F', 'Unknown'];
