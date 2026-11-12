# Hunt HQ (BC) — project brief

A personal hunting app for one BC hunter (Andrew). Think **iHunter, plus his own tracking and analytics**.
Hosted as a static web app (GitHub Pages) with Supabase as the backend. Used on desktop and phone.
Only he logs in; his friends' kills and locations are entered by him and tagged with a `hunter` field.

## Status (handoff from a Claude chat, 2026-11-12)
Done:
- Supabase tables + RLS created (see `supabase/001_hunt_app_init.sql`, already applied).
- BC general open seasons parsed from the 2026–2028 Hunting & Trapping Regulations Synopsis →
  `data/bc_seasons_2026_2028.json` (394 rows, all 9 regions). Parser in `scripts/`. Read `data/SEASONS_QA.md` for known gaps.
- Motor vehicle closure text per region (MVCA / MVHCA / ATV / snowmobile) → `data/motor_vehicle_closures_synopsis_text.md`,
  for verifying the BC MVPR layer and writing popups. The layer is the primary source.
- Andrew has the synopsis PDF (2026–2028 Hunting & Trapping Regulations Synopsis); ask him to add it to the repo
  as `data/synopsis_2026_2028.pdf` if you need to re-parse.
Not started: the app itself. Andrew still needs to make a GitHub account/repo for hosting.

## Backend (Supabase)
- Project ref: `mdzvqqhreqaxyclbjqbb` (being renamed from "Fantasy HQ" to a personal-projects name;
  it also holds an unrelated `fantasy` schema, do not touch it).
- URL: `https://mdzvqqhreqaxyclbjqbb.supabase.co`
- Publishable key (safe in client code; RLS protects data): `sb_publishable_dbNASohIgm97ZB62246_Ug__H25ffF_`
- Tables: `hunt_spots`, `hunt_trips`, `hunt_tracks`, `hunt_tags`, `hunt_leh`, `hunt_prefs`, all owner-only RLS.
- Auth: email + password. Set Auth → URL Configuration → Site URL to the GitHub Pages URL once known.
- Free plan: project pauses after 7 days idle; no automatic backups → app needs a JSON backup export.

## Must-have features
1. **Map, iHunter-style** (MapLibre GL): base styles Satellite / Topo / Road, plus **3D terrain** toggle.
   Free sources: Esri World Imagery (sat), OpenTopoMap or Esri World Topo, AWS Terrarium DEM tiles for 3D.
2. **Toggleable BC government layers** via openmaps WMS (`https://openmaps.gov.bc.ca/geo/pub/wms`, layers `pub:<name>`):
   - Wildlife Management Units: `WHSE_WILDLIFE_MANAGEMENT.WAA_WILDLIFE_MGMT_UNITS_SVW`
   - LEH zones (current): `WHSE_WILDLIFE_MANAGEMENT.WAA_LTD_HNT_ZONE_CURR_YEAR_SVW`
     (fields incl. LIMITED_ENTRY_HUNTING_ZONE, LTD_ENTRY_HUNTING_ZONE_TYPE, LTD_ENTRY_HUNTING_ZONE_LABEL);
     want separate per-species toggles (Moose / Elk / Mule deer / Goat / Bison / Caribou LEH zones) like iHunter,
     via CQL_FILTER or WFS. Check actual field values first.
   - Motor vehicle prohibition areas incl. MVHCA: `WHSE_WILDLIFE_MANAGEMENT.WAA_MVPR_AREAS_SP`
     (also a routes layer exists; find its name). Flag what's closed/open on a chosen date.
   - Game Management Zones: `WHSE_WILDLIFE_MANAGEMENT.WAA_GAME_MANAGEMENT_ZONES_SVW`
   - Parks & protected areas: `WHSE_TANTALIS.TA_PARK_ECORES_PA_SVW`; First Nations reserves:
     `WHSE_ADMIN_BOUNDARIES.CLAB_INDIAN_RESERVES`; private land (ParcelMap BC) if feasible.
   - Click on map → identify WMU (WMS GetFeatureInfo / WFS) and show **what's open there today**.
   Reference screenshots of iHunter's layer panel were shared: toggle list with search, sorted by name.
3. **What's open**: pick date + species (+ WMU) → open seasons from `data/bc_seasons_2026_2028.json`;
   shade open WMUs on the map. Data format: `{r: region, sp: species, q: qualifier (Bow Only/Youth…),
   c: class (Bucks, 4 Point Bucks…), mu: ["3-15",…], d: [["09-10","11-30"]] (MM-DD, or YYYY-MM-DD for
   bird seasons that state years; ranges may wrap past Dec 31), b: bag, n: 1 = has a footnote → check synopsis
   page p, p: PDF page}`. Spot-check against the PDF; some rows need manual fixes. Always show
   "verify in synopsis / in-season changes at gov.bc.ca/hunting".
4. **Logging**: waypoints (kill, sighting, stand, camp, trail cam, access, note) with species, sex, hunter,
   date/time, WMU, weapon, notes; drop a waypoint by tapping the map. Hunt trips/days (hours, result,
   animals seen, weather, wind). Lots of past seasons (~6 years) entered from memory, so make bulk entry fast.
5. **Import** KML, KMZ, GPX, GeoJSON, CSV from **onX** (web map exports KML/GPX; app exports GPX) and
   **iHunter** (KML/KMZ). Preview step to map items to kinds/hunter before saving; dedupe.
6. **Tags & LEH**: tags bought per year (species, type, cost, filled). LEH entries per year (hunt code,
   zone, class, drawn?). **LEH advisor**: user preferences (species, regions, weapon, odds vs quality) +
   imported BC "LEH Draw Hunt Code Report" CSV (catalogue.data.gov.bc.ca) → ranked suggestions of where to apply.
7. **Insights / "learning"**: success rates by WMU, species, month, time of day, moon phase, weapon, hunter;
   hours per harvest; hotspot grid (productive vs heavily hunted but cold vs under-scouted). Filter by hunter.
   Deeper "where should I hunt next" analysis can be done by Claude reading the Supabase tables via MCP.
8. **Sun & moon** for a date/location: sunrise/sunset, legal shooting light, moon phase.
   (onX has no public API, so its "best times" can't be linked; compute our own.)
9. **Google Earth**: per-waypoint "Open in Google Earth" link
   (`https://earth.google.com/web/@LAT,LON,ALTa,1500d,35y,0h,45t,0r`) and **Export KML** of filtered data.
10. JSON backup export/import.

## Notes
- Andrew is in BC (America/Vancouver). Species/regulations are BC-specific.
- onX: no public API. Data comes in via its KML/GPX export.
