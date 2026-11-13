# Run extract_footnote_blocks.py first (needs all.txt from: pdftotext -layout synopsis.pdf all.txt). Writes data/season_notes.json.
import json, re
b = json.load(open('blocks.json'))
d = json.load(open('/home/user/hunthq/hunt-hq-handoff/data/bc_seasons_2026_2028.json'))
def norm(s): return ''.join(ch for ch in s.upper() if ch.isalpha())
MARK = r'(?:\*{1,3}|HH|H|B|s|\]|\+|t|u|p)'
def entries(text):
    text = re.sub(r'\s+\d{1,3}$', '', text)                       # page number
    text = re.sub(r'Region \d\w? – [A-Za-z ]+$', '', text).strip()
    # split at sentence ends and before footnote markers that start a new note
    parts = re.split(r'(?<=[.)])\s+|\s{3,}|\s(?=(?:\*{1,3}|HH|H|B|s|\]|\+|t|u|p)\s?(?:Restricted|Season|Portion|Portions|Part|Parts|A portion|There|See|The|In |On |Open|Those|No |Bag))', text)
    out = []
    for p in parts:
        p = re.sub(r'^' + MARK + r'\s?(?=[A-Z0-9])', '', p.strip()).strip()
        p = p.replace('Mtn', 'mountain').strip(' .')
        if len(p) < 6 or p.lower().startswith(('special areas', 'grouse:', 'pheasant')): continue
        # glue fragments like 'See Map H22' onto the previous note
        if out and re.match(r'^(See (Map|map|regional|LEH|Definitions|details|page|Page)|H\d|Maps? )', p): out[-1] += '. ' + p; continue
        out.append(p)
    return out
res = {}
for p, blks in b.items():
    for x in blks:
        res[f'{p}|{norm(x["sp"])}'] = entries(' '.join(x['notes']))
# map every season row to a block key
keys = {}
for r in d:
    k = norm(r['sp']); cands = [kk for kk in res if kk.startswith(f"{r['p']}|")]
    hit = next((kk for kk in cands if kk.split('|')[1] == k), None) or next((kk for kk in cands if kk.split('|')[1][:6] == k[:6]), None)
    if hit: keys[f"{r['p']}|{r['sp']}"] = hit
used = set(keys.values())
json.dump({'notes': {k: v for k, v in res.items() if k in used}, 'rows': keys}, open('/home/user/hunthq/hunt-hq-handoff/data/season_notes.json', 'w'), indent=0, ensure_ascii=False)
print(len(used), 'blocks for', len(keys), 'species/page combos;', sum(1 for r in d if r['n'] and f"{r['p']}|{r['sp']}" not in keys), 'footnoted rows unmatched')
for k in ['64|ELK', '64|MULEDEERBLACKTAILED', '41|BLACKBEAR', '30|MULEDEERBLACKTAILED']: print(k, json.dumps(res.get(k), indent=1, ensure_ascii=False))
