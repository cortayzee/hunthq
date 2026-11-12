# Season data QA notes

File: `data/bc_seasons_2026_2028.json`, 394 rows from the "General Open Seasons" tables of the
2026–2028 Hunting & Trapping Regulations Synopsis (all 9 regions). Rebuild: `python3 scripts/parse_seasons.py && python3 scripts/finalize.py`
(both read `pdftotext -layout` output; paths at the top of each script).

## Checked and fixed
- MU lists that wrap onto a second line ("3-34 / to 3-44") are now merged (Thompson, Peace).
- Spot-checked: Lower Mainland deer/goat/bear, Thompson mule deer + moose, Peace elk/moose/mule deer.

## Known gaps — verify against the PDF before relying on them
- **4 big-game rows have an empty class** where the PDF prints the class on its own line
  (e.g. Peace moose "Bulls" for Oct 25–26 and Nov 10–11). List: Skeena White-Tailed Deer ['12-11', '12-20'] p52; Skeena White-Tailed Deer ['12-11', '12-20'] p52; Peace Moose ['10-25', '10-26'] p64; Peace Moose ['11-10', '11-11'] p64
- **63 rows carry footnote symbols** (`n: 1`): portions of an MU, Bowen/Texada-only, youth/senior,
  antler rules, etc. Show them as "see footnote, synopsis p.X" — never as plain open.
- Grouse species names vary by region ("Grouse: Ruffed & Spruce", "Spruce & Ruffed Grouse"); normalize for filters.
- Bag limits are only captured when they're a plain number; many tables say "Refer to Regional Bag Limits".
- LEH-only seasons are NOT in this file (they're in the separate LEH synopsis). Bird seasons that state
  years (2026/2027) are stored as YYYY-MM-DD; pick the range matching the chosen date.
- In-season changes: always link https://www.gov.bc.ca/hunting.
