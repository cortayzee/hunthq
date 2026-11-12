import re, json, subprocess, sys
PDF='/mnt/user-data/uploads/50484fe0-hunting-trapping-synopsis.pdf'
txt=open('/home/claude/syn/syn.txt').read()
pages=txt.split('\f')
MON=r'(?:Jan|Feb|Mar|Apr|May|June|July|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)[a-z]*\.?'
DATE=MON+r'\s+\d{1,2}(?:,?\s*\d{4})?'
RANGE=re.compile('('+DATE+r')\s*[-–]\s*('+DATE+')')
MU=re.compile(r'(\d)\s?[-–]\s?(\d{1,2})(?:\s*to\s*(\d)\s?[-–]\s?(\d{1,2}))?')
rows=[]; pending=None
def expand(t):
    u=[]
    for a1,b1,a2,b2 in MU.findall(t):
        if a2:
            if a1==a2: u+=[f'{a1}-{i}' for i in range(int(b1),int(b2)+1)]
        else: u.append(f'{a1}-{int(b1)}')
    return sorted(set(u),key=lambda x:(int(x.split('-')[0]),int(x.split('-')[1])))

for pi,pg in enumerate(pages):
    lines=pg.split('\n')
    hdr=None; region=None; species=None; pending=None
    for ln in lines:
        m=re.search(r'(\w[\w ]+?) General Open Seasons',ln)
        if m: region=m.group(1).strip()
        if 'SPECIES' in ln and 'MANAGEMENT UNIT' in ln and 'SEASON' in ln:
            hdr={'mu':ln.index('MANAGEMENT UNIT'),'cls':ln.index('CLASS') if 'CLASS' in ln else None,'season':ln.index('SEASON'),'bag':ln.index('BAG') if 'BAG' in ln else 999}
            species=None; continue
        if not hdr: continue
        if re.match(r'^\s*\d+\s{5,}.*Synopsis',ln) or 'Hunting and Trapping Regulations Synopsis' in ln: hdr=None; continue
        a=ln[:hdr['mu']-1]; rest=ln[hdr['mu']-1:]
        lead=a.strip()
        mus=MU.findall(rest[: (hdr['cls']-hdr['mu']+1) if hdr['cls'] else 60])
        ranges=RANGE.findall(rest)
        lead=re.sub(r'\s{3,}.*$','',lead)
        isSp=bool(re.match(r"^[A-Z][A-Z'\-]{2,}(?:[ ,:&]|$)",lead)) or lead.startswith('& ')
        if isSp and not mus:
            # species-only line (possibly continuation)
            if species and lead.startswith('&'): species+=' '+lead
            else: species=lead
            continue
        if isSp:
            species=lead if not lead.startswith('&') else species+' '+lead; qual=''
        else:
            qual=lead if lead and len(lead)<40 else ''
        mutext=rest[: (hdr['cls']-hdr['mu']+1) if hdr['cls'] else 60].strip()
        if mutext.startswith('to ') and rows and rows[-1].get('_open'):
            rows[-1]['muText']+=' '+mutext; rows[-1]['mus']=expand(rows[-1]['muText']); rows[-1]['_open']=False; continue
        if mus and not ranges:
            pending=mutext; continue
        if ranges and not mus and pending:
            mutext=pending; pending=None; openrow=True
        elif mus and ranges:
            pending=None; openrow=mutext.rstrip().endswith((',','3-34')) or bool(re.search(r'\d-\d{1,2}$',mutext)) and False
        else:
            continue
        if not species: continue
        cls=''
        if hdr['cls']:
            c=ln[hdr['cls']-1:hdr['season']-1].strip()
            if not RANGE.search(c): cls=c
        bag=ln[hdr['bag']-2:].strip() if len(ln)>hdr['bag'] else ''
        if RANGE.search(bag): bag=''
        flag=bool(re.search(r'[sHu\]\*]',re.sub(r'\d\s?[-–]\s?\d{1,2}|to',' ',mutext)))
        rows.append({'region':region,'species':species.title(),'qual':qual.strip('*'),'cls':cls,'mus':expand(mutext),'muText':mutext,'dates':[list(r) for r in ranges],'bag':bag,'note':flag,'page':pi+1,'_open':openrow})
for r in rows: r.pop('_open',None)
json.dump(rows,open('/home/claude/work/seasons_raw.json','w'),indent=0)
print(len(rows))
from collections import Counter
print(Counter(r['region'] for r in rows))
print(Counter(r['species'] for r in rows).most_common(60))
