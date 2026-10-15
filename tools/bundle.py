import os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DS = os.path.join(ROOT, 'data-src') + '/'
DOCS = os.path.join(ROOT, 'docs') + '/'
import re
S=os.path.join(ROOT,'src')+'/'
page=open(S+'page.html').read()
js=''.join(open(S+f).read()+'\n' for f in ['core.js','data_it.js','media_it.js','anatomy.js','genome.js','main.js'])
imp='''<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script>'''
out=page+'\n'+imp+'\n<script type="module">\n'+js+'</script>\n'
open(DOCS+'index.html','w').write(out)
print(len(out))
