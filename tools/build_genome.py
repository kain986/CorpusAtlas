import os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DS = os.path.join(ROOT, 'data-src') + '/'
DOCS = os.path.join(ROOT, 'docs') + '/'
import gzip, json, re, collections, math
IDEO=os.environ.get('IDEOGRAM','vendor/ideogram/package')
C=IDEO+'/dist/data/cache/'
B=IDEO+'/dist/data/bands/native/homo-sapiens-GCF_000001405.26.json'
OUT=DOCS+'data/'
genes=[]
tissue_names=None
for l in gzip.open(C+'genes/homo-sapiens-genes.tsv.gz','rt'):
    if l.startswith('#'): continue
    p=l.rstrip('\n').split('\t')
    chr_,start,ln,slim,sym,desc=p[:6]
    if not re.match(r'^(\d+|X|Y|MT)$',chr_): continue
    desc=desc.replace('%2C',',').replace('%3B',';')
    genes.append(dict(sym=sym,chr=chr_,start=int(start),len=int(ln),desc=desc))
print('genes',len(genes))
# dedupe symbols
seen=set(); g2=[]
for g in genes:
    if g['sym'] in seen: continue
    seen.add(g['sym']); g2.append(g)
genes=g2
syn={}
for l in gzip.open(C+'synonyms/homo-sapiens-synonyms.tsv.gz','rt'):
    if l.startswith('#'): continue
    p=l.rstrip('\n').split('\t'); syn[p[0]]=p[1:]
# structures: first transcript per gene
st={}
for l in gzip.open(C+'gene-structures/homo-sapiens-gene-structures.tsv.gz','rt'):
    if l.startswith('#'): continue
    p=l.rstrip('\n').split('\t')
    g=p[0].rsplit('-',1)[0]
    if g in st: continue
    st[g]=dict(tx=p[0],strand=p[3],feats=p[4:])
# proteins
dom={}; prot={}
for l in gzip.open(C+'proteins/homo-sapiens-proteins.tsv.gz','rt'):
    if l.startswith('## domain keys:'):
        for e in l.split('domain keys:')[1].split(';'):
            if ' = ' in e:
                k,v=e.split(' = ',1); dom[k.strip()]=v.strip()
        continue
    if l.startswith('#'): continue
    p=l.rstrip('\n').split('\t')
    if re.match(r'^\d+$',p[0]): continue
    g=p[0].rsplit('-',1)[0]
    if g not in prot: prot[g]=(p[0],p[1:])
# tissues
tis={}
for l in gzip.open(C+'tissues/homo-sapiens-tissues.tsv.gz','rt'):
    if l.startswith('## tissues:'):
        tissue_names=[e.split(',')[0] for e in l.split('tissues: ')[1].strip().split(';')]
        continue
    if l.startswith('#'): continue
    p=l.rstrip('\n').split('\t'); g=p[0]
    if g in tis: continue
    vals=[0.0]*len(tissue_names)
    for e in p[1:]:
        r=e.split(';'); n=len(r)
        r=[x if x!='' else '0' for x in r]
        if n==15: r.insert(1,'0')
        elif n==14: r[1:1]=['0','0']
        elif n==13: r[1:1]=['0','0','0']
        tid=int(r[0]); med=float(r[3])
        if tid<len(vals): vals[tid]=med
    tis[g]=vals
print('tissue genes',len(tis),'tissues',len(tissue_names))
# bands
bands=json.load(open(B))['chrBands']
bl=collections.defaultdict(list); chrlen={}
for b in bands:
    f=b.split(' ')
    c,arm,band,_,_,s,e,stain=f[0],f[1],f[2],f[3],f[4],int(f[5]),int(f[6]),(f[7]+(f[8] if len(f)>8 and f[8] else ''))
    bl[c].append((arm+band,s,e,stain)); chrlen[c]=max(chrlen.get(c,0),e)
chrlen['MT']=16569
def cyto(c,pos):
    for name,s,e,_ in bl.get(c,[]):
        if s<=pos<=e: return name
    return ''
json.dump(dict(bands={c:[[n,s,e,st_] for n,s,e,st_ in v] for c,v in bl.items()},lengths=chrlen,tissues=tissue_names),open(OUT+'karyo.json','w'),separators=(',',':'))
# core index
rows=[]; det=[]
for g in genes:
    s=g['sym']; S=st.get(s)
    typ='c' if S else 'n'
    strand=S['strand'] if S else ''
    band=cyto(g['chr'],g['start'])
    rows.append('\t'.join([s,g['chr'],str(g['start']),str(g['len']),g['desc'],typ,strand,band,'|'.join(syn.get(s,[]))]))
    # details
    ex=[]; utr=[]
    if S:
        for f in S['feats']:
            t,a,b=f.split(';'); ex.append(f'{t},{a},{b}')
    pr=''
    if s in prot:
        pr=' '.join(prot[s][1])
    tv=''
    if s in tis:
        tv=','.join(('%g'%round(v,1)) if v>=0.05 else '' for v in tis[s])
    if S or pr or tv:
        det.append('\t'.join([s,S['tx'] if S else '',' '.join(ex),pr,tv]))
with gzip.open(OUT+'genes.tsv.wasm','wt',compresslevel=9) as f: f.write('\n'.join(rows))
with gzip.open(OUT+'gene-details.tsv.wasm','wt',compresslevel=9) as f: f.write('\n'.join(det))
used=set()
for s,(tx,feats) in prot.items():
    for ft in feats:
        k=ft.split(';')[0]
        if k in dom: used.add(k)
json.dump({k:dom[k] for k in used},open(OUT+'domains.json','w'),separators=(',',':'))
print('rows',len(rows),'details',len(det),'domains',len(used))
