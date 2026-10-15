import os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DS = os.path.join(ROOT, 'data-src') + '/'
DOCS = os.path.join(ROOT, 'docs') + '/'
import json, re, shutil, colorsys, hashlib
SRC=os.environ.get('HUMAN_ATLAS','vendor/human-atlas')+'/public/models/'
OUT=DOCS+'anatomy/'
d=json.load(open(SRC+'atlas.json'))
tr={}
for l in open(DS+'it_names.tsv'):
    e,i,g=l.rstrip('\n').split('\t'); tr[e]=(i,g)
structs=json.load(open(DS+'structures_it.json'))
def base(n): return re.sub(r'\s+',' ',re.sub(r'\b(left|right)\b','',n,flags=re.I)).strip().lower()
def h(s): return int(hashlib.md5(s.encode()).hexdigest()[:6],16)/0xffffff
def hx(c): return int(c.lstrip('#'),16)
def jitter(c,amt,key):
    r,g,b=[((c>>s)&255)/255 for s in (16,8,0)]
    hh,l,s=colorsys.rgb_to_hls(r,g,b)
    t=h(key)-0.5
    l=min(1,max(0,l+t*amt)); 
    r,g,b=colorsys.hls_to_rgb(hh,l,s)
    return (round(r*255)<<16)|(round(g*255)<<8)|round(b*255)
def hue(c,dh,key):
    r,g,b=[((c>>s)&255)/255 for s in (16,8,0)]
    hh,l,s=colorsys.rgb_to_hls(r,g,b)
    hh=(hh+(h(key)-0.5)*dh)%1
    r,g,b=colorsys.hls_to_rgb(hh,l,s)
    return (round(r*255)<<16)|(round(g*255)<<8)|round(b*255)
def fix_system(sys,b):
    if re.search(r'^(fibularis|tibialis) |^levator scapulae$|^subscapularis$|^tensor fasciae latae$|pharyngeal constrictor|^palatopharyngeus$|^salpingopharyngeus$|^stylopharyngeus$',b): return 'muscular'
    if re.search(r'papillary muscle',b): return 'cardiac'
    if re.search(r'^(fourth|third|lateral) ventricle$|interventricular foramen|choroid plexus',b): return 'nervous'
    if b in ('iliotibial tract','flexor retinaculum of wrist'): return 'connective'
    if b=='lacrimal bone': return 'skeletal'
    return sys
