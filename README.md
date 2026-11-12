# Hunt HQ (BC)

Personal hunting map + log for BC: iHunter-style map with BC government layers, seasons by WMU,
waypoints/trips/tags/LEH, onX/iHunter import, insights, sun & moon. Static site (no build step) + Supabase.

## Use it
- **Tap the map** → popup with coordinates, current weather, the WMU (tap it for every season there,
  Open/Closed for the chosen date, grouped Big game / Bears & predators / Birds), LEH zone, motor-vehicle
  closures, parks/reserves/private land, legal shooting light and moon. "＋ Waypoint" drops a waypoint there.
- **＋ Waypoint** button → tap the map to place one (WMU auto-filled).
- **☰ Menu** → Layers, Season map (shade open WMUs for a species/date), Waypoints (list, bulk entry, KML/GPX/CSV export),
  Trips (bulk entry for past seasons), Tags & LEH (+ LEH advisor from the BC draw-report CSV), Insights, Import, Sun & moon,
  More (backup/restore, Google Earth KML, custom BC layers, layer diagnostics).
- **Local mode** works without an account (data in this browser only); export a backup and restore it after signing in.

## Deploy (GitHub Pages)
1. Repo → Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/ (root)`.
2. Supabase → Auth → URL Configuration → **Site URL** = the Pages URL (e.g. `https://cortayzee.github.io/hunthq/`).
3. Open the site, **Create account** (first time) or sign in.

Run locally: `python3 -m http.server` in the repo root, open http://localhost:8000.

## Layout
- `index.html`, `css/app.css`, `js/` (ES modules, no bundler), `vendor/` (MapLibre GL 4.7, supabase-js 2, SunCalc, togeojson, JSZip).
- `js/config.js` – Supabase keys, base maps, BC layer list and field names.
- Season data and handoff notes: `hunt-hq-handoff/` (see its `CLAUDE.md` and `data/SEASONS_QA.md`).

## Unverified against the live BC layers (the build sandbox couldn't reach openmaps.gov.bc.ca)
Run **Menu → More → Layer diagnostics** once on the live site and adjust `js/config.js` if needed:
- WMU id field assumed `WILDLIFE_MGMT_UNIT_ID` (used for identify, open-WMU shading, boundary highlight).
- Per-species LEH toggles filter `LTD_ENTRY_HUNTING_ZONE_TYPE ILIKE '%moose%'` etc.
- MVPR routes layer name guessed as `WAA_MVPR_ROUTES_SP`; MVPR "in effect on date" is inferred from date fields/text.
- Private land uses ParcelMap BC `OWNER_TYPE = 'Private'` (zoom 12+).
