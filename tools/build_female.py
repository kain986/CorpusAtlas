import os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DS = os.path.join(ROOT, 'data-src') + '/'
DOCS = os.path.join(ROOT, 'docs') + '/'
import json, re, shutil, colorsys, hashlib
import json, re, shutil, colorsys, hashlib
SRC=os.environ.get('FEMALE_SRC','vendor/female')+'/'; OUT=DOCS+'anatomy/'
d=json.load(open(SRC+'atlas-female.json'))
tr={}
for l in open(DS+'it_female.tsv'):
    e,i,g=l.rstrip('\n').split('\t'); tr[e]=(i,g)
def h(s): return int(hashlib.md5(s.encode()).hexdigest()[:6],16)/0xffffff
def adj(c,dl=0,dh=0,key=''):
    r,g,b=[((c>>s)&255)/255 for s in (16,8,0)]; hh,l,s=colorsys.rgb_to_hls(r,g,b)
    t=h(key)-0.5; l=min(.95,max(.05,l+t*dl)); hh=(hh+t*dh)%1
    r,g,b=colorsys.hls_to_rgb(hh,l,s); return (round(r*255)<<16)|(round(g*255)<<8)|round(b*255)
def base(n):
    n=re.sub(r'\(\s*(left|right)?\s*\)','',n,flags=re.I); n=re.sub(r'\b(left|right)\b','',n,flags=re.I)
    n=re.sub(r'segment1$','segment',n.strip(),flags=re.I); return re.sub(r'\s+',' ',n).strip().lower()
def sysfix(s,b,pid):
    if s=='cardiac' and not re.search(r'atrium|ventricle|valve|papillary|septum',b): return 'arterial' if not re.search(r'vein|sinus',b) else 'venous'
    if s=='venous' and 'artery' in b: return 'arterial'
    if s=='sensory' and re.search(r'dura mater|optic (nerve|chiasma|tract|radiation)|nuclear|nucleus|hth|thalamus',b): return 'nervous'
    if s=='integumentary' and re.search(r'mammary lobe|lactiferous|nipple|areola|suspensory ligament of breast|areolar',b): return 'reproductive'
    if s=='lymphatic' and 'thymus' in b: return 'lymphatic'
    if s=='skeletal' and re.search(r'ligament|enthesis|perichond|articular disk',b): return 'connective'
    if s=='muscular' and 'tendon' in b: return 'connective'
    if b=='pineal body': return 'endocrine'
    return s
def color(s,b,pid):
    if s=='skeletal':
        if 'trabecular' in b: return 0xd9a77f
        if 'cartilage' in b: return 0xc9d6d2
        return adj(0xe3cfa6,0.05,0,b)
    if s=='connective':
        if 'articular disk' in b: return 0xc9d6d2
        return adj(0xd7ccb4,0.08,0,b)
    if s=='muscular': return adj(0x962f33,0.1,0,b)
    if s=='cardiac':
        if 'valve' in b: return 0xead6c4
        if 'septum' in b: return 0x8c2833
        if 'papillary' in b: return 0xa83a40
        return 0xa0313b
    if s=='arterial':
        if 'pulmonary' in b: return 0x3f63bf
        return adj(0xc4263a,0.08,0,pid)
    if s=='venous':
        if 'pulmonary vein' in b: return 0xc63a4c
        if re.search(r'portal|mesenteric|splenic vein|colic vein|ileocolic|sigmoid vein|rectal vein|pancreaticoduodenal|cystic vein',b): return 0x6a4fb0
        return adj(0x3558ad,0.08,0,pid)
    if s=='nervous':
        if re.search(r'spinal cord',b): return 0xead9b0 if int(re.search(r'(\d|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)',b).group(0)[0].isdigit() or 1) and ('cervical' in b) else (0xe2cfa0 if 'thoracic' in b else (0xd9c08c if 'lumbar' in b else 0xcfb27c))
        if re.search(r'optic|dura',b): return 0xe9c25b
        if re.search(r'ventricle|horn of lateral|aqueduct|central canal',b): return 0x5fb3d4
        if re.search(r'white matter|corpus callosum|commissure|fornix|tract|peduncle|radiation',b): return 0xf0e8dc
        if re.search(r'cerebell|vermis',b): return adj(0xcf9d93,0.08,0.03,pid)
        if re.search(r'thalam|pulvinar|geniculate|habenul',b): return adj(0xb98ec9,0.10,0.04,pid)
        if re.search(r'caudate|putamen|pallidus|accumbens|claustrum|subthalamic|nigra|red nucleus',b): return adj(0x8e86d6,0.10,0.05,pid)
        if re.search(r'hippocamp|amygd|cortical nucleus|nucleus|nuclear|hth|hypothalamus|septal|olfactory|ambiens|piriform',b): return adj(0xd68aa8,0.10,0.05,pid)
        return adj(0xd7aa9c,0.12,0.06,b)
    if s=='respiratory':
        if 'cartilage' in b: return 0xd3d7cc
        if 'bronchopulmonary segment' in b: return adj(0xe5a3ab,0.15,0.5,pid)
        return 0xe0c2b8
    if s=='digestive':
        if re.search(r'gallbladder',b): return 0x4f7e3e
        if re.search(r'bile|hepatic duct|cystic duct|ampulla|sphincter',b): return 0x6f9e4f
        if re.search(r'liver|segment$|porta|falciform|ligamentum venosum',b): return adj(0x8a3a30,0.12,0.08,pid)
        if 'pancrea' in b: return adj(0xe2b07a,0.08,0,b)
        if re.search(r'tonsil',b): return 0xc66a72
        if re.search(r'colon|rectum|appendix|caecum|ileocecal',b): return adj(0xc98a72,0.06,0,b)
        return adj(0xdb9a86,0.06,0,b)
    if s=='urinary':
        if 'cortex' in b or 'capsule' in b: return 0x8c3a33
        if 'column' in b: return 0xa04a40
        if 'pyramid' in b: return 0xb8644f
        if 'papilla' in b: return 0xc77c5a
        if re.search(r'calyx|pelvis|ureter',b): return 0xd2ae4c
        if 'hilum' in b: return 0xe0c48a
        return 0xd9a27c
    if s=='reproductive':
        if 'ovar' in b or 'mesovarium' in b: return 0xe6c2a6
        if 'tube' in b or 'mesosalpinx' in b: return 0xe2879c
        if 'ligament' in b: return 0xd6b3c4
        if re.search(r'mammary|lactiferous',b): return 0xf0c9a8
        if re.search(r'nipple|areola',b): return 0xb5675e
        return adj(0xc7768d,0.08,0,b)
    if s=='endocrine': return 0xb69bc4
    if s=='lymphatic':
        if 'spleen' in b: return adj(0x7a2f4a,0.08,0,b)
        if 'thymus' in b: return 0xd2a985
        return adj(0x9b8bd6,0.15,0.1,b)
    if s=='sensory':
        return {'cornea':0xd8eef2,'sclera':0xf2efe8,'iris':0x4c6f8f,'pupil':0x111418,'lens':0xeee3b8,'humor of vitreous body':0xcfe6ea,'aqueous humor of eyeball':0xbfe0ea,'choroid':0x5a2a2a,'retina':0xd98c70,'macula lutea':0xd8b45c,'fovea centralis':0xe0a050,'optic disc':0xf0d0a0,'ciliary body':0x6a3a32,'ciliary muscle':0x8a3a3a,'ciliary processes':0x7a3a32}.get(b,0xd6c4b4)
    if s=='pregnancy':
        if 'artery' in b: return 0xc4263a
        if 'vein' in b: return 0x3558ad
        if 'cord' in b: return 0xe8e0d0
        if 'amnion' in b: return 0xd8e4ec
        return 0xa8485c
    if s=='integumentary':
        if 'adipose' in b: return 0xf0d48a
        return 0xd8a688
    return 0x999999