def color(sys,b):
    if sys=='skeletal':
        if 'tooth' in b: return 0xf3eddf
        if 'gingiva' in b: return 0xd47c84
        if 'cartilage' in b: return 0xc9d6d2
        if 'intervertebral disk' in b: return 0xcdd8d0
        return jitter(0xe3cfa6,0.05,b)
    if sys=='muscular':
        if b=='diaphragm': return 0xb04a44
        return jitter(0x962f33,0.10,b)
    if sys=='cardiac':
        if 'valve' in b: return 0xead6c4
        if 'cavity' in b: return 0x7c1b28
        if 'papillary' in b: return 0xa83a40
        return 0xa0313b
    if sys=='arterial':
        if re.search(r'pulmonary|segmental artery|lingular artery|lobar artery|segmental branch$|^(apical|anterior|posterior|inferior|superior) part of .*segmental artery|branch of .*segmental artery',b) and 'renal' not in b and 'hepatic' not in b: return 0x3f63bf
        return jitter(0xc4263a,0.06,b)
    if sys=='venous':
        if re.search(r'pulmonary vein|segmental vein|lingular vein|part of .*segmental vein|trunk of apical segmental vein',b): return 0xc63a4c
        if re.search(r'portal|mesenteric|splenic vein|gastric vein|gastroepiploic|pancreaticoduodenal vein|colic vein|ileal vein|ileocolic vein|sigmoid vein|rectal vein',b): return 0x6a4fb0
        if 'hepatovenous' in b: return hue(0x8a3a30,0.12,b)
        return jitter(0x3558ad,0.06,b)
    if sys=='nervous':
        if re.search(r'nerve|ganglion|branch',b): return 0xe9c25b
        if re.search(r'ventricle|foramen|aqueduct|central canal|choroid plexus',b): return 0x5fb3d4
        if re.search(r'white matter|corpus callosum|internal capsule|commissure|fornix|stria|optic tract|optic chiasm|brachium',b): return 0xf0e8dc
        if b=='cerebellum': return 0xcf9d93
        if re.search(r'tentorium',b): return 0xc9c2b4
        return jitter(0xd7aa9c,0.07,b)
    if sys=='respiratory':
        if 'bronchial tree' in b: return hue(0xe5a3ab,0.35,b)
        if 'cartilage' in b or b=='epiglottis' or 'concha' in b: return 0xd3d7cc
        return 0xe0c2b8
    if sys=='digestive':
        if re.search(r'liver|hepatovenous',b): return hue(0x8a3a30,0.06,b)
        if re.search(r'biliary|hepatic duct|cystic duct|duct of caudate',b): return 0x6f9e4f
        if b=='gallbladder': return 0x4f7e3e
        if 'pancrea' in b: return 0xe2b07a
        if b=='tongue': return 0xc65a62
        if 'gland' in b: return 0xe2b58e
        if b=='stomach': return 0xd88672
        if re.search(r'colon|rectum|appendix|cecal|taenia',b): return 0xc98a72 if 'taenia' not in b else 0xe3c9a8
        if re.search(r'mesentery|mesocolon|mesoappendix',b): return 0xead8b0
        return jitter(0xdb9a86,0.06,b)
    if sys=='urinary':
        if b=='kidney': return 0x8c3a33
        if b=='ureter': return 0xd2ae4c
        return 0xd9a27c
    if sys=='reproductive': return jitter(0xc58aa8,0.08,b)
    if sys=='endocrine': return {'adrenal gland':0xd8a43a,'pituitary gland':0xc77f8e,'pineal body':0xb69bc4}.get(b,0x7fb069)
    if sys=='lymphatic': return 0x7a2f4a if b=='spleen' else 0xd2a985
    if sys=='sensory':
        return {'cornea':0xd8eef2,'sclera':0xf2efe8,'iris':0x4c6f8f,'lens':0xeee3b8,'vitreous body':0xcfe6ea,'choroid':0x5a2a2a,'optic part of retina':0xd98c70,'anterior chamber of eyeball':0xbfe0ea,'corona ciliaris':0x6a3a32,'suspensory ligament of lens':0xe8e2d0,'external ear':0xdba48a,'lacrimal gland':0xe3b58e}.get(b, 0xd6c4b4)
    if sys=='integumentary':
        if 'hair' in b or b=='eyebrow': return 0x3b2a20
        if b=='lip': return 0xc4706e
        return 0xd8a688
    if sys=='connective': return 0xd8d0bd
    return 0x999999
parts=[]
miss=set()
for idx,p in enumerate(d['parts']):
    en=p['name']; b=base(en)
    side=0
    if re.search(r'\bleft\b',en,re.I): side=1
    elif re.search(r'\bright\b',en,re.I): side=2
    inner = side and not re.match(r'(left|right)\b',en,re.I)
    it,g=tr.get(b,(en,'m'))
    if b not in tr: miss.add(b)
    sysf=fix_system(p['system'],b)
    bb=[[round(v,4) for v in x] for x in p['bounds']]
    parts.append(dict(id=p['id'],it=it,g=g,en=en,b=b,s=sysf,side=side,inner=1 if inner else 0,ch=p['chunk'],pos=p['positions'],nor=p['normals'],idx=p['indices'],vc=p['vertexCount'],ic=p['indexCount'],bb=bb,c=color(sysf,b)))
print('missing',miss)
# structures membership
groups=[]
for s in structs:
    pats=[re.compile(x) for x in s['match']]
    ex=[re.compile(x) for x in s.get('exclude',[])]
    mem=[i for i,p in enumerate(parts) if any(r.search(p['b']) for r in pats) and not any(r.search(p['b']) for r in ex)]
    g=dict(s); g['parts']=mem; del g['match']; g.pop('exclude',None)
    groups.append(g)
    print(s['key'],len(mem))
systems=json.load(open(DS+'systems_it.json'))
out=dict(version=d['version'],triangles=d['triangles'],chunks=[dict(file=f'anatomy/body-{i}.bin.wasm',bytes=c['bytes']) for i,c in enumerate(d['chunks'])],
 systems=systems,structures=groups,
 parts=[[p['id'],p['it'],p['g'],p['en'],p['s'],p['side'],p['inner'],p['ch'],p['pos'],p['nor'],p['idx'],p['vc'],p['ic'],p['bb'],p['c']] for p in parts])
json.dump(out,open(OUT+'atlas-it.json','w'),separators=(',',':'),ensure_ascii=False)
for i in range(len(d['chunks'])):
    shutil.copy(SRC+f'body-{i}.bin.gz',OUT+f'body-{i}.bin.wasm')
import collections
print(collections.Counter(p['s'] for p in parts))
