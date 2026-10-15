// =====================================================================
//  ANATOMIA
// =====================================================================
const SYS_ORDER = ['skeletal', 'muscular', 'cardiac', 'arterial', 'venous', 'nervous', 'respiratory', 'digestive', 'urinary', 'reproductive', 'endocrine', 'lymphatic', 'sensory', 'connective', 'integumentary', 'pregnancy'];
const PRESETS = [
  { k: 'intero', n: 'Corpo intero', s: ['skeletal', 'muscular', 'cardiac', 'arterial', 'venous', 'nervous', 'respiratory', 'digestive', 'urinary', 'reproductive', 'endocrine', 'lymphatic', 'sensory', 'connective'] },
  { k: 'organi', n: 'Organi interni', s: ['skeletal', 'cardiac', 'respiratory', 'digestive', 'urinary', 'reproductive', 'endocrine', 'lymphatic', 'nervous', 'sensory'] },
  { k: 'scheletro', n: 'Scheletro', s: ['skeletal', 'connective'] },
  { k: 'muscoli', n: 'Muscoli', s: ['muscular', 'skeletal', 'connective'] },
  { k: 'circolo', n: 'Circolazione', s: ['cardiac', 'arterial', 'venous'] },
  { k: 'nervoso', n: 'Sistema nervoso', s: ['nervous', 'sensory'] },
  { k: 'pelle', n: 'Con la pelle', s: ['skeletal', 'muscular', 'cardiac', 'arterial', 'venous', 'nervous', 'respiratory', 'digestive', 'urinary', 'reproductive', 'endocrine', 'lymphatic', 'sensory', 'connective', 'integumentary'] },
];
const MODELS = {
  m: { file: 'anatomy/atlas-it.json', label: 'Maschile', who: 'un uomo adulto', preset: 'intero',
    intro: 'ricostruite da sezioni anatomiche di un maschio adulto: ossa, muscoli, vasi, nervi e organi, ciascuna selezionabile.',
    note: 'Il modello rappresenta un maschio adulto di riferimento (BodyParts3D, DBCLS).',
    start: ['cuore', 'encefalo', 'fegato', 'albero-bronchiale', 'occhio', 'colonna', 'mano', 'reni'] },
  f: { file: 'anatomy/atlas-it-f.json', label: 'Femminile', who: 'una donna adulta', preset: 'pelle',
    intro: 'del modello femminile di riferimento dello Human Reference Atlas: organi interni molto dettagliati (encefalo, reni, polmoni per segmenti, fegato, apparato genitale, mammella), midollo spinale, colonna, bacino e ginocchio. Lo scheletro e i muscoli sono rappresentati solo in parte: per quelli usa il modello maschile.',
    note: 'Il modello rappresenta una donna adulta di riferimento (Human Reference Atlas, HuBMAP, versione 1.5).',
    start: ['utero', 'ovaie-tube', 'mammella', 'cuore-f', 'reni-f', 'encefalo', 'midollo', 'ginocchio'] },
};
const SIDE_ADJ = { m: ['sinistro', 'destro'], f: ['sinistra', 'destra'], mp: ['sinistri', 'destri'], fp: ['sinistre', 'destre'] };

function materialFor(sys) {
  const P = (o) => new THREE.MeshPhysicalMaterial(Object.assign({ color: 0xffffff, roughness: 0.5, metalness: 0 }, o));
  switch (sys) {
    case 'skeletal': return P({ roughness: 0.62, clearcoat: 0.15, clearcoatRoughness: 0.6, sheen: 0.3, sheenColor: new THREE.Color(0xfff4e0), sheenRoughness: 0.8 });
    case 'muscular': return P({ roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.8, sheenColor: new THREE.Color(0xff9a8e), sheenRoughness: 0.45 });
    case 'arterial': case 'venous': return P({ roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.25 });
    case 'cardiac': return P({ roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3, sheen: 0.4, sheenColor: new THREE.Color(0xff8080) });
    case 'nervous': return P({ roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffe6d6) });
    case 'integumentary': return P({ roughness: 0.55, transparent: true, opacity: 0.2, depthWrite: false, sheen: 0.6, sheenColor: new THREE.Color(0xffd8c0) });
    case 'sensory': return P({ roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15 });
    case 'connective': return P({ roughness: 0.45, clearcoat: 0.4, sheen: 0.5, sheenColor: new THREE.Color(0xffffff) });
    default: return P({ roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.3, sheen: 0.3, sheenColor: new THREE.Color(0xffd0c0) });
  }
}

function rimMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uInt: { value: 0.8 } },
    vertexShader: `#include <common>
#include <clipping_planes_pars_vertex>
varying vec3 vN; varying vec3 vV;
void main(){ vec4 mvPosition = modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mvPosition.xyz); gl_Position=projectionMatrix*mvPosition;
#include <clipping_planes_vertex>
}`,
    fragmentShader: `#include <clipping_planes_pars_fragment>
uniform vec3 uColor; uniform float uInt; varying vec3 vN; varying vec3 vV;
void main(){
#include <clipping_planes_fragment>
float f = pow(1.0-abs(dot(normalize(vN),normalize(vV))), 2.2); gl_FragColor = vec4(uColor*(0.03+f*uInt), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, clipping: true, side: THREE.FrontSide,
  });
}

const A = {
  data: null, parts: [], structs: [], sysInfo: {}, meshes: {}, mats: {}, loc: [], geoms: [], cent: [],
  visibleSys: new Set(), hidden: new Set(), isolated: null, selected: null, selectedStruct: null,
  explode: 0, ghost: 0.08, loaded: 0, structOf: [], hover: -1, ready: false,
};

function partName(i) {
  const p = A.parts[i]; const [, it, g, , , side, inner] = p;
  if (!side || inner) return it;
  const adj = SIDE_ADJ[g][side - 1];
  const m = it.match(/^(.*?)(\s*\(.*\))$/);
  return m ? `${m[1]} ${adj}${m[2]}` : `${it} ${adj}`;
}
function sideLabel(i) { const p = A.parts[i]; return p[5] ? (p[5] === 1 ? 'lato sinistro' : 'lato destro') : ''; }

const anatStage = $('#anat-stage');
let AV = null; // viewport

async function initAnatomy() {
  AV = new Viewport(anatStage, { ao: true, fov: 30, near: 0.01, far: 20 });
  const scn = AV.scene;
  const key = new THREE.DirectionalLight(0xfff1e0, 1.6); key.position.set(1.2, 2.6, 2.2); scn.add(key);
  const rim = new THREE.DirectionalLight(0x9db7ff, 0.9); rim.position.set(-2, 1.5, -2.5); scn.add(rim);
  const fill = new THREE.HemisphereLight(0xdfe8ff, 0x2a1d1a, 0.35); scn.add(fill);
  // pedana
  const disk = new THREE.Mesh(new THREE.CircleGeometry(0.62, 96), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: {},
    vertexShader: 'varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: 'varying vec2 vU; void main(){ float d=distance(vU,vec2(.5))*2.0; float a=smoothstep(1.0,0.0,d)*0.55; float ring=smoothstep(0.01,0.0,abs(d-0.92))*0.16; gl_FragColor=vec4(vec3(0.55,0.62,0.75)*(a*0.25+ring), a*0.6+ring);} '
  }));
  disk.rotation.x = -Math.PI / 2; disk.position.y = -0.002; scn.add(disk); A.disk = disk;

  const camHome = () => { AV.controls.target.set(0, 0.86, 0); AV.camera.position.set(1.05, 1.12, 3.45); AV.controls.update(); };
  A.home = () => AV.flyTo(new THREE.Vector3(0, 0.86, 0), isNarrow() ? new THREE.Vector3(1.4, 1.2, 5.0) : new THREE.Vector3(1.05, 1.12, 3.45));
  camHome(); if (isNarrow()) AV.camera.position.set(1.4, 1.2, 5.0);
  AV.controls.minDistance = 0.08; AV.controls.maxDistance = 9;

  wireAnatUI();
  wireAnatInteractions();
  setQuality(lsGet('corpus.hq', !isNarrow()));
  await switchModel(lsGet('corpus.sex', 'm'));
}

A.models = {};
function useModel(M) {
  Object.assign(A, { sex: M.sex, data: M.data, parts: M.parts, structs: M.structs, sysInfo: M.sysInfo, structOf: M.structOf,
    meshes: M.meshes, mats: M.mats, loc: M.loc, geoms: M.geoms, cent: M.cent });
  for (const k in A.models) A.models[k].group.visible = A.models[k] === M;
  A.hidden.clear(); A.isolated = null; A.selected = null; A.selectedStruct = null;
  if (A.hoverMesh) A.hoverMesh.visible = false; A.hover = -1;
  buildAnatLists(); applyPreset(MODELS[M.sex].preset, true);
  setDoubleSide(AV.renderer.clippingPlanes.length > 0);
  $$('#sex-sw button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sex === M.sex)));
}
async function switchModel(sex) {
  if (!MODELS[sex]) sex = 'm';
  if (A.sex === sex || A.switching) return;
  A.switching = true; lsSet('corpus.sex', sex);
  if (A.overlays.length || A.selected != null || A.selectedStruct != null) { clearOverlays(); setGhost(false); }
  $$('#sex-sw button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sex === sex)));
  const bar = $('#anat-bar'), sub = $('#anat-sub'), loader = $('#anat-loader');
  let M = A.models[sex];
  try {
    if (M) { useModel(M); applyExplode(); A.ready = true; }
    else {
      A.ready = false; loader.classList.remove('done'); bar.style.width = '0%';
      $('#anat-ttl').textContent = sex === 'f' ? 'Composizione del corpo femminile' : 'Composizione del corpo maschile';
      sub.textContent = 'Lettura dell\'indice delle strutture…';
      const data = JSON.parse(await fetchText(MODELS[sex].file));
      M = A.models[sex] = { sex, data, parts: data.parts, structs: data.structures, sysInfo: data.systems, meshes: {}, mats: {}, loc: [], geoms: [], cent: [], group: new THREE.Group() };
      M.structOf = M.parts.map(() => []); M.structs.forEach((st, si) => st.parts.forEach(pi => M.structOf[pi].push(si)));
      const tot = {};
      for (const p of M.parts) { const t = tot[p[4]] || (tot[p[4]] = { n: 0, v: 0, i: 0 }); t.n++; t.v += p[11]; t.i += p[12]; }
      for (const s of SYS_ORDER) {
        if (!tot[s]) continue;
        const mat = M.mats[s] = materialFor(s);
        const bm = new THREE.BatchedMesh(tot[s].n, tot[s].v, tot[s].i, mat);
        bm.sortObjects = s === 'integumentary'; bm.perObjectFrustumCulled = true; bm.frustumCulled = false;
        bm.userData.sys = s; bm.userData.inv = [];
        if (s === 'integumentary') bm.renderOrder = 10;
        M.meshes[s] = bm; M.group.add(bm);
      }
      AV.scene.add(M.group);
      useModel(M);
      const n = data.chunks.length; const prog = new Array(n).fill(0);
      const upd = () => { const f = prog.reduce((x, y) => x + y, 0) / n; bar.style.width = (f * 100).toFixed(1) + '%'; };
      const col = new THREE.Color();
      const byChunk = Array.from({ length: n }, () => []);
      M.parts.forEach((p, i) => byChunk[p[7]].push(i));
      const queue = [...Array(n).keys()];
      const worker = async () => {
        while (queue.length) {
          const ci = queue.shift();
          const buf = await fetchBytes(data.chunks[ci].file, f => { prog[ci] = f * 0.9; upd(); });
          for (const i of byChunk[ci]) {
            const p = M.parts[i];
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, p[8], p[11] * 3), 3));
            g.setAttribute('normal', new THREE.BufferAttribute(new Int16Array(buf, p[9], p[11] * 3), 3, true));
            g.setIndex(new THREE.BufferAttribute(new Uint32Array(buf, p[10], p[12]), 1));
            M.geoms[i] = g;
            const bm = M.meshes[p[4]];
            const gid = bm.addGeometry(g); const inst = bm.addInstance(gid);
            bm.setColorAt(inst, col.setHex(p[14]));
            bm.userData.inv[inst] = i; M.loc[i] = inst;
            const bb = p[13]; M.cent[i] = new THREE.Vector3((bb[0][0] + bb[1][0]) / 2, (bb[0][1] + bb[1][1]) / 2, (bb[0][2] + bb[1][2]) / 2);
            if (A.sex === sex) {
              if (A.explode > 0) bm.setMatrixAt(inst, matFor(i));
              if (A.hidden.has(i) || (A.isolated && !A.isolated.has(i))) bm.setVisibleAt(inst, false);
            }
          }
          prog[ci] = 1; upd();
          sub.textContent = `Strutture caricate: ${fmtInt(M.loc.filter(x => x !== undefined).length)} di ${fmtInt(M.parts.length)}`;
          AV.invalidate();
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      if (A.sex === sex) applyExplode();
      A.ready = true;
      sub.textContent = `${fmtInt(M.parts.length)} strutture · ${fmtInt(data.triangles)} triangoli`;
      setTimeout(() => loader.classList.add('done'), 350);
    }
  } catch (err) { console.error(err); sub.textContent = 'Errore: ' + err.message; }
  finally { A.switching = false; }
  renderAnatEmpty(); A.home(); AV.invalidate();
}

// -------- trasformazioni (esploso) --------
const _m = new THREE.Matrix4(), _v = new THREE.Vector3();
const EXPLODE_W = { integumentary: 1.7, muscular: 1.35, connective: 1.2, skeletal: 1.0, arterial: 0.85, venous: 0.85, nervous: 0.9, sensory: 1.0 };
function offsetFor(i, out = new THREE.Vector3()) {
  const c = A.cent[i]; const s = A.parts[i][4];
  if (!c || A.explode <= 0) return out.set(0, 0, 0);
  const w = (EXPLODE_W[s] ?? 0.75) * A.explode;
  out.set(c.x * 1.6, (c.y - 0.95) * 0.55, c.z * 1.6 + (s === 'muscular' || s === 'integumentary' ? Math.sign(c.z || 1) * 0.05 : 0)).multiplyScalar(w);
  return out;
}
function matFor(i) { offsetFor(i, _v); return _m.makeTranslation(_v.x, _v.y, _v.z); }
function applyExplode() {
  for (let i = 0; i < A.parts.length; i++) { if (A.loc[i] === undefined) continue; A.meshes[A.parts[i][4]].setMatrixAt(A.loc[i], matFor(i)); }
  for (const o of A.overlays || []) offsetFor(o.userData.pi, o.position);
  if (A.hoverMesh && A.hover >= 0) offsetFor(A.hover, A.hoverMesh.position);
  AV.invalidate();
}

// -------- visibilità --------
function isPartVisible(i) {
  return A.visibleSys.has(A.parts[i][4]) && !A.hidden.has(i) && (!A.isolated || A.isolated.has(i));
}
function refreshVisibility() {
  for (const s in A.meshes) A.meshes[s].visible = A.visibleSys.has(s);
  for (let i = 0; i < A.parts.length; i++) {
    if (A.loc[i] === undefined) continue;
    const s = A.parts[i][4];
    const vis = !A.hidden.has(i) && (A.isolated ? A.isolated.has(i) : true);
    A.meshes[s].setVisibleAt(A.loc[i], vis);
  }
  if (A.isolated) { const ss = new Set([...A.isolated].map(i => A.parts[i][4])); for (const s in A.meshes) A.meshes[s].visible = ss.has(s); }
  updateSysUI(); AV && AV.invalidate();
}
function applyPreset(k, silent) {
  const p = PRESETS.find(x => x.k === k); A.visibleSys = new Set(p.s); A.isolated = null; A.hidden.clear();
  $$('#presets .chip').forEach(c => c.classList.toggle('on', c.dataset.k === k));
  refreshVisibility(); if (!silent) clearSelection();
}

// -------- selezione e messa a fuoco --------
A.overlays = [];
function clearOverlays() { for (const o of A.overlays) { AV.scene.remove(o); if (o.material.dispose && o.userData.own) o.material.dispose(); } A.overlays = []; }
function setGhost(on) {
  const op = A.ghost;
  for (const s in A.mats) {
    const m = A.mats[s]; const base = s === 'integumentary' ? 0.2 : 1;
    if (on && op < 0.999) { m.transparent = true; m.opacity = Math.min(base, op * (s === 'integumentary' ? 0.5 : 1)); m.depthWrite = false; m.color.setRGB(0.62, 0.7, 0.85); }
    else { m.transparent = s === 'integumentary'; m.opacity = base; m.depthWrite = s !== 'integumentary'; m.color.setRGB(1, 1, 1); }
    m.needsUpdate = true;
  }
  for (const s in A.meshes) A.meshes[s].sortObjects = on || s === 'integumentary';
  A.ghosting = on && op < 0.999;
  if (AV) { AV.aoEnabled = A.hq && !A.ghosting; AV.invalidate(); }
}
function showOverlays(list) {
  clearOverlays();
  const col = new THREE.Color();
  for (const i of list) {
    const g = A.geoms[i]; if (!g) continue;
    const m = materialFor(A.parts[i][4]); m.color.setHex(A.parts[i][14]);
    if (A.parts[i][4] === 'integumentary') { m.opacity = 0.6; }
    m.emissive = col.set(0xe8789c).clone(); m.emissiveIntensity = 0.02;
    const solid = new THREE.Mesh(g, m); solid.userData = { pi: i, own: true }; solid.renderOrder = 20;
    offsetFor(i, solid.position);
    const rim = new THREE.Mesh(g, A.rimMat || (A.rimMat = rimMaterial(0xe8789c))); rim.userData = { pi: i }; rim.renderOrder = 21;
    offsetFor(i, rim.position);
    AV.scene.add(solid, rim); A.overlays.push(solid, rim);
  }
  AV.invalidate();
}
function focusParts(list, fly = true) {
  showOverlays(list);
  // nasconde le istanze originali per evitare sovrapposizioni
  for (const i of list) if (A.loc[i] !== undefined) A.meshes[A.parts[i][4]].setVisibleAt(A.loc[i], false);
  setGhost(true);
  if (fly) frameParts(list);
}
function unfocus() {
  clearOverlays(); setGhost(false); refreshVisibility();
}
function frameParts(list) {
  const box = new THREE.Box3();
  for (const i of list) { const b = A.parts[i][13]; const o = offsetFor(i); box.expandByPoint(_v.set(b[0][0] + o.x, b[0][1] + o.y, b[0][2] + o.z)); box.expandByPoint(_v.set(b[1][0] + o.x, b[1][1] + o.y, b[1][2] + o.z)); }
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3()).length();
  const dist = clamp(size / (2 * Math.tan(THREE.MathUtils.degToRad(AV.camera.fov) / 2)) * 1.25, 0.12, 6);
  const dir = AV.camera.position.clone().sub(AV.controls.target).normalize();
  if (isNarrow()) {
    // sul telefono la scheda copre la metà inferiore: sposta l'oggetto nella metà alta
    const d2 = dist * 1.35; const up = new THREE.Vector3(0, 1, 0).applyQuaternion(AV.camera.quaternion);
    const t = c.clone().addScaledVector(up, -d2 * Math.tan(THREE.MathUtils.degToRad(AV.camera.fov) / 2) * 0.5);
    AV.flyTo(t, t.clone().add(dir.multiplyScalar(d2)));
  } else AV.flyTo(c, c.clone().add(dir.multiplyScalar(dist)));
}
function selectPart(i, { fly = false } = {}) {
  A.selected = i; A.selectedStruct = null;
  focusParts([i], fly);
  renderPartCard(i);
  $$('#struct-list .st-btn').forEach(b => b.classList.remove('on'));
  if (isNarrow()) openSheet('anat-info');
}
function selectStruct(si, { fly = true } = {}) {
  const s = A.structs[si]; A.selectedStruct = si; A.selected = null;
  // assicura visibilità del sistema delle parti
  focusParts(s.parts, fly);
  renderStructCard(si);
  $$('#struct-list .st-btn').forEach(b => b.classList.toggle('on', +b.dataset.si === si));
  if (isNarrow()) { closeSheet('anat-left'); openSheet('anat-info'); }
}
function clearSelection() {
  A.selected = null; A.selectedStruct = null; unfocus(); renderAnatEmpty();
  $$('#struct-list .st-btn').forEach(b => b.classList.remove('on'));
}

// -------- descrizioni generiche per tipo --------
function kindDesc(i) {
  const p = A.parts[i]; const b = p[3].toLowerCase().replace(/\b(left|right)\b ?/g, '').trim(); const s = p[4];
  const T = [];
  const has = r => r.test(b);
  if (has(/spinal cord/)) return 'Segmento del midollo spinale: il tratto da cui nasce un paio di nervi spinali, uno per lato. Ogni segmento riceve la sensibilità di una fascia di pelle (dermatomero) e comanda un gruppo di muscoli (miotomero).';
  if (has(/bronchopulmonary segment/)) return 'Segmento broncopolmonare: unità anatomica e chirurgica del polmone, ventilata da un proprio bronco segmentale e irrorata da un proprio ramo dell\'arteria polmonare. Può essere asportata da sola, risparmiando il resto del polmone.';
  if (has(/compact bone/)) return 'Osso compatto (corticale): lo strato esterno, denso e resistente, formato da osteoni concentrici attraversati da canali con vasi e nervi. Costituisce circa l\'80% della massa scheletrica.';
  if (has(/trabecular bone/)) return 'Osso spugnoso (trabecolare): una rete tridimensionale di sottili trabecole orientate secondo le linee di carico. Gli spazi tra le trabecole contengono il midollo osseo rosso, che produce le cellule del sangue.';
  if (has(/impression of liver|surface of (liver|spleen)/)) return 'Area della superficie dell\'organo modellata dal contatto con un organo vicino: il fegato e la milza sono morbidi e prendono la forma di ciò che li circonda.';
  if (has(/renal (pyramid|papilla|column)|calyx|cortex of kidney|renal pelvis|kidney capsule|hilum of kidney/)) return 'Parte dell\'anatomia interna del rene. Il filtrato prodotto nei glomeruli della corticale scende lungo i tubuli delle piramidi, esce dalle papille e viene raccolto da calici e pelvi, che lo convogliano nell\'uretere.';
  if (has(/gyrus|gyri|lobule|operculum|pole$|cortex|planum|cuneus/)) return 'Regione della corteccia cerebrale, ricostruita in questo modello a partire dall\'atlante del cervello umano dell\'Allen Institute. La corteccia è organizzata in sei strati di neuroni e i suoi giri aumentano la superficie disponibile.';
  if (has(/nucleus|nuclei|nuclear/)) return 'Nucleo della sostanza grigia: un raggruppamento di corpi cellulari di neuroni con funzioni e connessioni comuni, all\'interno dell\'encefalo.';
  if (s === 'skeletal') {
    if (has(/tooth/)) T.push('Dente permanente. La corona, rivestita di smalto, sporge nella bocca; la radice è ancorata all\'alveolo della mascella o della mandibola dal legamento parodontale. All\'interno, la polpa contiene vasi e nervi.');
    else if (has(/gingiva/)) T.push('La gengiva è la mucosa che ricopre i processi alveolari e circonda il colletto dei denti, sigillando lo spazio attorno a essi.');
    else if (has(/intervertebral disk/)) T.push('Disco fibrocartilagineo tra due corpi vertebrali. Il nucleo polposo centrale, ricco di acqua, distribuisce la pressione; l\'anello fibroso lo contiene. Con l\'età i dischi si disidratano e si assottigliano, e la statura si riduce leggermente.');
    else if (has(/costal cartilage/)) T.push('Cartilagine ialina che prolunga la costa verso lo sterno. La sua elasticità permette alla gabbia toracica di espandersi durante l\'inspirazione.');
    else if (has(/cartilage|epiglottis/)) T.push('Cartilagine dello scheletro delle vie aeree. Mantiene aperto il lume e offre inserzione a muscoli e legamenti.');
    else if (has(/vertebra|^atlas$|^axis$/)) T.push('Vertebra della colonna. Il corpo anteriore sostiene il carico, l\'arco posteriore delimita il foro vertebrale in cui passa il midollo spinale; processi spinoso e trasversi offrono leve ai muscoli. Le vertebre cervicali sono piccole e mobili, le lombari massicce.');
    else if (has(/ rib$/)) T.push('Costa: osso piatto e curvo che parte dalla colonna toracica e circonda il torace. Tra una costa e l\'altra decorrono i muscoli, i vasi e i nervi intercostali.');
    else if (has(/phalanx/)) T.push('Falange: piccolo osso lungo delle dita. Le articolazioni tra le falangi sono a cerniera e permettono flessione ed estensione.');
    else if (has(/metacarpal|metatarsal/)) T.push('Osso lungo intermedio tra il carpo (o il tarso) e le falangi; forma lo scheletro del palmo della mano o della pianta del piede.');
    else if (has(/^(femur|tibia|fibula|humerus|radius|ulna|clavicle)$/)) T.push('Osso lungo: una diafisi cilindrica di osso compatto racchiude la cavità midollare; le estremità (epifisi) sono di osso spugnoso rivestito di cartilagine articolare. Nell\'adulto la cavità contiene soprattutto midollo giallo, ricco di grasso.');
    else if (has(/bone$|^(ethmoid|maxilla|mandible|vomer|sacrum)$/)) T.push('Osso dello scheletro assile o dei cingoli. Insieme agli altri elementi di questa regione protegge organi e offre superfici di inserzione per muscoli e legamenti.');
    else T.push('Elemento dello scheletro. Le ossa sono tessuto vivo, vascolarizzato e innervato, che si rimodella continuamente in risposta ai carichi.');
  } else if (s === 'muscular') {
    if (has(/head of/)) T.push('Questo è uno dei capi di origine di un muscolo con più capi: ciascun capo nasce da un punto diverso e si unisce agli altri in un tendine comune.');
    else if (has(/part of/)) T.push('Questa è una porzione di un muscolo più ampio. Le diverse parti possono contrarsi in modo indipendente e produrre movimenti diversi.');
    if (has(/papillary/)) T.push('Muscolo papillare del cuore: tramite le corde tendinee tiene in posizione i lembi delle valvole atrioventricolari durante la contrazione.');
    else if (has(/^(superior|inferior|medial|lateral) rectus$|^(superior|inferior) oblique$|levator palpebrae/)) T.push('Muscolo estrinseco dell\'occhio, uno dei più rapidi e precisi del corpo.');
    else T.push('Muscolo scheletrico striato, controllato dalla volontà. Le sue fibre si accorciano per scorrimento dei filamenti di actina e miosina e trasmettono la forza alle ossa tramite i tendini.');
  } else if (s === 'arterial') {
    if (has(/pulmonary|segmental artery|lingular|lobar artery/) && !has(/renal|hepatic/)) T.push('Ramo della circolazione polmonare: porta sangue povero di ossigeno dal cuore destro al polmone. Per convenzione è colorato in blu, come il sangue venoso.');
    else if (has(/branch|ramus/)) T.push('Ramo arterioso: diramazione di un\'arteria maggiore che porta sangue ossigenato a un territorio specifico.');
    else T.push('Arteria: vaso a parete muscolare ed elastica che porta il sangue ossigenato dal cuore ai tessuti, sotto la spinta della pressione arteriosa.');
  } else if (s === 'venous') {
    if (has(/hepatovenous segment/)) T.push('Segmento epatico secondo Couinaud. Ogni segmento ha un proprio peduncolo portale (ramo della vena porta, dell\'arteria epatica e dotto biliare) e un drenaggio venoso: per questo può essere asportato chirurgicamente in modo indipendente.');
    else if (has(/pulmonary vein|segmental vein|lingular vein/)) T.push('Vena polmonare: riporta al cuore sinistro il sangue appena ossigenato nei polmoni. Per convenzione è colorata in rosso.');
    else if (has(/portal|mesenteric|splenic|gastric|colic|ileal|sigmoid|rectal/)) T.push('Vena del sistema portale: raccoglie il sangue dei visceri addominali e lo porta al fegato prima che rientri nella circolazione generale.');
    else T.push('Vena: vaso a pareti sottili che riporta il sangue al cuore a bassa pressione. Nelle vene degli arti le valvole impediscono il reflusso.');
  } else if (s === 'nervous') {
    if (has(/gyrus|lobule|insula|lobe/)) T.push('Regione della corteccia cerebrale. I giri sono i rilievi della superficie del cervello, separati dai solchi; la corteccia che li ricopre contiene i corpi dei neuroni organizzati in sei strati.');
    else if (has(/nerve|ganglion/)) T.push('Struttura del sistema nervoso periferico: fasci di assoni avvolti da guaine connettivali che portano segnali tra il sistema nervoso centrale e i tessuti.');
    else if (has(/ventricle|aqueduct|foramen|canal|choroid plexus/)) T.push('Parte del sistema ventricolare, le cavità piene di liquido cerebrospinale all\'interno dell\'encefalo.');
    else if (has(/white matter|corpus callosum|commissure|capsule|fornix|stria|tract|brachium/)) T.push('Sostanza bianca: fasci di assoni rivestiti di mielina che collegano tra loro regioni diverse del sistema nervoso. Il colore chiaro è dato dai lipidi della mielina.');
    else T.push('Struttura del sistema nervoso centrale formata da aggregati di neuroni (sostanza grigia) con funzioni specifiche di elaborazione.');
  } else if (s === 'respiratory') {
    if (has(/bronchial tree/)) T.push('Albero bronchiale segmentale: insieme delle diramazioni del bronco che ventila un singolo segmento broncopolmonare. Ogni colore del modello corrisponde a un segmento diverso.');
    else T.push('Parte delle vie aeree, che conducono, riscaldano e umidificano l\'aria fino agli alveoli.');
  } else if (s === 'connective') T.push('Struttura di tessuto connettivo denso, ricca di fibre di collagene: collega, stabilizza o guida altre strutture.');
  else if (s === 'cardiac') {
    if (has(/valve/)) T.push('Lembo o cuspide di una valvola cardiaca. Le valvole si aprono e chiudono passivamente, spinte dalle differenze di pressione, e garantiscono il flusso del sangue in un solo senso.');
    else if (has(/cavity/)) T.push('Calco della cavità di una camera cardiaca, cioè del volume di sangue che la riempie.');
    else T.push('Parete muscolare del cuore (miocardio): cellule striate collegate da dischi intercalari che si contraggono in modo coordinato.');
  }
  return T.join(' ');
}

// -------- UI: lista sistemi, preset, strutture --------
function buildAnatLists() {
  $('#presets').innerHTML = PRESETS.map(p => `<button class="chip" data-k="${p.k}">${esc(p.n)}</button>`).join('');
  const counts = {}; A.parts.forEach(p => counts[p[4]] = (counts[p[4]] || 0) + 1);
  $('#sys-count').textContent = `${fmtInt(A.parts.length)} strutture`;
  $('#sys-list').innerHTML = SYS_ORDER.filter(s => counts[s]).map(s => `
    <div class="sys" data-s="${s}">
      <label><input type="checkbox" id="sys-${s}" data-s="${s}"><span class="dot" style="background:${A.sysInfo[s].color}"></span>${esc(A.sysInfo[s].name)}</label>
      <span></span><span class="n">${counts[s]}</span>
      <button class="solo" data-solo="${s}" title="Mostra solo questo sistema">solo</button>
    </div>`).join('');
  const bySys = {};
  A.structs.forEach((s, si) => (bySys[s.sys] = bySys[s.sys] || []).push(si));
  $('#struct-list').innerHTML = SYS_ORDER.filter(s => bySys[s]).map(s => `
    <div class="grp"><div class="grp-t"><span class="dot" style="background:${A.sysInfo[s].color}"></span>${esc(A.sysInfo[s].name)}</div>
    ${bySys[s].map(si => `<button class="st-btn" data-si="${si}">${esc(A.structs[si].name)}</button>`).join('')}</div>`).join('');
  A.searchIdx = A.parts.map((p, i) => ({ t: 'p', i, label: partName(i), key: norm(partName(i) + ' ' + p[3]) }));
  A.structs.forEach((s, si) => A.searchIdx.push({ t: 's', i: si, label: s.name, key: norm(s.name) }));
  $('#anat-q').value = ''; $('#anat-res').innerHTML = '';
  updateSysUI();
}
function wireAnatUI() {
  $('#sex-sw').addEventListener('click', e => { const b = e.target.closest('[data-sex]'); if (b) switchModel(b.dataset.sex); });
  $('#presets').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) applyPreset(b.dataset.k); });
  $('#sys-list').addEventListener('change', e => {
    const s = e.target.dataset.s; if (!s) return;
    A.isolated = null; e.target.checked ? A.visibleSys.add(s) : A.visibleSys.delete(s);
    $$('#presets .chip').forEach(c => c.classList.remove('on'));
    refreshVisibility(); if (A.selected != null || A.selectedStruct != null) clearSelection();
  });
  $('#sys-list').addEventListener('click', e => {
    const b = e.target.closest('[data-solo]'); if (b) { A.visibleSys = new Set([b.dataset.solo]); A.isolated = null; $$('#presets .chip').forEach(c => c.classList.remove('on')); refreshVisibility(); clearSelection(); renderSystemCard(b.dataset.solo); return; }
    const row = e.target.closest('.sys'); if (row && !e.target.closest('label')) renderSystemCard(row.dataset.s);
  });
  $('#struct-list').addEventListener('click', e => { const b = e.target.closest('.st-btn'); if (b) selectStruct(+b.dataset.si); });
  // ricerca
  const q = $('#anat-q'), res = $('#anat-res');
  q.addEventListener('input', () => {
    const v = norm(q.value.trim()); if (v.length < 2) { res.innerHTML = ''; return; }
    const words = v.split(/\s+/);
    const hits = A.searchIdx.filter(x => words.every(w => x.key.includes(w)))
      .sort((a, b) => (a.t === 's' ? -1 : 0) - (b.t === 's' ? -1 : 0) || (a.key.startsWith(words[0]) ? -1 : 0) - (b.key.startsWith(words[0]) ? -1 : 0) || a.label.length - b.label.length)
      .slice(0, 14);
    res.innerHTML = hits.length ? hits.map(h => {
      if (h.t === 's') { const s = A.structs[h.i]; return `<button data-t="s" data-i="${h.i}"><span class="dot" style="background:${A.sysInfo[s.sys].color}"></span><b>${esc(s.name)}</b><span class="en">organo / regione</span></button>`; }
      const p = A.parts[h.i]; return `<button data-t="p" data-i="${h.i}"><span class="dot" style="background:${A.sysInfo[p[4]].color}"></span>${esc(h.label)}${p[6] ? ` <small style="color:var(--muted)">(${sideLabel(h.i)})</small>` : ''}<span class="en">${esc(p[3])}</span></button>`;
    }).join('') : '<div style="color:var(--muted);padding:6px 8px">Nessuna struttura trovata. Prova con un altro nome, anche in inglese.</div>';
  });
  res.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.t === 's') selectStruct(+b.dataset.i);
    else { const i = +b.dataset.i; selectPart(i, { fly: true }); }
    res.innerHTML = ''; q.value = ''; if (isNarrow()) closeSheet('anat-left');
  });
}
function updateSysUI() {
  $$('#sys-list input[type=checkbox]').forEach(c => c.checked = A.visibleSys.has(c.dataset.s));
}

// -------- schede --------
const card = $('#anat-card');
function renderAnatEmpty() {
  card.innerHTML = `<div class="info-empty">
    <div class="kicker">Anatomia · modello di riferimento</div>
    <h2 style="margin-top:10px">Esplora il corpo umano</h2>
    <p>Modello <b style="color:var(--bone)">${MODELS[A.sex || 'm'].label.toLowerCase()}</b>: <b style="color:var(--bone)">${fmtInt(A.parts.length)}</b> strutture ${MODELS[A.sex || 'm'].intro}</p>
    <p>Puoi passare dal modello maschile a quello femminile con il selettore in alto a sinistra della vista 3D.</p>
    <p><b style="color:var(--bone)">Clicca</b> su una struttura per leggerne la scheda; con un <b style="color:var(--bone)">doppio clic</b> la inquadri. Trascina per ruotare, usa la rotellina o due dita per lo zoom, il tasto destro per spostare la vista.</p>
    <p>Destra e sinistra si riferiscono sempre al corpo, non a chi guarda: nella vista frontale il lato sinistro del corpo è alla tua destra.</p>
    <p>Usa <b style="color:var(--bone)">Esploso</b> per separare gli strati, <b style="color:var(--bone)">Sezione</b> per tagliare il corpo con un piano anatomico, e la lista a sinistra per accendere i singoli apparati o aprire la scheda di un organo.</p>
    <div class="sub-h">Inizia da qui</div>
    <div class="chips">${MODELS[A.sex || 'm'].start.map(k => { const si = A.structs.findIndex(s => s.key === k); return si < 0 ? '' : `<button class="chip" data-si="${si}">${esc(A.structs[si].name)}</button>`; }).join('')}</div>
  </div>`;
}
card.addEventListener('click', e => {
  const t = e.target.closest('[data-si]'); if (t) { selectStruct(+t.dataset.si); return; }
  const p = e.target.closest('[data-pi]'); if (p) { selectPart(+p.dataset.pi, { fly: true }); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act;
  if (act === 'isolate-part') { A.isolated = new Set([A.selected]); refreshVisibility(); focusParts([A.selected], true); renderPartCard(A.selected); }
  if (act === 'isolate-struct') { A.isolated = new Set(A.structs[A.selectedStruct].parts); refreshVisibility(); focusParts([...A.isolated], true); renderStructCard(A.selectedStruct); }
  if (act === 'hide') { A.hidden.add(A.selected); clearSelection(); refreshVisibility(); }
  if (act === 'frame') frameParts(A.selected != null ? [A.selected] : A.structs[A.selectedStruct].parts);
  if (act === 'mirror') {
    const i = A.selected, p = A.parts[i], c = A.cent[i]; let best = -1, bd = 1e9;
    A.parts.forEach((q, j) => { if (j === i || q[1] !== p[1] || q[5] !== 3 - p[5] || !A.cent[j]) return; const d = Math.hypot(A.cent[j].x + c.x, A.cent[j].y - c.y, A.cent[j].z - c.z); if (d < bd) { bd = d; best = j; } });
    if (best >= 0) selectPart(best, { fly: true });
  }
  if (act === 'show-all') { A.isolated = null; A.hidden.clear(); refreshVisibility(); if (A.selected != null) { focusParts([A.selected], false); renderPartCard(A.selected); } else if (A.selectedStruct != null) { focusParts(A.structs[A.selectedStruct].parts, false); renderStructCard(A.selectedStruct); } }
  if (act === 'clear') clearSelection();
});
function dims(list) {
  const mn = [9, 9, 9], mx = [-9, -9, -9];
  for (const i of list) { const b = A.parts[i][13]; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], b[0][k]); mx[k] = Math.max(mx[k], b[1][k]); } }
  return [0, 1, 2].map(k => (mx[k] - mn[k]) * 100);
}
function fmtDims(d) { return `${fmtNum(d[0])} × ${fmtNum(d[1])} × ${fmtNum(d[2])} cm`; }
function paras(t) { return t.split('\n\n').map(x => `<p>${esc(x)}</p>`).join(''); }
function factsHTML(f) { return f && f.length ? `<dl class="facts">${f.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>` : ''; }

function renderPartCard(i) {
  const p = A.parts[i]; const sys = A.sysInfo[p[4]]; const sis = A.structOf[i];
  const d = dims([i]); const isolated = A.isolated && A.isolated.size === 1 && A.isolated.has(i);
  const main = sis.length ? A.structs[sis[0]] : null;
  card.innerHTML = `
  <div class="card-h">
    <div class="kicker"><span class="dot" style="background:${sys.color}"></span>${esc(sys.name)}${p[6] ? `<span class="pill">${sideLabel(i)}</span>` : ''}</div>
    <h2>${esc(partName(i))}</h2>
    <div class="en">${esc(p[3])}</div>
  </div>
  <div class="card-b">
    <p>${esc(kindDesc(i))}</p>
    ${sis.length ? `<p>Fa parte di: ${sis.map(si => `<button class="link" data-si="${si}">${esc(A.structs[si].name)}</button>`).join(', ')}.</p>` : ''}
    <dl class="facts">
      <dt>Ingombro (L×A×P)</dt><dd>${fmtDims(d)}</dd>
      <dt>Sistema</dt><dd>${esc(sys.name)}</dd>
      <dt>Maglia 3D</dt><dd>${fmtInt(p[12] / 3)} triangoli</dd>
      <dt>Identificativo</dt><dd class="mono">${esc(p[0])}</dd>
    </dl>
    <div class="actions">
      <button class="ibtn" data-act="frame">Inquadra</button>
      ${isolated ? '<button class="ibtn" data-act="show-all">Mostra il contesto</button>' : '<button class="ibtn" data-act="isolate-part">Isola</button>'}
      ${p[5] ? `<button class="ibtn" data-act="mirror">Vai al lato ${p[5] === 1 ? 'destro' : 'sinistro'}</button>` : ''}
      <button class="ibtn" data-act="hide">Nascondi</button>
      <button class="ibtn" data-act="clear">Chiudi</button>
    </div>
    ${main ? `<div class="sub-h">${esc(main.name)}</div>${mediaHTML(main.key)}${paras(main.desc)}${factsHTML(main.facts)}` : `<div class="sub-h">${esc(sys.name)}</div>${mediaHTML('s:' + p[4])}${paras(sys.desc)}`}
    <p class="note">${MODELS[A.sex].note} Le dimensioni sono quelle del riquadro che contiene la struttura e variano da persona a persona.</p>
  </div>`;
  card.scrollTop = 0; hydrateMedia(card);
}
function renderStructCard(si) {
  const s = A.structs[si]; const sys = A.sysInfo[s.sys]; const d = dims(s.parts);
  const isolated = A.isolated && A.isolated.size === s.parts.length && s.parts.every(i => A.isolated.has(i));
  const list = s.parts.slice().sort((a, b) => partName(a).localeCompare(partName(b), 'it'));
  card.innerHTML = `
  <div class="card-h">
    <div class="kicker"><span class="dot" style="background:${sys.color}"></span>${esc(sys.name)} · organo / regione</div>
    <h2>${esc(s.name)}</h2>
    <div class="en">${fmtInt(s.parts.length)} strutture nel modello · ingombro ${fmtDims(d)}</div>
  </div>
  <div class="card-b">
    ${mediaHTML(s.key)}
    ${paras(s.desc)}
    ${factsHTML(s.facts)}
    <div class="actions">
      <button class="ibtn" data-act="frame">Inquadra</button>
      ${isolated ? '<button class="ibtn" data-act="show-all">Mostra il contesto</button>' : '<button class="ibtn" data-act="isolate-struct">Isola</button>'}
      <button class="ibtn" data-act="clear">Chiudi</button>
    </div>
    <div class="sub-h">Componenti nel modello</div>
    <div style="display:flex;flex-direction:column;gap:2px">${list.slice(0, 80).map(i => `<button class="link" style="text-decoration:none;color:var(--text);padding:3px 0" data-pi="${i}">${esc(partName(i))}${A.parts[i][6] ? ` <span style="color:var(--faint)">(${sideLabel(i)})</span>` : ''}</button>`).join('')}${list.length > 80 ? `<span class="note">… e altre ${list.length - 80}</span>` : ''}</div>
  </div>`;
  card.scrollTop = 0; hydrateMedia(card);
}
function renderSystemCard(s) {
  const info = A.sysInfo[s]; const n = A.parts.filter(p => p[4] === s).length;
  const sts = A.structs.map((x, si) => [x, si]).filter(([x]) => x.sys === s);
  card.innerHTML = `
  <div class="card-h"><div class="kicker"><span class="dot" style="background:${info.color}"></span>Apparato / sistema</div><h2>${esc(info.name)}</h2><div class="en">${fmtInt(n)} strutture nel modello</div></div>
  <div class="card-b">${mediaHTML('s:' + s)}${paras(info.desc)}
  ${sts.length ? `<div class="sub-h">Schede di approfondimento</div><div class="chips">${sts.map(([x, si]) => `<button class="chip" data-si="${si}">${esc(x.name)}</button>`).join('')}</div>` : ''}</div>`;
  card.scrollTop = 0; hydrateMedia(card);
  if (isNarrow()) openSheet('anat-info');
}

// -------- interazione 3D --------
const ray = new THREE.Raycaster();
function pick(ev) {
  if (!A.ready) return null;
  ray.setFromCamera(AV.ndc(ev), AV.camera);
  const objs = Object.values(A.meshes).filter(m => m.visible);
  // le sovrapposizioni (parti selezionate) hanno la precedenza
  const ov = A.overlays.filter((o, k) => k % 2 === 0);
  const hits = ray.intersectObjects([...objs, ...ov], false);
  for (const h of hits) {
    if (AV.renderer.clippingPlanes.length && AV.renderer.clippingPlanes[0].distanceToPoint(h.point) < 0) continue;
    if (h.object.isBatchedMesh) {
      const i = h.object.userData.inv[h.batchId];
      if (h.object.userData.sys === 'integumentary' && A.visibleSys.size > 1 && hits.length > 1) continue; // la pelle trasparente non blocca il clic
      return i;
    }
    return h.object.userData.pi;
  }
  return null;
}
function wireAnatInteractions() {
  const el = AV.renderer.domElement; const tip = $('#anat-tip');
  onTap(el, e => { const i = pick(e); if (i == null) { if (A.selected != null || A.selectedStruct != null) clearSelection(); } else selectPart(i); },
    e => { const i = pick(e); if (i != null) selectPart(i, { fly: true }); });
  let pending = null, last = 0;
  el.addEventListener('pointermove', e => {
    if (e.buttons || e.pointerType === 'touch') { tip.hidden = true; return; }
    pending = e; const now = performance.now(); if (now - last < 70) return; last = now;
    requestAnimationFrame(() => {
      const ev = pending; if (!ev) return; pending = null;
      const i = pick(ev);
      if (i == null) { tip.hidden = true; el.style.cursor = ''; setHover(-1); return; }
      const p = A.parts[i]; const r = anatStage.getBoundingClientRect();
      tip.innerHTML = `${esc(partName(i))}<small>${esc(A.sysInfo[p[4]].name)}${p[6] ? ' · ' + sideLabel(i) : ''}</small>`;
      tip.style.left = (ev.clientX - r.left) + 'px'; tip.style.top = (ev.clientY - r.top) + 'px'; tip.hidden = false;
      el.style.cursor = 'pointer'; setHover(i);
    });
  });
  el.addEventListener('pointerleave', () => { tip.hidden = true; setHover(-1); });
  // controlli HUD
  $('#explode').addEventListener('input', e => { A.explode = +e.target.value; applyExplode(); });
  $('#ghost').addEventListener('input', e => { A.ghost = +e.target.value; if (A.overlays.length) setGhost(true); });
  const axisSel = $('#clip-axis'), pos = $('#clip-pos');
  const plane = new THREE.Plane();
  const updClip = () => {
    const ax = axisSel.value; pos.disabled = ax === 'off';
    if (ax === 'off') { AV.renderer.clippingPlanes = []; setDoubleSide(false); AV.invalidate(); return; }
    const t = +pos.value;
    const range = { x: [-0.34, 0.34], y: [0, 1.74], z: [-0.16, 0.16] }[ax];
    const v = range[0] + (range[1] - range[0]) * t;
    const n = { x: new THREE.Vector3(-1, 0, 0), y: new THREE.Vector3(0, -1, 0), z: new THREE.Vector3(0, 0, -1) }[ax];
    plane.set(n, v); AV.renderer.clippingPlanes = [plane]; setDoubleSide(true); AV.invalidate();
  };
  axisSel.addEventListener('change', () => { if (axisSel.value === 'y') pos.value = 0.75; else pos.value = 0.5; updClip(); });
  pos.addEventListener('input', updClip);
  $('#btn-reset').addEventListener('click', () => { A.explode = 0; $('#explode').value = 0; applyExplode(); axisSel.value = 'off'; updClip(); clearSelection(); applyPreset('intero', true); A.home(); });
  $('#btn-rotate').addEventListener('click', e => { AV.autoRotate = !AV.autoRotate; e.currentTarget.classList.toggle('on', AV.autoRotate); });
  $('#btn-quality').addEventListener('click', () => setQuality(!A.hq));
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#v-anat').hidden) clearSelection(); });
}
function setDoubleSide(on) {
  for (const s in A.mats) { A.mats[s].side = on ? THREE.DoubleSide : THREE.FrontSide; A.mats[s].needsUpdate = true; }
}
function setQuality(on) {
  A.hq = on; lsSet('corpus.hq', on);
  AV.aoEnabled = on && !A.ghosting;
  AV.renderer.setPixelRatio(on ? Math.min(devicePixelRatio || 1, 2) : 1);
  AV.resize();
  $('#btn-quality').classList.toggle('on', on);
  $('#btn-quality').textContent = on ? 'Qualità alta' : 'Qualità standard';
}
function setHover(i) {
  if (i === A.hover) return; A.hover = i;
  if (!A.hoverMesh) { A.hoverMesh = new THREE.Mesh(new THREE.BufferGeometry(), rimMaterial(0xd8b45c)); A.hoverMesh.material.uniforms.uInt.value = 0.9; A.hoverMesh.renderOrder = 22; AV.scene.add(A.hoverMesh); }
  if (i < 0 || !A.geoms[i]) { A.hoverMesh.visible = false; }
  else { A.hoverMesh.geometry = A.geoms[i]; offsetFor(i, A.hoverMesh.position); A.hoverMesh.visible = true; }
  AV.invalidate();
}

// -------- foto reali e al microscopio da Wikimedia Commons --------
const MEDIA_CACHE = new Map();
const stripTags = h => { const d = document.createElement('div'); d.innerHTML = h; return (d.textContent || '').replace(/\s+/g, ' ').trim(); };
function commonsSearch(q) {
  if (MEDIA_CACHE.has(q)) return MEDIA_CACHE.get(q);
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', origin: '*', generator: 'search', gsrnamespace: '6', gsrsearch: q + ' filetype:bitmap', gsrlimit: '12',
    prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '900', iiextmetadatafilter: 'LicenseShortName|Artist',
  });
  const p = fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(j =>
    Object.values((j.query && j.query.pages) || {}).sort((a, b) => a.index - b.index).map(pg => {
      const ii = pg.imageinfo && pg.imageinfo[0]; if (!ii || !/jpeg|png|webp/.test(ii.mime || '')) return null;
      const m = ii.extmetadata || {};
      return { src: ii.thumburl || ii.url, page: ii.descriptionurl, title: pg.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' '),
        artist: stripTags((m.Artist && m.Artist.value) || '') || 'autore non indicato', license: (m.LicenseShortName && m.LicenseShortName.value) || 'licenza su Commons' };
    }).filter(Boolean));
  MEDIA_CACHE.set(q, p); p.catch(() => MEDIA_CACHE.delete(q));
  return p;
}
const commonsSearchUrl = q => 'https://commons.wikimedia.org/w/index.php?' + new URLSearchParams({ search: q, title: 'Special:MediaSearch', type: 'image' });
function mediaHTML(key) {
  const m = MEDIA[key]; if (!m) return '';
  return `<div class="media" data-mkey="${esc(key)}" data-tab="0">
    <div class="media-tabs" role="tablist" aria-label="Tipo di immagine">
      <button role="tab" data-mt="0" aria-selected="true">Aspetto reale</button>
      <button role="tab" data-mt="1" aria-selected="false">Al microscopio</button>
    </div>
    <div class="media-body"></div>
  </div>`;
}
async function hydrateMedia(root) {
  const box = root.querySelector('.media'); if (!box) return;
  const key = box.dataset.mkey, tab = +box.dataset.tab, m = MEDIA[key]; const q = m[tab];
  const body = box.querySelector('.media-body');
  const idx = +(box.dataset['i' + tab] || 0);
  body.innerHTML = `<div class="media-fig loading"><span>Ricerca delle immagini…</span></div>${tab === 1 ? `<p class="media-cap">${esc(m[2])}</p>` : ''}`;
  const fail = () => {
    body.innerHTML = `<div class="media-fig empty"><span>Le foto arrivano da Wikimedia Commons e non sono raggiungibili da qui.</span>
      <a class="ibtn" href="${commonsSearchUrl(q)}" target="_blank" rel="noopener">Apri le foto su Wikimedia Commons ↗</a></div>${tab === 1 ? `<p class="media-cap">${esc(m[2])}</p>` : ''}`;
  };
  let list; try { list = await commonsSearch(q); } catch { if (box.isConnected && +box.dataset.tab === tab) fail(); return; }
  if (!box.isConnected || +box.dataset.tab !== tab) return;
  if (!list.length) { fail(); return; }
  const i = ((idx % list.length) + list.length) % list.length; const it = list[i];
  body.innerHTML = `
    <figure class="media-fig">
      <a href="${esc(it.page)}" target="_blank" rel="noopener" title="Apri l'immagine originale su Wikimedia Commons"><img src="${esc(it.src)}" alt="${esc(it.title)}" decoding="async"></a>
      ${list.length > 1 ? `<button class="media-nav prev" data-mnav="-1" aria-label="Immagine precedente">‹</button><button class="media-nav next" data-mnav="1" aria-label="Immagine successiva">›</button><span class="media-count">${i + 1} / ${list.length}</span>` : ''}
    </figure>
    ${tab === 1 ? `<p class="media-cap">${esc(m[2])}</p>` : ''}
    <p class="media-credit">${esc(it.title)} · ${esc(it.artist)} · ${esc(it.license)} · <a href="${esc(it.page)}" target="_blank" rel="noopener">Wikimedia Commons</a></p>`;
  const img = body.querySelector('img');
  img.addEventListener('error', fail, { once: true });
  const ready = () => { const f = body.querySelector('.media-fig'); if (f) f.classList.add('ready'); };
  if (img.complete && img.naturalWidth) ready(); else img.addEventListener('load', ready, { once: true });
  // precarica la successiva per scorrere senza attese
  if (list.length > 1) { const nx = new Image(); nx.src = list[(i + 1) % list.length].src; }
}
document.addEventListener('click', e => {
  const box = e.target.closest('.media'); if (!box) return;
  const t = e.target.closest('[data-mt]');
  if (t) { box.dataset.tab = t.dataset.mt; box.querySelectorAll('[data-mt]').forEach(b => b.setAttribute('aria-selected', String(b === t))); hydrateMedia(box.parentElement); return; }
  const n = e.target.closest('[data-mnav]');
  if (n) { const k = 'i' + box.dataset.tab; box.dataset[k] = (+(box.dataset[k] || 0)) + (+n.dataset.mnav); hydrateMedia(box.parentElement); }
});