parts=[]
miss=set()
for p in d['parts']:
    en=p['name']; b=base(en); pid=p['id']
    side=1 if (re.search(r'\bleft\b',en,re.I) or re.search(r'_L$',pid)) else 2 if (re.search(r'\bright\b',en,re.I) or re.search(r'_R$',pid)) else 0
    it,g=tr.get(b,(en,'m'))
    if b not in tr: miss.add(b)
    m=re.match(r'VH_F_(ilium|ischium|pubis)_(compact|spongy)_bone',pid)
    if m:
        it={'ilium':'Ileo','ischium':'Ischio','pubis':'Pube'}[m.group(1)]+(' · osso compatto' if m.group(2)=='compact' else ' · osso spugnoso'); g='m'
    s=sysfix(p['system'],b,pid)
    bb=[[round(v,4) for v in x] for x in p['bounds']]
    parts.append(dict(id=pid,it=it,g=g,en=re.sub(r'\s*\(\s*\)','',en),b=b,s=s,side=side,ch=p['chunk'],pos=p['positions'],nor=p['normals'],idx=p['indices'],vc=p['vertexCount'],ic=p['indexCount'],bb=bb,c=color(s,b,pid)))
print('missing',miss)
male=json.load(open(OUT+'atlas-it.json'))
mstructs={s['key']:s for s in male['structures']}
F=json.load(open(DS+'structures_it_female.json'))
systems=json.loads(json.dumps(male['systems']))
for k,v in F['systems'].items():
    systems.setdefault(k,{}).update(v)
groups=[]
for s in F['structures']:
    g={}
    if 'ref' in s: r=mstructs[s['ref']]; g.update({k:r[k] for k in ('key','name','sys','desc','facts')})
    for k in ('key','name','sys','desc','facts'):
        if k in s: g[k]=s[k]
    g.setdefault('facts',[])
    pats=[re.compile(x) for x in s['match']]; ex=[re.compile(x) for x in s.get('exclude',[])]
    g['parts']=[i for i,p in enumerate(parts) if any(r.search(p['b']) for r in pats) and not any(r.search(p['b']) for r in ex)]
    print(g['key'],len(g['parts'])); groups.append(g)
un=[p['b'] for i,p in enumerate(parts) if not any(i in g['parts'] for g in groups)]
print('unassigned',sorted(set(un)))
out=dict(version=d['version'],triangles=d['triangles'],chunks=[dict(file=f'anatomy/female-{i}.bin.wasm',bytes=c['bytes']) for i,c in enumerate(d['chunks'])],systems=systems,structures=groups,
 parts=[[p['id'],p['it'],p['g'],p['en'],p['s'],p['side'],0,p['ch'],p['pos'],p['nor'],p['idx'],p['vc'],p['ic'],p['bb'],p['c']] for p in parts])
json.dump(out,open(OUT+'atlas-it-f.json','w'),separators=(',',':'),ensure_ascii=False)
for i in range(len(d['chunks'])): shutil.copy(SRC+f'female-{i}.bin.gz',OUT+f'female-{i}.bin.wasm')
import collections; print(collections.Counter(p['s'] for p in parts))
