import json,re
rows=json.load(open('seasons_raw.json'))
M={'jan':1,'feb':2,'mar':3,'apr':4,'may':5,'jun':6,'june':6,'jul':7,'july':7,'aug':8,'sep':9,'sept':9,'oct':10,'nov':11,'dec':12}
def pd(s):
    m=re.match(r'([A-Za-z]+)\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?',s.strip())
    mo=M.get(m.group(1).lower()[:4].rstrip('t') if m.group(1).lower().startswith('sept') else m.group(1).lower()[:3]) or M.get(m.group(1).lower())
    d=int(m.group(2)); y=m.group(3)
    return (f'{y}-' if y else '')+f'{mo:02d}-{d:02d}'
out=[]
for r in rows:
    sp=re.sub(r'\s+\d-\d.*$','',r['species']).strip(' ,&')
    sp=sp.replace("Ross'S","Ross's")
    if sp.lower().startswith(('ruffed','spruce','dusky','grouse')) and 'grouse' not in sp.lower(): sp='Grouse: '+sp
    sp=re.sub(r'^(Cougar|Skunk) & Spruce$',r'\1',sp)
    cls=re.sub(r'^[s\]Hu\*]+(?=[A-Z0-9])','',r['cls']).strip()
    bag=r['bag'] if re.match(r'^[\dH\(\) ]+$|^NBL',r['bag'] or '') else ''
    out.append({'r':r['region'],'sp':sp,'q':r['qual'],'c':cls,'mu':r['mus'],'d':[[pd(a),pd(b)] for a,b in r['dates']],'b':bag,'n':1 if r['note'] else 0,'p':r['page']})
json.dump(out,open('seasons.json','w'),separators=(',',':'))
import collections
print(len(out), len(json.dumps(out,separators=(',',':'))))
print(sorted(collections.Counter(o['sp'] for o in out).items()))
print([o for o in out if o['sp']=='Moose'][:3])
