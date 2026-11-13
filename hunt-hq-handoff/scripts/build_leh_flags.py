# Attach footnote restrictions to LEH hunts in data/leh_2026.json: for each hunt, the stars on its MU / zone point to a
# footnote in the same page column ("***Zone C and J ... ARCHERY ONLY ... PRIVATE LAND"). We record short flags
# (archery, private, permission, partial) plus the footnote text. Source: pdftotext -layout of the LEH synopsis (leh.txt).
import re, json, sys, collections
txt = sys.argv[1] if len(sys.argv) > 1 else 'leh.txt'
pages = re.sub(r'[-] ?', '', open(txt).read()).split('\f')
P = '/home/user/hunthq/hunt-hq-handoff/data/leh_2026.json'
D = json.load(open(P)); H = {h['code']: h for h in D['hunts']}
CODE = re.compile(r'(?:(?<=^)|(?<=\s\s)|(?<=^\s))(\d{4})\s+(?=[A-Z])')
ROW = re.compile(r'^(\d{4})\s+.+?\s{2,}(\d-\d{2})(\**)(?:[^\n]*?)\s+(?:([A-Z0-9]{1,3})(\**)\s+)?(?:Jan|Feb|Mar|Apr|May|June?|July?|Aug|Sept?|Oct|Nov|Dec)')
FOOT = re.compile(r'(?:^|\s)(\*{1,3})(?!\*)\s*([A-Z][^*]*)')

def columns(lines):
    starts = [m.start(1) for ln in lines for m in CODE.finditer(ln)]
    right = [s for s in starts if s > 60]
    mid = (collections.Counter(right).most_common(1)[0][0] - 3) if right else 10 ** 6
    return [[ln[:mid] for ln in lines], [ln[mid:] for ln in lines]]

hits = 0
for pg in pages[:18]:
    lines = pg.split('\n')
    cols = columns(lines); page_notes = []
    for col in cols:
        # footnotes in this column: star count -> text (continuation lines until blank / next footnote / next table)
        notes = {}; cur = None; gap = 0; n = 0
        for ln in col:
            s = ln.strip()
            if re.match(r'\d{4}\s', s) or re.search(r'REGION \d|Mandatory Hunter|ARCHERY ONLY SEASONS|REGULAR LIMITED|AGE-RESTRICTED|Group Hunt applications|Where a hunter chooses|NOTE: LEH|Persons successful|Mountain Goat are sensitive', s, re.I): cur = None; continue
            fs = list(FOOT.finditer(ln))
            if fs and ln.lstrip().startswith('*'):
                for m in fs: cur = len(m.group(1)); notes[cur] = notes.get(cur, '') + ' ' + m.group(2).strip()
                gap = 0; n = 0; continue
            if not cur: continue
            # A footnote can be broken up by short lines from the other column (table headers); allow small gaps.
            if len(s) > 25 and not re.search(r'\s{4,}', s) and n < 12: notes[cur] += ' ' + s; gap = 0; n += 1
            else:
                gap += 1
                if gap > 3: cur = None
        page_notes.append(notes)
    for ci, col in enumerate(cols):
        notes = page_notes[ci]; other = page_notes[1 - ci] if len(page_notes) > 1 else {}
        for ln in col:
            m = ROW.match(ln.strip())
            if not m or m.group(1) not in H: continue
            h = H[m.group(1)]; stars = max(len(m.group(3) or ''), len(m.group(5) or ''))
            # Footnotes usually sit in the hunt's own column; some are printed in the other column of the page.
            # When both columns carry a note with the same stars, take the one that names this hunt's MU.
            cands = [n[stars] for n in (notes, other) if stars and stars in n]
            if not cands: continue
            mu = m.group(2)
            pick = next((c for c in cands if mu in c), None) or (cands[0] if stars in notes or len(cands) == 1 else None)
            if not pick: continue
            note = re.sub(r'\s+', ' ', pick).strip()
            up = note.upper(); flags = []
            # Only explicit restriction wording counts (so "there is no bow only season" or "illegal to hunt on
            # private land without permission" don't flag a hunt).
            if re.search(r'RESTRICTED TO ARCHERY|ARCHERY EQUIPMENT ONLY|ARCHERY ONLY', up): flags.append('archery')
            if re.search(r'PRIVATE LAND ONLY|RESTRICTED TO PRIVATE LAND|IS PRIVATE LAND|EXCLUSIVELY ON PRIVATE LAND', up): flags.append('private')
            if re.search(r'PERMISSION OF THE LANDOWNER|LANDOWNER MUST|AT THE DISCRETION OF', up): flags.append('permission')
            if re.search(r'DOES NOT GUARANTEE|NO GUARANTEE', up): flags.append('uncertain')
            if re.search(r'ELEVATION|BELOW \d+ METRE', up): flags.append('elevation')
            if re.search(r'PROVINCIAL PARK|ACCESS IS LIMITED|SNOW MACHINES IS LIKELY', up): flags.append('access')
            h['note'] = note[:600]; h['flags'] = flags; hits += 1
json.dump(D, open(P, 'w'), separators=(',', ':'))
print('hunts with footnotes:', hits)
for c in ['2078', '2113', '2121', '2005', '2062', '4317']:
    h = H.get(c); print(c, h and h.get('flags'), (h and h.get('note') or '')[:140])
