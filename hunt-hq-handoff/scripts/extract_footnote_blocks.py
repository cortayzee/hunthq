import json, re, sys
pages = open('all.txt').read().split('\f')
d = json.load(open('/home/user/hunthq/hunt-hq-handoff/data/bc_seasons_2026_2028.json'))
DATE = re.compile(r'(Jan|Feb|Mar|Apr|May|June?|July?|Aug|Sept?|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}\s*-\s*(Jan|Feb|Mar|Apr|May|June?|July?|Aug|Sept?|Oct|Nov|Dec)', re.I)
HEAD = re.compile(r'^\s{0,2}([A-Z][A-Z \-/&’\',\.:]{2,}(?:\s*\([A-Za-z\- ]+\))?)\s{3,}')
out = {}
for p in sorted(set(r['p'] for r in d)):
    lines = pages[p - 1].split('\n')
    cur = None; blocks = []
    for ln in lines:
        m = HEAD.match(ln)
        if m and not ln.strip().startswith(('SPECIES', 'Bow', 'Youth')) and len(m.group(1).strip()) >= 3 and m.group(1).split('(')[0].strip().isupper():
            cur = {'sp': m.group(1).strip(), 'notes': []}; blocks.append(cur); continue
        if cur is None: continue
        t = ln.rstrip()
        if not t.strip() or DATE.search(t): continue
        lead = len(t) - len(t.lstrip())
        if lead <= 2 and len(t.strip()) > 25:
            # drop right-hand bag-limit column fragments
            t = re.split(r'\s{6,}', t.strip())[0]
            cur['notes'].append(t)
    out[p] = [b for b in blocks if b['notes']]
json.dump(out, open('blocks.json', 'w'), indent=1)
import sys; sys.exit(0)
for p, bs in out.items():
    for b in bs: print(p, '|', b['sp'], '|', ' '.join(b['notes'])[:300])
