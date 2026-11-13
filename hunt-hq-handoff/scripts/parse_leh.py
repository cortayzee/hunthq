import re, json, collections
pages = re.sub(r'[\ue000-\uf8ff] ?', '', open('leh.txt').read()).split('\f')
MON = r'(?:Jan|Feb|Mar|Apr|May|June?|July?|Aug|Sept?|Oct|Nov|Dec)'
DATE = MON + r'\.?\s*\d{1,2}\s*-\s*(?:' + MON + r'\.?\s*)?\d{1,2}'
SEG = re.compile(r'^(\d{4})\s+(.+?)\s{2,}(\d-\d{2}\*{0,3}(?:\s*(?:,|&|to|-)\s*\d-\d{2}\*{0,3})*)\s+(?:([A-Z0-9]{1,3}\**)\s+)?(' + DATE + r'(?:\s*&)?)\s{2,}(.+?)\s{2,}(\d+)\s+(N/A|[\d.]+\s*:\s*1)')
CODEPOS = re.compile(r'(?:(?<=^)|(?<=\s\s)|(?<=^\s))(\d{4})\s+(?=[A-Z])')
CONT = re.compile(DATE)
SPECIES = [('MULE', 'Mule Deer'), ('WHITE-TAILED', 'White-tailed Deer'), ('MOOSE', 'Moose'), ('ELK', 'Elk'), ('MOUNTAIN GOAT', 'Mountain Goat'), ('MOUNTAIN SHEEP', 'Mountain Sheep'),
           ('CARIBOU', 'Caribou'), ('BISON', 'Bison'), ('BLACK BEAR', 'Black Bear'), ('TURKEY', 'Turkey'), ('GRIZZLY', 'Grizzly Bear')]
REG = re.compile(r'(VANCOUVER ISLAND|LOWER MAINLAND|THOMPSON|KOOTENAY|CARIBOO|SKEENA|OMINECA|PEACE|OKANAGAN)\s+RE[GI]+ON\s+(\d[AB]?)')
out = []; seen = set()
for pi, pg in enumerate(pages[:16]):
    lines = pg.split('\n')
    starts = [m.start(1) for ln in lines for m in CODEPOS.finditer(ln)]
    right = [s for s in starts if s > 60]
    mid = (collections.Counter(right).most_common(1)[0][0] - 3) if right else 10 ** 6
    state = [dict(sp=None, reg=None, rn=None, tag=None, prev=None), dict(sp=None, reg=None, rn=None, tag=None, prev=None)]
    for ln in lines:
        cps = [m.start(1) for m in CODEPOS.finditer(ln)]
        cuts = sorted(set([0] + cps + ([mid] if not any(abs(c - mid) < 15 for c in cps) else [])))
        segs = [(c, ln[c:(cuts[i + 1] if i + 1 < len(cuts) else None)]) for i, c in enumerate(cuts)]
        for pos, seg in segs:
            ci = 0 if pos < mid - 15 else 1
            st = state[ci]; up = seg.upper(); s2 = seg.strip()
            if not s2: continue
            if not re.match(r'\d{4}\s', s2):
                for k, v in SPECIES:
                    if re.search(r'(^|\s)' + re.escape(k) + r'(\s|$|\(|S\b)', up) and len(s2) < 80: st['sp'] = v; break
                m = REG.search(up)
                if m: st['reg'] = m.group(1).title(); st['rn'] = m.group(2)
                if 'ARCHERY ONLY' in up or 'BOW ONLY' in up: st['tag'] = 'Archery only'
                elif 'REGULAR LIMITED ENTRY' in up: st['tag'] = None
                elif 'YOUTH' in up and 'SEASON' in up or 'AGE-RESTRICTED' in up: st['tag'] = 'Age-restricted'
                c = CONT.search(seg)
                if c and st['prev'] and len(s2) < 25: st['prev']['dates'] += ' & ' + c.group(0).strip(); st['prev'] = None
                continue
            r = SEG.match(s2)
            if not r: st['prev'] = None; continue
            code, area, mu, zone, dates, cls, auth, odds = r.groups()
            if code in seen: continue
            seen.add(code)
            h = {'code': code, 'sp': st['sp'], 'region': st['reg'], 'rn': st['rn'], 'area': area.strip(), 'mu': re.sub(r'\s+', ' ', mu), 'zone': (zone or '').strip('*'),
                 'dates': re.sub(r'\s+', ' ', dates).strip(' &'), 'class': cls.strip(), 'auth': int(auth), 'odds': None if odds == 'N/A' else float(odds.split(':')[0]), 'tag': st['tag'], 'page': pi + 1}
            out.append(h); st['prev'] = h if dates.strip().endswith('&') else None
# Region fallback from the general-season data (MU -> synopsis region)
seas = json.load(open('/home/user/hunthq/hunt-hq-handoff/data/bc_seasons_2026_2028.json'))
mu2r = {}
for r in seas:
    for m in r['mu']: mu2r.setdefault(m, r['r'])
RN = {'Vancouver Island': '1', 'Lower Mainland': '2', 'Thompson': '3', 'Kootenay': '4', 'Cariboo': '5', 'Skeena': '6', 'Omineca': '7A', 'Peace': '7B', 'Okanagan': '8'}
for h in out:
    first = re.match(r'(\d)-(\d{2})', h['mu']); key = f"{first.group(1)}-{int(first.group(2))}" if first else None
    reg = mu2r.get(key)
    if reg and (not h['rn'] or RN.get(reg) != h['rn']): h['region'] = reg; h['rn'] = RN[reg]
    # MU list -> normalized ids ("7-42*" -> "7-42", ranges expanded)
    ids = []
    for m in re.finditer(r'(\d)-(\d{2})\**(?:\s*(?:to|-)\s*(\d)-(\d{2}))?', h['mu']):
        a, b = int(m.group(2)), int(m.group(4)) if m.group(4) else int(m.group(2))
        ids += [f"{m.group(1)}-{i}" for i in range(a, b + 1)]
    h['mus'] = ids; h['partial'] = '*' in h['mu']
codes_in_text = set(re.findall(r'(?:^|\s{2})(\d{4})\s{1,8}[A-Z][a-z]+[ A-Za-z\-\.\'/]*\s{2,}\d-\d{2}', '\n'.join(pages[:16]), re.M))
print(len(out), 'hunts of', len(codes_in_text), 'codes seen; missing', sorted(codes_in_text - seen)[:40])
print(collections.Counter((h['sp'], h['rn']) for h in out))
json.dump(out, open('leh_hunts.json', 'w'))
for h in [h for h in out if h['code'] in ('2002', '2011', '4423', '4493', '4494', '1001')]: print(h)
