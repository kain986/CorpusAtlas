// =====================================================================
//  GENOMA
// =====================================================================
const G = { genes: [], bySym: new Map(), details: null, domains: null, karyo: null, filtered: [], sel: null, view: 'helix', loaded: false, chrSel: null };
const BASE_COL = { A: 0xe8789c, T: 0xd8b45c, G: 0x9389ec, C: 0x5fc0c8 };
const BASE_IT = { A: 'Adenina', T: 'Timina', G: 'Guanina', C: 'Citosina' };
const COMP = { A: 'T', T: 'A', G: 'C', C: 'G' };
const ELEM_COL = { C: 0x9aa3ad, N: 0x5b86ff, O: 0xff5f52, P: 0xffa53a };
const ELEM_R = { C: 1.70, N: 1.55, O: 1.52, P: 1.80 };
const CHRS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', 'X', 'Y'];
const STAIN = { gneg: '#f1ece2', gpos25: '#cbc4b6', gpos33: '#bdb5a6', gpos50: '#9b9285', gpos66: '#7b7367', gpos75: '#625a50', gpos100: '#2e2924', acen: '#e8789c', gvar: '#8580b8', stalk: '#a7a3a0' };
const IT_EN = { insulina: 'insulin', emoglobina: 'hemoglobin', collagene: 'collagen', cheratina: 'keratin', recettore: 'receptor', canale: 'channel', istone: 'histone', interleuchina: 'interleukin', chinasi: 'kinase', olfattivo: 'olfactory', distrofina: 'dystrophin', miosina: 'myosin', actina: 'actin', albumina: 'albumin', fattore: 'factor', crescita: 'growth', proteina: 'protein', enzima: 'ase', ormone: 'hormone', trasportatore: 'transporter', anticorpo: 'immunoglobulin', immunoglobulina: 'immunoglobulin', tumore: 'tumor', ossigeno: 'oxygen', ferro: 'iron', rame: 'copper', zinco: 'zinc', calcio: 'calcium', sodio: 'sodium', potassio: 'potassium', cloruro: 'chloride', vitamina: 'vitamin', colesterolo: 'cholesterol', lipoproteina: 'lipoprotein', citocromo: 'cytochrome', mitocondriale: 'mitochondrial', ribosomiale: 'ribosomal', gusto: 'taste', opsina: 'opsin', melanina: 'melan', coagulazione: 'coagulation', elastina: 'elastin', titina: 'titin', tirosina: 'tyrosine', serotonina: 'serotonin', dopamina: 'dopamine', glucosio: 'glucose', lattasi: 'lactase', telomerasi: 'telomerase' };

function geneKind(desc, type) { if (type === 'c') return 'c'; if (/pseudogene/i.test(desc)) return 'ps'; return 'nc'; }
function geneCat(g) {
  for (const [re, lab] of GENE_CATS) if (re.test(g.desc)) return lab;
  return g.kind === 'c' ? 'Gene codificante proteine' : g.kind === 'ps' ? 'Pseudogene' : 'RNA non codificante';
}
const kindLabel = k => ({ c: 'codificante proteine', nc: 'RNA non codificante', ps: 'pseudogene' }[k]);
const fmtBp = n => n >= 1e6 ? `${fmtNum(n / 1e6, 2)} Mb` : n >= 1e3 ? `${fmtNum(n / 1e3, 1)} kb` : `${fmtInt(n)} bp`;

async function loadGenes() {
  if (G.loaded) return; G.loaded = true;
  const [txt, karyo] = await Promise.all([fetchText('data/genes.tsv.wasm'), fetchText('data/karyo.json').then(JSON.parse)]);
  G.karyo = karyo;
  for (const line of txt.split('\n')) {
    if (!line) continue;
    const [s, chr, start, len, desc, type, strand, band, syn] = line.split('\t');
    const g = { s, chr, start: +start, len: +len, desc, type, strand, band, syn: syn ? syn.split('|') : [] };
    g.kind = geneKind(desc, type); g.cat = geneCat(g); g.note = GENE_NOTES[s] || null;
    g.key = norm(`${s} ${g.syn.join(' ')} ${desc} ${g.cat}`); g.sk = s.toLowerCase();
    G.genes.push(g); G.bySym.set(s, g);
  }
  G.genes.sort((a, b) => a.s.localeCompare(b.s));
  const sel = $('#f-chr'); sel.innerHTML += [...CHRS, 'MT'].map(c => `<option value="${c}">Cromosoma ${c === 'MT' ? 'mitocondriale' : c}</option>`).join('');
  filterGenes();
  if (G.onLoaded) G.onLoaded();
}
async function loadDetails() {
  if (G.details) return G.details;
  if (!G._dp) G._dp = (async () => {
    const [txt, dom] = await Promise.all([fetchText('data/gene-details.tsv.wasm'), fetchText('data/domains.json').then(JSON.parse)]);
    const m = new Map();
    for (const line of txt.split('\n')) { if (!line) continue; const p = line.split('\t'); m.set(p[0], p); }
    G.details = m; G.domains = dom; return m;
  })();
  return G._dp;
}

// -------- lista virtuale --------
const listEl = $('#gene-list'), spacer = $('#gene-spacer'), ROW = 46;
function filterGenes() {
  const q = norm($('#gene-q').value.trim()); const chr = $('#f-chr').value; const ty = $('#f-type').value;
  let words = q ? q.split(/\s+/) : [];
  words = words.map(w => IT_EN[w] ? [w, IT_EN[w]] : [w]);
  const res = [];
  for (const g of G.genes) {
    if (chr && g.chr !== chr) continue;
    if (ty === 'note') { if (!g.note) continue; } else if (ty && g.kind !== ty) continue;
    if (words.length && !words.every(alts => alts.some(w => g.key.includes(w) || (g.note && norm(g.note).includes(w))))) continue;
    res.push(g);
  }
  if (q) {
    const w0 = q.split(/\s+/)[0];
    const score = g => g.sk === w0 ? 0 : g.sk.startsWith(w0) ? 1 : g.syn.some(x => x.toLowerCase() === w0) ? 2 : g.note ? 3 : g.kind === 'c' ? 4 : 5;
    res.sort((a, b) => score(a) - score(b) || a.s.length - b.s.length || a.s.localeCompare(b.s));
  }
  G.filtered = res;
  const tot = G.genes.length;
  $('#gene-count').textContent = `${fmtInt(res.length)} geni${res.length !== tot ? ` su ${fmtInt(tot)}` : ''}`;
  spacer.style.height = res.length * ROW + 'px'; listEl.scrollTop = 0; renderRows();
}
function renderRows() {
  const top = listEl.scrollTop, h = listEl.clientHeight || 600;
  const a = Math.max(0, Math.floor(top / ROW) - 6), b = Math.min(G.filtered.length, Math.ceil((top + h) / ROW) + 6);
  let html = '';
  for (let i = a; i < b; i++) {
    const g = G.filtered[i];
    html += `<div class="row${G.sel === g ? ' on' : ''}" style="top:${i * ROW}px" data-s="${esc(g.s)}" tabindex="0" role="button"><span class="sym">${esc(g.s)}${g.note ? ' <span style="color:var(--eosin)" title="Scheda illustrata">•</span>' : ''}</span><span class="loc">${g.chr === 'MT' ? 'MT' : esc(g.chr + (g.band || ''))}</span><span class="nm">${esc(g.desc)}</span></div>`;
  }
  spacer.innerHTML = html;
}
listEl.addEventListener('scroll', () => requestAnimationFrame(renderRows));
new ResizeObserver(() => renderRows()).observe(listEl);
listEl.addEventListener('click', e => { const r = e.target.closest('.row'); if (r) selectGene(r.dataset.s); });
listEl.addEventListener('keydown', e => {
  const r = e.target.closest('.row'); if (!r) return;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectGene(r.dataset.s); }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const sib = e.key === 'ArrowDown' ? r.nextElementSibling : r.previousElementSibling; if (sib) sib.focus(); else listEl.scrollTop += (e.key === 'ArrowDown' ? ROW : -ROW); }
});
let _qt; $('#gene-q').addEventListener('input', () => { clearTimeout(_qt); _qt = setTimeout(filterGenes, 120); });
$('#f-chr').addEventListener('change', filterGenes); $('#f-type').addEventListener('change', filterGenes);
$('#gene-q').addEventListener('keydown', e => { if (e.key === 'Enter' && G.filtered[0]) selectGene(G.filtered[0].s); });

// -------- scheda del gene --------
const gcard = $('#gen-card');
function hashColor(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0; const hue = h % 360; return `hsl(${hue} 55% 62%)`; }
function setupCanvas(cv, h) {
  const w = cv.parentElement.clientWidth || 320; const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px';
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr); ctx.font = '11px "IBM Plex Mono", monospace'; return [ctx, w];
}
function geneSentence(g) {
  const arm = g.band ? (g.band[0] === 'p' ? 'braccio corto (p)' : 'braccio lungo (q)') : '';
  const where = g.chr === 'MT' ? 'nel DNA mitocondriale' : `sul ${arm} del cromosoma ${g.chr}${g.band ? `, banda ${g.band.slice(1)}` : ''}`;
  const kind = { c: 'Gene che codifica una proteina', nc: 'Gene che produce un RNA non codificante', ps: 'Pseudogene, copia non funzionante di un gene,' }[g.kind];
  const strand = g.strand ? ` È letto sul filamento ${g.strand === '+' ? 'positivo (verso destra)' : 'negativo (verso sinistra)'}.` : '';
  return `${kind} situato ${where}. Occupa ${fmtBp(g.len)} di DNA.${strand}`;
}
async function selectGene(sym, { fromKaryo = false } = {}) {
  const g = G.bySym.get(sym); if (!g) return;
  G.sel = g; G.cardIsGene = true; renderRows();
  const syn = g.syn.length ? g.syn.join(', ') : '—';
  const sym2 = encodeURIComponent(g.s);
  gcard.innerHTML = `
  <div class="card-h">
    <div class="kicker"><span class="pill">${esc(g.cat)}</span><span>${kindLabel(g.kind)}</span></div>
    <h2 style="font-style:italic">${esc(g.s)}</h2>
    <div class="en">${esc(g.desc)}</div>
  </div>
  <div class="card-b">
    ${g.note ? `<p style="color:var(--bone)">${esc(g.note)}</p>` : ''}
    <p>${esc(geneSentence(g))}</p>
    <dl class="facts">
      <dt>Posizione (GRCh38)</dt><dd class="mono">chr${esc(g.chr)}:${fmtInt(g.start)}–${fmtInt(g.start + g.len)}</dd>
      ${g.band ? `<dt>Banda citogenetica</dt><dd class="mono">${esc(g.chr + g.band)}</dd>` : ''}
      <dt>Estensione</dt><dd>${fmtBp(g.len)}</dd>
      ${g.strand ? `<dt>Filamento</dt><dd>${g.strand === '+' ? 'positivo (+)' : 'negativo (−)'}</dd>` : ''}
      <dt>Sinonimi</dt><dd>${esc(syn)}</dd>
      <dt id="gd-tx-k" hidden>Trascritto canonico</dt><dd id="gd-tx" class="mono" hidden></dd>
      <dt id="gd-ex-k" hidden>Esoni</dt><dd id="gd-ex" hidden></dd>
      <dt id="gd-aa-k" hidden>Proteina</dt><dd id="gd-aa" hidden></dd>
    </dl>
    <div class="actions">
      ${g.chr !== 'MT' ? '<button class="ibtn" id="g-show">Mostra sul cromosoma</button>' : ''}
    </div>
    <div id="gd-struct"></div>
    <div id="gd-prot"></div>
    <div id="gd-tis"></div>
    <div class="sub-h">Approfondisci nelle banche dati</div>
    <div class="extlinks">
      <a href="https://www.ncbi.nlm.nih.gov/gene/?term=${sym2}%5Bsym%5D+AND+human%5Borgn%5D" target="_blank" rel="noopener">NCBI Gene</a>
      <a href="https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${sym2}" target="_blank" rel="noopener">Ensembl</a>
      <a href="https://www.genecards.org/cgi-bin/carddisp.pl?gene=${sym2}" target="_blank" rel="noopener">GeneCards</a>
      ${g.kind === 'c' ? `<a href="https://www.uniprot.org/uniprotkb?query=gene_exact:${sym2}+AND+organism_id:9606" target="_blank" rel="noopener">UniProt</a>` : ''}
      <a href="https://www.omim.org/search?search=${sym2}" target="_blank" rel="noopener">OMIM</a>
    </div>
    <p class="note">Nome ufficiale in inglese (HGNC). La categoria in italiano è dedotta dal nome e ha valore indicativo.</p>
  </div>`;
  gcard.scrollTop = 0;
  const btn = $('#g-show'); if (btn) btn.addEventListener('click', () => { setGenView('karyo'); karyoMarkGene(g, true); if (isNarrow()) closeSheet('gen-info'); });
  if (isNarrow()) { closeSheet('gen-left'); openSheet('gen-info'); }
  if (G.view === 'karyo') karyoMarkGene(g, !fromKaryo);
  const det = await loadDetails(); if (G.sel !== g) return;
  const d = det.get(g.s); if (!d) return;
  const [, tx, exStr, prStr, tisStr] = d;
  const feats = exStr ? exStr.split(' ').map(x => x.split(',').map(Number)) : [];
  const exons = feats.filter(f => f[0] === 1), utr = feats.filter(f => f[0] !== 1);
  const cds = exons.reduce((a, f) => a + f[2], 0) - utr.reduce((a, f) => a + f[2], 0);
  if (tx) { $('#gd-tx').textContent = tx; $('#gd-tx').hidden = $('#gd-tx-k').hidden = false; }
  if (exons.length) { $('#gd-ex').textContent = `${exons.length} (trascritto maturo ${fmtBp(exons.reduce((a, f) => a + f[2], 0))})`; $('#gd-ex').hidden = $('#gd-ex-k').hidden = false; }
  let protLen = 0; const pf = prStr ? prStr.split(' ').map(x => x.split(';')) : [];
  for (const f of pf) protLen = Math.max(protLen, +f[1] + +f[2]);
  if (cds > 0) protLen = Math.max(protLen, Math.round(cds / 3) - 1);
  if (g.kind === 'c' && protLen > 0) { $('#gd-aa').textContent = `circa ${fmtInt(protLen)} aminoacidi`; $('#gd-aa').hidden = $('#gd-aa-k').hidden = false; }
  if (exons.length) drawStructure($('#gd-struct'), g, feats);
  if (pf.length) drawProtein($('#gd-prot'), pf, protLen);
  if (tisStr) drawTissues($('#gd-tis'), tisStr.split(',').map(v => v === '' ? 0 : +v));
}
function drawStructure(host, g, feats) {
  const span = Math.max(...feats.map(f => f[1] + f[2]));
  host.innerHTML = `<div class="sub-h">Struttura del gene</div><canvas class="chart"></canvas>
  <div class="note" style="margin-top:6px">Box alti: esoni codificanti · box bassi: regioni non tradotte (UTR) · linea: introni. Orientamento genomico; ${g.strand === '-' ? 'la trascrizione procede verso sinistra.' : 'la trascrizione procede verso destra.'}</div>`;
  const cv = $('canvas', host); const [c, w] = setupCanvas(cv, 64);
  const x = v => 8 + (v / span) * (w - 16), mid = 30;
  c.strokeStyle = '#5d6773'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x(0), mid); c.lineTo(x(span), mid); c.stroke();
  // frecce di direzione
  c.strokeStyle = '#8c96a3';
  for (let k = 1; k < 8; k++) { const xx = 8 + k * (w - 16) / 8, d = g.strand === '-' ? -4 : 4; c.beginPath(); c.moveTo(xx - d, mid - 4); c.lineTo(xx, mid); c.lineTo(xx - d, mid + 4); c.stroke(); }
  const ex = feats.filter(f => f[0] === 1), utr = feats.filter(f => f[0] !== 1);
  c.fillStyle = '#e8789c'; for (const f of ex) c.fillRect(x(f[1]), mid - 11, Math.max(1.5, x(f[1] + f[2]) - x(f[1])), 22);
  for (const f of utr) { c.clearRect(x(f[1]), mid - 11, Math.max(1.5, x(f[1] + f[2]) - x(f[1])), 22); c.fillStyle = '#131921'; c.fillRect(x(f[1]), mid - 11, Math.max(1.5, x(f[1] + f[2]) - x(f[1])), 22); c.fillStyle = '#9389ec'; c.fillRect(x(f[1]), mid - 5, Math.max(1.5, x(f[1] + f[2]) - x(f[1])), 10); c.fillStyle = '#e8789c'; }
  c.fillStyle = '#8c96a3'; c.textAlign = 'left'; c.fillText(g.strand === '-' ? '3′' : '5′', 2, 60); c.textAlign = 'right'; c.fillText(g.strand === '-' ? '5′' : '3′', w - 2, 60);
  c.textAlign = 'center'; c.fillText(fmtBp(span), w / 2, 60);
}
function drawProtein(host, pf, L) {
  const doms = pf.filter(f => f[0][0] !== '_' && f[0] !== 'S');
  const topo = pf.filter(f => f[0][0] === '_');
  const sig = pf.filter(f => f[0] === 'S');
  const uniq = [...new Map(doms.map(f => [f[0], f])).keys()];
  host.innerHTML = `<div class="sub-h">Domini della proteina</div><canvas class="chart"></canvas>
    <div style="display:flex;flex-direction:column;gap:3px;margin-top:8px;font-size:12.5px">${uniq.map(k => `<div style="display:flex;gap:8px;align-items:center"><span class="dot" style="background:${hashColor(k)};border-radius:2px"></span>${esc((G.domains && G.domains[k]) || k)}</div>`).join('')}
    ${sig.length ? '<div style="display:flex;gap:8px;align-items:center"><span class="dot" style="background:#ece5d6;border-radius:2px"></span>Peptide segnale (indirizza la proteina alla secrezione o alla membrana)</div>' : ''}
    ${topo.some(f => f[0] === '_H') ? '<div style="display:flex;gap:8px;align-items:center"><span class="dot" style="background:#79c29a;border-radius:2px"></span>Elica transmembrana</div>' : ''}</div>`;
  const cv = $('canvas', host); const [c, w] = setupCanvas(cv, topo.length ? 66 : 52);
  const x = v => 8 + (v / L) * (w - 16); const y = topo.length ? 26 : 14;
  if (topo.length) {
    for (const f of topo) { const t = f[0], a = +f[1], l = +f[2]; if (t === '_H') continue; c.fillStyle = t === '_E' ? '#d8b45c' : '#5fc0c8'; c.fillRect(x(a), t === '_E' ? 4 : 12, x(a + l) - x(a), 3); }
    c.fillStyle = '#8c96a3'; c.font = '10px "IBM Plex Mono", monospace'; c.textAlign = 'left'; c.fillText('esterno', x(0), 2 + 8 > 9 ? 9 : 9);
  }
  c.fillStyle = '#334051'; c.fillRect(x(0), y + 6, x(L) - x(0), 6);
  for (const f of sig) { c.fillStyle = '#ece5d6'; c.fillRect(x(+f[1]), y + 2, Math.max(2, x(+f[1] + +f[2]) - x(+f[1])), 14); }
  for (const f of doms) { c.fillStyle = hashColor(f[0]); c.beginPath(); c.roundRect(x(+f[1]), y, Math.max(3, x(+f[1] + +f[2]) - x(+f[1])), 18, 4); c.fill(); }
  for (const f of topo) if (f[0] === '_H') { c.fillStyle = '#79c29a'; c.fillRect(x(+f[1]), y - 2, Math.max(2, x(+f[1] + +f[2]) - x(+f[1])), 22); }
  c.fillStyle = '#8c96a3'; c.font = '11px "IBM Plex Mono", monospace'; c.textAlign = 'left'; c.fillText('N', 0, y + 34); c.textAlign = 'right'; c.fillText(`${fmtInt(L)} aa · C`, w, y + 34);
}
function drawTissues(host, vals) {
  const names = G.karyo.tissues;
  const rows = vals.map((v, i) => [names[i], v]).filter(r => r[0]).sort((a, b) => b[1] - a[1]); const pos = rows.filter(r => r[1] > 0);
  const max = rows[0][1];
  if (max <= 0.1) { host.innerHTML = `<div class="sub-h">Espressione nei tessuti</div><p>Espressione molto bassa o assente nei tessuti adulti misurati dal progetto GTEx.</p>`; return; }
  const show = pos.slice(0, 12);
  const top = rows.slice(0, 3).map(r => TISSUE_IT[r[0]] || r[0]);
  const med = rows.map(r => r[1]).sort((a, b) => a - b)[Math.floor(rows.length / 2)];
  const spec = max > 10 * Math.max(med, 0.5) ? 'L\'espressione è concentrata in pochi tessuti.' : 'È espresso in modo diffuso in molti tessuti.';
  host.innerHTML = `<div class="sub-h">Espressione nei tessuti (GTEx)</div><p>Più attivo in: ${esc(top.join(', '))}. ${spec}</p><canvas class="chart"></canvas>
  <div class="note">Valore mediano in TPM (trascritti per milione), scala logaritmica. Dati di tessuti adulti post mortem.</div>`;
  const cv = $('canvas', host); const H = show.length * 20 + 4; const [c, w] = setupCanvas(cv, H);
  const lw = Math.min(170, w * 0.48); const lg = v => Math.log10(v + 1), lm = lg(max);
  show.forEach(([n, v], k) => {
    const yy = k * 20 + 2; c.fillStyle = '#d9d4c9'; c.font = '11.5px "IBM Plex Sans", sans-serif'; c.textAlign = 'left';
    let lab = TISSUE_IT[n] || n; while (c.measureText(lab).width > lw - 6 && lab.length > 4) lab = lab.slice(0, -2) + '…';
    c.fillText(lab, 0, yy + 13);
    const bw = (w - lw - 56) * lg(v) / lm;
    const grd = c.createLinearGradient(lw, 0, lw + bw, 0); grd.addColorStop(0, '#9389ec'); grd.addColorStop(1, '#e8789c');
    c.fillStyle = grd; c.beginPath(); c.roundRect(lw, yy + 3, Math.max(2, bw), 12, 3); c.fill();
    c.fillStyle = '#8c96a3'; c.font = '11px "IBM Plex Mono", monospace'; c.fillText(v >= 100 ? fmtInt(Math.round(v)) : fmtNum(v, 1), lw + bw + 6, yy + 13);
  });
}

// =====================================================================
//  SCENE 3D DEL GENOMA
// =====================================================================
const genStage = $('#gen-stage'); let GV = null;
const groups = {};
function initGenome3D() {
  if (GV) return;
  GV = new Viewport(genStage, { labels: true, fov: 35, near: 0.1, far: 4000 });
  const s = GV.scene;
  const key = new THREE.DirectionalLight(0xfff3e6, 1.5); key.position.set(30, 50, 60); s.add(key);
  const rim = new THREE.DirectionalLight(0x9db7ff, 1.0); rim.position.set(-40, 20, -50); s.add(rim);
  s.add(new THREE.HemisphereLight(0xe0e8ff, 0x231a1a, 0.4));
  wireGenInteractions();
}
function setGenView(v) {
  G.view = v; initGenome3D();
  $$('.subtabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.g === v)));
  for (const k in groups) groups[k].visible = k === v;
  if (!groups[v]) ({ helix: buildHelixView, chromatin: buildChromatinView, karyo: buildKaryoView })[v]();
  else ({ helix: helixHome, chromatin: chromHome, karyo: karyoHome })[v]();
  renderGenHud(); renderGenCardForView();
  GV.invalidate();
}
$$('.subtabs button').forEach(b => b.addEventListener('click', () => setGenView(b.dataset.g)));

// ---------------- strumenti comuni ----------------
const _up = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _mm = new THREE.Matrix4();
function cylMatrix(a, b, r, out = new THREE.Matrix4()) {
  const d = _s.subVectors(b, a); const L = d.length();
  _q.setFromUnitVectors(_up, d.clone().normalize());
  return out.compose(a.clone().add(b).multiplyScalar(0.5), _q, new THREE.Vector3(r, L, r));
}

// =============== DOPPIA ELICA ===============
const H = { seq: HBB_CDS, mode: 'stick', color: 'elem', mut: false, n: 36 };
function baseTemplates() {
  const r = 1.39, rad = d => d * Math.PI / 180;
  const pol = (cx, cy, R, deg) => [cx + R * Math.cos(rad(deg)), cy + R * Math.sin(rad(deg))];
  // purina con N1 a (-1.45,0)
  const Cp = [-1.45 - r, 0];
  const P = { N1: pol(...Cp, r, 0), C6: pol(...Cp, r, 60), C5: pol(...Cp, r, 120), C4: pol(...Cp, r, 180), N3: pol(...Cp, r, 240), C2: pol(...Cp, r, 300) };
  const M = [(P.C5[0] + P.C4[0]) / 2, (P.C5[1] + P.C4[1]) / 2]; const nx = M[0] - Cp[0], ny = M[1] - Cp[1], nl = Math.hypot(nx, ny);
  const Pc = [M[0] + nx / nl * 0.956, M[1] + ny / nl * 0.956], R5 = 1.182;
  const a5 = Math.atan2(P.C5[1] - Pc[1], P.C5[0] - Pc[0]), a4 = Math.atan2(P.C4[1] - Pc[1], P.C4[0] - Pc[0]);
  let d = a5 - a4; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  P.N7 = [Pc[0] + R5 * Math.cos(a5 + d), Pc[1] + R5 * Math.sin(a5 + d)];
  P.C8 = [Pc[0] + R5 * Math.cos(a5 + 2 * d), Pc[1] + R5 * Math.sin(a5 + 2 * d)];
  P.N9 = [Pc[0] + R5 * Math.cos(a5 + 3 * d), Pc[1] + R5 * Math.sin(a5 + 3 * d)];
  const out = (atom, c, L) => { const vx = atom[0] - c[0], vy = atom[1] - c[1], l = Math.hypot(vx, vy); return [atom[0] + vx / l * L, atom[1] + vy / l * L]; };
  const pur = (isG) => {
    const at = { N1: ['N', P.N1], C2: ['C', P.C2], N3: ['N', P.N3], C4: ['C', P.C4], C5: ['C', P.C5], C6: ['C', P.C6], N7: ['N', P.N7], C8: ['C', P.C8], N9: ['N', P.N9] };
    at[isG ? 'O6' : 'N6'] = [isG ? 'O' : 'N', out(P.C6, Cp, isG ? 1.23 : 1.34)];
    if (isG) at.N2 = ['N', out(P.C2, Cp, 1.34)];
    const bonds = [['N1', 'C2'], ['C2', 'N3'], ['N3', 'C4'], ['C4', 'C5'], ['C5', 'C6'], ['C6', 'N1'], ['C5', 'N7'], ['N7', 'C8'], ['C8', 'N9'], ['N9', 'C4'], ['C6', isG ? 'O6' : 'N6']];
    if (isG) bonds.push(['C2', 'N2']);
    return { at, bonds, glyN: 'N9', glyDir: out(P.N9, Pc, 1.47) };
  };
  const Cy = [1.45 + r, 0];
  const Y = { N3: pol(...Cy, r, 180), C4: pol(...Cy, r, 120), C5: pol(...Cy, r, 60), C6: pol(...Cy, r, 0), N1: pol(...Cy, r, 300), C2: pol(...Cy, r, 240) };
  const pyr = (isT) => {
    const at = { N1: ['N', Y.N1], C2: ['C', Y.C2], N3: ['N', Y.N3], C4: ['C', Y.C4], C5: ['C', Y.C5], C6: ['C', Y.C6], O2: ['O', out(Y.C2, Cy, 1.23)] };
    at[isT ? 'O4' : 'N4'] = [isT ? 'O' : 'N', out(Y.C4, Cy, isT ? 1.23 : 1.34)];
    if (isT) at.C7 = ['C', out(Y.C5, Cy, 1.5)];
    const bonds = [['N1', 'C2'], ['C2', 'N3'], ['N3', 'C4'], ['C4', 'C5'], ['C5', 'C6'], ['C6', 'N1'], ['C2', 'O2'], ['C4', isT ? 'O4' : 'N4']];
    if (isT) bonds.push(['C5', 'C7']);
    return { at, bonds, glyN: 'N1', glyDir: out(Y.N1, Cy, 1.47) };
  };
  const hb = { AT: [['N6', 'O4'], ['N1', 'N3']], GC: [['O6', 'N4'], ['N1', 'N3'], ['N2', 'O2']] };
  return { A: pur(false), G: pur(true), T: pyr(true), C: pyr(false), hb };
}
function buildHelixData(seq, mutIdx) {
  const T = baseTemplates();
  const atoms = [], bonds = [], hbonds = [], pairs = [];
  const RISE = 3.38, TW = 34.3 * Math.PI / 180;
  // geometria di riferimento: C1' delle due basi (coppia A–T)
  const c1L = T.A.glyDir, c1R = T.T.glyDir;
  const mx = (c1L[0] + c1R[0]) / 2, my = (c1L[1] + c1R[1]) / 2, half = Math.hypot(c1R[0] - c1L[0], c1R[1] - c1L[1]) / 2;
  const ay = my + Math.sqrt(Math.max(0, 5.9 * 5.9 - half * half));
  const toAxis = (p, flip) => [(flip ? -p[0] : p[0]) - (flip ? -mx : mx), p[1] - ay];
  const addAtom = (el, v, info) => { atoms.push({ el, v, ...info }); return atoms.length - 1; };
  const prevO3 = [null, null];
  const strandAtoms = [[], []];
  for (let i = 0; i < seq.length; i++) {
    const b1 = seq[i], b2 = COMP[b1];
    const leftIsPur = b1 === 'A' || b1 === 'G';
    // il filamento 1 sta sempre a sinistra: se la base è una pirimidina si specchia la coppia
    const pur = leftIsPur ? T[b1] : T[b2], pyr = leftIsPur ? T[b2] : T[b1];
    const flip = !leftIsPur;
    const ang = i * TW, z = (i - (seq.length - 1) / 2) * RISE;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const P3 = (xy, dz = 0) => new THREE.Vector3(xy[0] * ca - xy[1] * sa, xy[0] * sa + xy[1] * ca, z + dz);
    const pair = { i, b1, b2, atoms: [], center: new THREE.Vector3(0, 0, z) };
    const idxMap = [{}, {}];
    const place = (tmpl, strand, base) => {
      const ids = {};
      for (const k in tmpl.at) { const [el, xy] = tmpl.at[k]; ids[k] = addAtom(el, P3(toAxis(xy, flip)), { pair: i, strand, base, part: 'base' }); pair.atoms.push(ids[k]); }
      for (const [a, b] of tmpl.bonds) bonds.push([ids[a], ids[b]]);
      return ids;
    };
    const purStrand = leftIsPur ? 0 : 1, pyrStrand = 1 - purStrand;
    idxMap[purStrand] = place(pur, purStrand, leftIsPur ? b1 : b2);
    idxMap[pyrStrand] = place(pyr, pyrStrand, leftIsPur ? b2 : b1);
    const key = (pur === T.A) ? 'AT' : 'GC';
    for (const [a, b] of T.hb[key]) hbonds.push([idxMap[purStrand][a], idxMap[pyrStrand][b], i]);
    // zucchero e fosfato per ciascun filamento
    for (const st of [0, 1]) {
      const tmpl = st === purStrand ? pur : pyr;
      const c1xy = toAxis(tmpl.glyDir, flip);
      const c1 = P3(c1xy);
      const rr = new THREE.Vector3(c1.x, c1.y, 0).normalize();
      const tt = new THREE.Vector3(-rr.y, rr.x, 0); // tangente
      const sgn = st === 0 ? 1 : -1; // direzione 5'→3' lungo z
      const tdir = st === 0 ? 1 : -1;
      const base = st === 0 ? b1 : b2;
      const V = (r, t, zz) => c1.clone().addScaledVector(rr, r).addScaledVector(tt, t * tdir).add(new THREE.Vector3(0, 0, zz * sgn));
      const sug = {
        "C1'": c1, "O4'": V(0.75, 0.55, 1.05), "C4'": V(1.95, 0.95, 0.85), "C3'": V(2.25, 0.35, -0.45), "C2'": V(1.05, -0.05, -0.75),
      };
      sug["C5'"] = sug["C4'"].clone().addScaledVector(rr, 0.85).addScaledVector(tt, 0.7 * tdir).add(new THREE.Vector3(0, 0, 0.75 * sgn));
      sug["O5'"] = sug["C5'"].clone().addScaledVector(rr, 0.95).addScaledVector(tt, 0.25 * tdir).add(new THREE.Vector3(0, 0, 0.85 * sgn));
      sug["O3'"] = sug["C3'"].clone().addScaledVector(rr, 1.0).addScaledVector(tt, -0.55 * tdir).add(new THREE.Vector3(0, 0, -0.85 * sgn));
      const ids = {};
      for (const k in sug) { ids[k] = addAtom(k[0] === 'O' ? 'O' : 'C', sug[k], { pair: i, strand: st, base, part: 'sugar' }); pair.atoms.push(ids[k]); }
      bonds.push([ids["C1'"], idxMap[st][tmpl.glyN]], [ids["C1'"], ids["O4'"]], [ids["O4'"], ids["C4'"]], [ids["C4'"], ids["C3'"]], [ids["C3'"], ids["C2'"]], [ids["C2'"], ids["C1'"]], [ids["C4'"], ids["C5'"]], [ids["C5'"], ids["O5'"]], [ids["C3'"], ids["O3'"]]);
      strandAtoms[st].push({ i, O5: ids["O5'"], O3: ids["O3'"], c1: ids["C1'"] });
    }
    pairs.push(pair);
  }
  // fosfati: collegano O3'(i) a O5'(i+1) nel verso 5'→3' di ciascun filamento
  const phos = [[], []];
  for (const st of [0, 1]) {
    const L = strandAtoms[st];
    const order = st === 0 ? L : [...L].reverse();
    for (let k = 0; k < order.length - 1; k++) {
      const a = atoms[order[k].O3].v, b = atoms[order[k + 1].O5].v;
      const mid = a.clone().add(b).multiplyScalar(0.5); const rr = new THREE.Vector3(mid.x, mid.y, 0).normalize();
      const p = mid.clone().addScaledVector(rr, 0.75);
      const pid = addAtom('P', p, { pair: order[k + 1].i, strand: st, base: atoms[order[k + 1].c1].base, part: 'phosphate' });
      const ax = b.clone().sub(a).normalize(); const side = new THREE.Vector3().crossVectors(ax, rr).normalize();
      const o1 = addAtom('O', p.clone().addScaledVector(rr, 1.1).addScaledVector(side, 0.75), { pair: order[k + 1].i, strand: st, part: 'phosphate' });
      const o2 = addAtom('O', p.clone().addScaledVector(rr, 0.55).addScaledVector(side, -1.25), { pair: order[k + 1].i, strand: st, part: 'phosphate' });
      bonds.push([order[k].O3, pid], [pid, order[k + 1].O5], [pid, o1], [pid, o2]);
      phos[st].push(pid);
      pairs[order[k + 1].i].atoms.push(pid, o1, o2);
    }
  }
  return { atoms, bonds, hbonds, pairs, phos, strandAtoms };
}
function buildHelixView() {
  const grp = groups.helix = new THREE.Group(); GV.scene.add(grp);
  grp.rotation.x = -Math.PI / 2; // asse dell'elica verticale
  rebuildHelix(); helixHome();
  GV.tickers.push(() => { if (!G.helixSpin || G.view !== 'helix') return false; grp.rotation.z += 0.004; return true; });
}
function helixHome() { const L = H.n * 3.38; GV.controls.target.set(0, 0, 0); GV.camera.position.set(L * 0.95 + 20, 6, L * 0.55 + 18); GV.controls.minDistance = 8; GV.controls.maxDistance = 400; GV.flyTo(new THREE.Vector3(0, 0, 0), new THREE.Vector3(L * 0.45, 8, Math.max(80, L * 2.05 + 30))); }
function rebuildHelix() {
  const grp = groups.helix; while (grp.children.length) { const c = grp.children.pop(); c.geometry && c.geometry.dispose(); if (c.isCSS2DObject) c.element.remove(); }
  let seq = H.seq.slice(0, H.n).split('');
  const mutIdx = 19; // codone 7 del CDS (Glu6 della proteina matura): GAG → GTG
  if (H.mut && seq.length > mutIdx) seq[mutIdx] = 'T';
  const D = G.helixData = buildHelixData(seq, H.mut ? mutIdx : -1);
  const col = new THREE.Color();
  const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25, metalness: 0.0 });
  const colorOf = (a) => H.color === 'base' ? (a.part === 'base' ? BASE_COL[a.base] : a.part === 'sugar' ? 0xb8b0a2 : 0xffa53a) : ELEM_COL[a.el];
  if (H.mode === 'cartoon') {
    // nastri dello scheletro zucchero-fosfato + lastre delle basi
    for (const st of [0, 1]) {
      const pts = D.phos[st].map(id => D.atoms[id].v.clone()); if (st === 1) pts.reverse();
      if (pts.length > 2) {
        const curve = new THREE.CatmullRomCurve3(pts);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 10, 1.05, 14, false), new THREE.MeshPhysicalMaterial({ color: st ? 0x5a6fb8 : 0xc96a86, roughness: 0.35, clearcoat: 0.7 }));
        grp.add(tube);
      }
    }
    const slab = new THREE.BoxGeometry(1, 1, 1);
    const im = new THREE.InstancedMesh(slab, mat, D.pairs.length * 2); let k = 0;
    D.pairs.forEach((p, i) => {
      for (const st of [0, 1]) {
        const c1 = D.atoms[D.strandAtoms[st][i].c1].v;
        const ctr = new THREE.Vector3(0, 0, c1.z);
        const end = c1.clone().lerp(ctr, 0.93);
        const dir = end.clone().sub(c1); const L = dir.length();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
        im.setMatrixAt(k, new THREE.Matrix4().compose(c1.clone().add(end).multiplyScalar(0.5), q, new THREE.Vector3(L, 0.55, 2.4)));
        const b = st === 0 ? p.b1 : p.b2; im.setColorAt(k, col.setHex(BASE_COL[b])); im.userData[k] = { pair: i, strand: st }; k++;
      }
    });
    im.userData.kind = 'slab'; grp.add(im); G.pickHelix = im;
  } else {
    const sph = new THREE.SphereGeometry(1, 22, 16);
    const im = new THREE.InstancedMesh(sph, mat, D.atoms.length);
    D.atoms.forEach((a, k) => {
      const r = H.mode === 'space' ? ELEM_R[a.el] : ELEM_R[a.el] * 0.26;
      im.setMatrixAt(k, new THREE.Matrix4().compose(a.v, new THREE.Quaternion(), new THREE.Vector3(r, r, r)));
      im.setColorAt(k, col.setHex(colorOf(a)));
    });
    im.userData.kind = 'atoms'; grp.add(im); G.pickHelix = im;
    if (H.mode === 'stick') {
      const cyl = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
      // ciascun legame è diviso a metà con il colore dei due atomi
      const bm = new THREE.InstancedMesh(cyl, mat, D.bonds.length * 2); let k = 0;
      for (const [a, b] of D.bonds) {
        const A1 = D.atoms[a], B1 = D.atoms[b]; const m = A1.v.clone().add(B1.v).multiplyScalar(0.5);
        bm.setMatrixAt(k, cylMatrix(A1.v, m, 0.16)); bm.setColorAt(k++, col.setHex(colorOf(A1)));
        bm.setMatrixAt(k, cylMatrix(m, B1.v, 0.16)); bm.setColorAt(k++, col.setHex(colorOf(B1)));
      }
      grp.add(bm);
    }
  }
  // legami a idrogeno tratteggiati
  if (H.mode !== 'space') {
    const segs = []; for (const [a, b] of D.hbonds) { const A1 = D.atoms[a].v, B1 = D.atoms[b].v; for (let t = 0; t < 1; t += 0.2) segs.push([A1.clone().lerp(B1, t + 0.03), A1.clone().lerp(B1, t + 0.12)]); }
    const hm = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), new THREE.MeshBasicMaterial({ color: 0xece5d6, transparent: true, opacity: 0.75 }), segs.length);
    segs.forEach(([a, b], k) => hm.setMatrixAt(k, cylMatrix(a, b, 0.07))); grp.add(hm);
  }
  // evidenzia la mutazione
  if (H.mut && D.pairs[mutIdx]) {
    const p = D.pairs[mutIdx];
    const ring = new THREE.Mesh(new THREE.TorusGeometry(11.5, 0.22, 12, 96), new THREE.MeshBasicMaterial({ color: 0xe8789c }));
    ring.position.copy(p.center); grp.add(ring);
    const el = document.createElement('div'); el.className = 'pill'; el.style.cssText = 'background:rgba(16,21,28,.9);border-color:#e8789c;color:#ece5d6;transform:translate(0,-30px)';
    el.textContent = 'GAG → GTG · Glu6Val (emoglobina S)';
    const lab = new CSS2DObject(el); lab.position.copy(p.center).add(new THREE.Vector3(13, 0, 0)); grp.add(lab);
  }
  // etichette 5'/3'
  const tag = (txt, pos) => { const el = document.createElement('div'); el.className = 'mono'; el.style.cssText = 'color:#8c96a3;font-size:11px'; el.textContent = txt; const o = new CSS2DObject(el); o.position.copy(pos); grp.add(o); };
  const s0 = D.strandAtoms[0], s1 = D.strandAtoms[1];
  if (s0.length) { tag("5′", D.atoms[s0[0].c1].v.clone().add(new THREE.Vector3(0, 0, -4))); tag("3′", D.atoms[s0[s0.length - 1].c1].v.clone().add(new THREE.Vector3(0, 0, 4))); tag("3′", D.atoms[s1[0].c1].v.clone().add(new THREE.Vector3(0, 0, -4))); tag("5′", D.atoms[s1[s1.length - 1].c1].v.clone().add(new THREE.Vector3(0, 0, 4))); }
  GV.invalidate();
  if (G.view === 'helix') renderGenCardForView();
}

// =============== CROMATINA ===============
const CH = { mode: 'nucleo' };
function noiseBlob(r, seed) {
  let g = new THREE.IcosahedronGeometry(r, 5); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g); const p = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = v.clone().normalize();
    const f = 1 + 0.10 * Math.sin(n.x * 5 + seed) * Math.cos(n.y * 4 - seed * 1.3) + 0.06 * Math.sin(n.z * 9 + seed * 2.1) + 0.04 * Math.sin((n.x + n.y) * 13 + seed);
    v.copy(n).multiplyScalar(r * f); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
function doubleHelixAlong(points, { strandR = 0.95, tube = 0.28, rungs = true, colA = 0xc96a86, colB = 0x5a6fb8 } = {}) {
  // points: curva centrale in nm; restituisce un gruppo con i due filamenti e i gradini delle basi
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const L = curve.getLength(); const N = Math.max(20, Math.floor(L / 0.34));
  const frames = curve.computeFrenetFrames(N, false);
  const s1 = [], s2 = [], mids = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N; const p = curve.getPointAt(t); const ph = (t * L / 3.4) * Math.PI * 2;
    const nn = frames.normals[i], bb = frames.binormals[i];
    const o1 = nn.clone().multiplyScalar(Math.cos(ph)).addScaledVector(bb, Math.sin(ph));
    const ph2 = ph + 2.4; const o2 = nn.clone().multiplyScalar(Math.cos(ph2)).addScaledVector(bb, Math.sin(ph2));
    s1.push(p.clone().addScaledVector(o1, strandR)); s2.push(p.clone().addScaledVector(o2, strandR)); mids.push(p);
  }
  const g = new THREE.Group();
  const m1 = new THREE.MeshPhysicalMaterial({ color: colA, roughness: 0.35, clearcoat: 0.6 });
  const m2 = new THREE.MeshPhysicalMaterial({ color: colB, roughness: 0.35, clearcoat: 0.6 });
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(s1), N * 2, tube, 8), m1));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(s2), N * 2, tube, 8), m2));
  if (rungs) {
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), new THREE.MeshPhysicalMaterial({ roughness: 0.4, clearcoat: 0.3 }), (N + 1) * 2);
    const col = new THREE.Color(); const bases = 'ATGC'; let k = 0; let seed = 7;
    for (let i = 0; i <= N; i++) {
      seed = (seed * 16807) % 2147483647; const b = bases[seed % 4];
      const a = s1[i], c = s2[i]; const m = a.clone().lerp(c, 0.5);
      im.setMatrixAt(k, cylMatrix(a, m, 0.13)); im.setColorAt(k++, col.setHex(BASE_COL[b]));
      im.setMatrixAt(k, cylMatrix(m, c, 0.13)); im.setColorAt(k++, col.setHex(BASE_COL[COMP[b]]));
    }
    g.add(im);
  }
  return g;
}
function nucleosomeCore(withTails = true) {
  const g = new THREE.Group();
  const H_COL = { H2A: 0xe8789c, H2B: 0xd8b45c, H3: 0x9389ec, H4: 0x5fc0c8 };
  const layout = [['H3', 0.3, 1.0], ['H4', 1.6, 1.0], ['H2A', 3.3, 1.05], ['H2B', 4.7, 1.05]];
  let seed = 1;
  for (const side of [1, -1]) {
    for (const [h, a, rr] of layout) {
      const ang = a * (side === 1 ? 1 : -1) + (side === 1 ? 0 : Math.PI);
      const blob = new THREE.Mesh(noiseBlob(1.55 * rr, seed++), new THREE.MeshPhysicalMaterial({ color: H_COL[h], roughness: 0.5, clearcoat: 0.35, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) }));
      blob.position.set(Math.cos(ang) * 1.85, Math.sin(ang) * 1.85, side * 1.05); blob.scale.set(1.05, 1.05, 0.82);
      blob.userData.histone = h; g.add(blob);
      if (withTails) {
        const pts = []; const dir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), side * 0.6).normalize();
        let p = blob.position.clone().addScaledVector(dir, 1.3);
        for (let k = 0; k < 7; k++) { pts.push(p.clone()); p = p.clone().addScaledVector(dir, 0.55).add(new THREE.Vector3(Math.sin(k * 1.7 + seed) * 0.35, Math.cos(k * 1.3 + seed) * 0.35, Math.sin(k + seed) * 0.25)); }
        g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.11, 6), new THREE.MeshPhysicalMaterial({ color: H_COL[h], roughness: 0.6 })));
      }
    }
  }
  return g;
}
function superhelixPoints(turns = 1.67, R = 4.18, pitch = 2.39, steps = 160) {
  const pts = []; const th0 = -turns * Math.PI;
  for (let i = 0; i <= steps; i++) { const th = th0 + (i / steps) * turns * 2 * Math.PI; pts.push(new THREE.Vector3(R * Math.cos(th), R * Math.sin(th), -pitch * th / (2 * Math.PI))); }
  return pts;
}
function buildChromatinView() {
  const grp = groups.chromatin = new THREE.Group(); GV.scene.add(grp); rebuildChromatin(); chromHome();
  GV.tickers.push(() => { if (!G.chromSpin || G.view !== 'chromatin') return false; grp.rotation.y += 0.003; return true; });
}
function chromHome() { const far = CH.mode === 'fibra'; GV.controls.minDistance = 6; GV.controls.maxDistance = 600; GV.flyTo(new THREE.Vector3(0, 0, 0), far ? new THREE.Vector3(30, 20, 95) : new THREE.Vector3(10, 7, 24)); }
function rebuildChromatin() {
  const grp = groups.chromatin; while (grp.children.length) grp.remove(grp.children[0]);
  if (CH.mode === 'nucleo') {
    const core = nucleosomeCore(true); grp.add(core);
    const sh = superhelixPoints();
    const a0 = sh[0], a1 = sh[sh.length - 1];
    const pre = [a0.clone().add(new THREE.Vector3(-9, -3, 2)), a0.clone().add(new THREE.Vector3(-4, -1.2, 0.6))];
    const post = [a1.clone().add(new THREE.Vector3(4, 1.2, -0.6)), a1.clone().add(new THREE.Vector3(9, 3, -2))];
    grp.add(doubleHelixAlong([...pre, ...sh, ...post]));
    grp.rotation.set(-0.35, 0.4, 0);
  } else {
    // fibra a zigzag a due inizi (modello schematico)
    const n = 12; const tf = [];
    for (let i = 0; i < n; i++) {
      const ang = i * Math.PI * 0.88; const r = 11.5; const y = i * 5.2 - n * 2.6;
      const o = new THREE.Object3D(); o.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
      o.lookAt(0, y, 0); o.rotateY(Math.PI / 2); o.rotateX(0.35 * (i % 2 ? 1 : -1)); o.updateMatrix(); tf.push(o);
    }
    let path = [];
    const sh = superhelixPoints(1.67, 4.18, 2.39, 70);
    tf.forEach((o, i) => {
      const core = nucleosomeCore(false); core.applyMatrix4(o.matrix); grp.add(core);
      const pts = sh.map(p => p.clone().applyMatrix4(o.matrix));
      if (path.length) { const a = path[path.length - 1], b = pts[0]; const mid = a.clone().lerp(b, 0.5).multiplyScalar(1.15); path.push(a.clone().lerp(mid, 0.6), mid, b.clone().lerp(mid, 0.6)); }
      path.push(...pts);
    });
    grp.add(doubleHelixAlong(path, { strandR: 0.9, tube: 0.3, rungs: false }));
    grp.rotation.set(0, 0, 0.12);
  }
  GV.invalidate();
}

// =============== CARIOTIPO ===============
const K = { mode: 'bands', meshes: [], marker: null };
function chrInfo(c) {
  const bands = G.karyo.bands[c] || []; const L = G.karyo.lengths[c];
  const acen = bands.filter(b => b[3] === 'acen');
  const cen = acen.length ? (acen[0][1] + acen[acen.length - 1][2]) / 2 : L * 0.4;
  return { bands, L, cen };
}
function bandTexture(c, mode) {
  const { bands, L } = chrInfo(c); const W = 2048; const cv = document.createElement('canvas'); cv.width = W; cv.height = 4; const x = cv.getContext('2d');
  if (mode === 'bands') {
    for (const [, s, e, st] of bands) { x.fillStyle = STAIN[st] || '#bbb'; x.fillRect(Math.floor(s / L * W), 0, Math.ceil((e - s) / L * W) + 1, 4); }
  } else {
    const bins = new Float32Array(256); for (const g of G.genes) if (g.chr === c && g.kind === 'c') bins[Math.min(255, Math.floor(g.start / L * 256))]++;
    const mx = Math.max(...bins) || 1;
    const ramp = t => { const stops = [[0, [26, 30, 46]], [0.35, [147, 137, 236]], [0.7, [232, 120, 156]], [1, [236, 214, 140]]]; for (let k = 1; k < stops.length; k++) if (t <= stops[k][0]) { const [t0, c0] = stops[k - 1], [t1, c1] = stops[k]; const u = (t - t0) / (t1 - t0); return c0.map((v, j) => Math.round(v + (c1[j] - v) * u)); } return stops[3][1]; };
    for (let i = 0; i < 256; i++) { const [r, g, b] = ramp(Math.sqrt(bins[i] / mx)); x.fillStyle = `rgb(${r},${g},${b})`; x.fillRect(i * W / 256, 0, W / 256 + 1, 4); }
    for (const [, s, e, st] of bands) if (st === 'acen') { x.fillStyle = '#e8789c'; x.fillRect(Math.floor(s / L * W), 0, Math.ceil((e - s) / L * W) + 1, 4); }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.minFilter = THREE.LinearFilter; return t;
}
function chromatidGeometry(len, cenFrac, side) {
  const NL = 220, NR = 28; const R = 0.46; const pos = [], uv = [], idx = [];
  for (let i = 0; i <= NL; i++) {
    const s = i / NL; const y = (0.5 - s) * len;
    const tip = Math.min(s, 1 - s) * len; const round = tip < R ? Math.sqrt(Math.max(0, 1 - Math.pow((R - tip) / R, 2))) : 1;
    const cg = Math.exp(-Math.pow((s - cenFrac) * len / 0.32, 2));
    const r = R * round * (1 - 0.48 * cg) * (1 + 0.04 * Math.sin(s * len * 3.1));
    const dx = side * (0.47 * (1 - 0.62 * cg)) + side * 0.06 * Math.pow(Math.abs(s - cenFrac) * 2, 2);
    for (let j = 0; j <= NR; j++) { const a = j / NR * Math.PI * 2; pos.push(dx + Math.cos(a) * r, y, Math.sin(a) * r); uv.push(s, j / NR); }
  }
  for (let i = 0; i < NL; i++) for (let j = 0; j < NR; j++) { const a = i * (NR + 1) + j, b = a + NR + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function buildKaryoView() {
  const grp = groups.karyo = new THREE.Group(); GV.scene.add(grp);
  const rows = [['1', '2', '3', '4', '5'], ['6', '7', '8', '9', '10', '11', '12'], ['13', '14', '15', '16', '17', '18'], ['19', '20', '21', '22', 'X', 'Y']];
  const SC = 1 / 22e6; // unità per base
  let y0 = 0; K.meshes = [];
  rows.forEach((row, ri) => {
    const infos = row.map(c => chrInfo(c));
    const pMax = Math.max(...infos.map(f => f.cen * SC)), qMax = Math.max(...infos.map(f => (f.L - f.cen) * SC));
    const cy = y0 - pMax - 0.6;
    const spacing = 3.0; const x0 = -(row.length - 1) * spacing / 2;
    row.forEach((c, k) => {
      const f = infos[k]; const len = f.L * SC; const cenFrac = f.cen / f.L;
      const tex = bandTexture(c, K.mode);
      const mat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.62, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.55, clearcoat: 0.15 });
      const holder = new THREE.Group();
      for (const side of [-1, 1]) { const m = new THREE.Mesh(chromatidGeometry(len, cenFrac, side), mat); m.userData.chr = c; holder.add(m); K.meshes.push(m); }
      // centra il centromero sulla riga
      holder.position.set(x0 + k * spacing, cy - (cenFrac - 0.5) * len * -1, 0);
      holder.position.y = cy + (cenFrac - 0.5) * len;
      holder.userData = { chr: c, len, cenFrac, mat };
      const el = document.createElement('div'); el.style.cssText = 'font-family:"Bodoni Moda",serif;font-style:italic;font-size:17px;color:#ece5d6;cursor:pointer;pointer-events:auto';
      el.textContent = c; el.addEventListener('click', () => selectChromosome(c));
      const lab = new CSS2DObject(el); lab.position.set(0, -len / 2 - 0.9, 0); holder.add(lab);
      grp.add(holder); K[c] = holder;
    });
    y0 = cy - qMax - 1.9;
  });
  // DNA mitocondriale
  const mtTex = (() => { const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 4; const x = cv.getContext('2d'); x.fillStyle = '#3a3f52'; x.fillRect(0, 0, 1024, 4); for (const g of G.genes.filter(g => g.chr === 'MT')) { x.fillStyle = g.kind === 'c' ? '#e8789c' : '#9389ec'; x.fillRect(g.start / 16569 * 1024, 0, Math.max(2, g.len / 16569 * 1024), 4); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const mt = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.22, 20, 120), new THREE.MeshPhysicalMaterial({ map: mtTex, roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0xffffff) }));
  const lastRow = rows[3]; mt.position.set(-(lastRow.length - 1) * 1.5 + lastRow.length * 3.0 + 0.4, K['Y'].position.y + K['Y'].userData.len * 0.2, 0); mt.userData.chr = 'MT'; grp.add(mt); K.meshes.push(mt);
  { const el = document.createElement('div'); el.style.cssText = 'font-family:"IBM Plex Mono",monospace;font-size:11px;color:#8c96a3;pointer-events:auto;cursor:pointer'; el.textContent = 'mtDNA'; el.addEventListener('click', () => selectChromosome('MT')); const lab = new CSS2DObject(el); lab.position.set(0, -1.6, 0); mt.add(lab); }
  K.bbox = new THREE.Box3().setFromObject(grp); karyoHome();
  if (G.sel) karyoMarkGene(G.sel, false);
}
function karyoHome() {
  const b = K.bbox; if (!b) return; const c = b.getCenter(new THREE.Vector3()); const sz = b.getSize(new THREE.Vector3());
  const t = Math.tan(THREE.MathUtils.degToRad(GV.camera.fov) / 2);
  const d = Math.max(sz.y / (2 * t), sz.x / (2 * t * GV.camera.aspect)) * 1.12 + 2;
  GV.controls.minDistance = 2; GV.controls.maxDistance = 260; GV.flyTo(c, c.clone().add(new THREE.Vector3(0, 0, d)));
}
function setKaryoMode(m) {
  K.mode = m; for (const c of CHRS) { const h = K[c]; if (!h) continue; const t = bandTexture(c, m); h.userData.mat.map.dispose(); h.userData.mat.map = t; h.userData.mat.needsUpdate = true; }
  GV.invalidate();
}
function karyoMarkGene(g, fly) {
  if (!groups.karyo || g.chr === 'MT') return;
  const h = K[g.chr]; if (!h) return;
  if (!K.marker) {
    K.marker = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.07, 12, 64), new THREE.MeshBasicMaterial({ color: 0xd8b45c }));
    ring.rotation.x = Math.PI / 2; K.marker.add(ring);
    const glow = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.2, 12, 64), new THREE.MeshBasicMaterial({ color: 0xd8b45c, transparent: true, opacity: 0.25, depthWrite: false }));
    glow.rotation.x = Math.PI / 2; K.marker.add(glow);
    const el = document.createElement('div'); el.className = 'pill'; el.style.cssText = 'background:rgba(16,21,28,.92);border-color:#d8b45c;color:#ece5d6;font-style:italic;transform:translate(70%,0)';
    K.markerLabel = el; const lab = new CSS2DObject(el); lab.position.set(1.4, 0, 0); K.marker.add(lab);
    groups.karyo.add(K.marker);
  }
  const L = G.karyo.lengths[g.chr]; const s = (g.start + g.len / 2) / L;
  const y = h.position.y + (0.5 - s) * h.userData.len;
  K.marker.position.set(h.position.x, y, 0); K.marker.visible = true;
  K.markerLabel.textContent = `${g.s} · ${g.chr}${g.band}`;
  GV.invalidate();
  if (fly) GV.flyTo(new THREE.Vector3(h.position.x, y, 0), new THREE.Vector3(h.position.x + 3, y + 1.5, 24));
}
function selectChromosome(c) {
  G.chrSel = c; G.cardIsGene = false;
  const genes = G.genes.filter(g => g.chr === c); const cod = genes.filter(g => g.kind === 'c').length;
  const L = G.karyo.lengths[c]; const bands = (G.karyo.bands[c] || []).length;
  const notable = genes.filter(g => g.note).slice(0, 24);
  gcard.innerHTML = `
  <div class="card-h"><div class="kicker">${c === 'MT' ? 'Genoma mitocondriale' : 'Cromosoma'}</div>
  <h2>${c === 'MT' ? 'DNA mitocondriale' : 'Cromosoma ' + c}</h2><div class="en">${fmtBp(L)} · ${fmtInt(genes.length)} geni annotati</div></div>
  <div class="card-b">
    ${CHROMO_NOTES[c] ? `<p style="color:var(--bone)">${esc(CHROMO_NOTES[c])}</p>` : ''}
    <dl class="facts">
      <dt>Lunghezza</dt><dd>${fmtInt(L)} paia di basi</dd>
      <dt>Geni codificanti</dt><dd>${fmtInt(cod)}</dd>
      <dt>Altri geni (RNA, pseudogeni)</dt><dd>${fmtInt(genes.length - cod)}</dd>
      ${bands ? `<dt>Bande G (risoluzione 850)</dt><dd>${bands}</dd>` : ''}
      ${c !== 'MT' ? `<dt>Densità</dt><dd>${fmtNum(cod / (L / 1e6), 1)} geni codificanti per Mb</dd>` : ''}
    </dl>
    ${c !== 'MT' ? '<div class="sub-h">Densità dei geni codificanti lungo il cromosoma</div><canvas class="chart" id="chr-dens"></canvas><div class="note">Dal braccio corto (p, a sinistra) al braccio lungo (q). La banda rosa indica il centromero.</div>' : ''}
    ${notable.length ? `<div class="sub-h">Geni con scheda illustrata</div><div class="chips">${notable.map(g => `<button class="chip" data-gene="${esc(g.s)}" style="font-style:italic">${esc(g.s)}</button>`).join('')}</div>` : ''}
    <div class="actions"><button class="ibtn" id="chr-filter">Elenca i geni di questo cromosoma</button></div>
  </div>`;
  gcard.scrollTop = 0;
  const cv = $('#chr-dens');
  if (cv) {
    const [x, w] = setupCanvas(cv, 70); const bins = new Float32Array(120); for (const g of genes) if (g.kind === 'c') bins[Math.min(119, Math.floor(g.start / L * 120))]++;
    const mx = Math.max(...bins) || 1; const bw = (w - 8) / 120;
    for (let i = 0; i < 120; i++) { const hh = bins[i] / mx * 48; x.fillStyle = '#9389ec'; x.fillRect(4 + i * bw, 52 - hh, bw - 0.6, hh); }
    for (const [, s, e, st] of G.karyo.bands[c]) { x.fillStyle = STAIN[st] || '#999'; x.fillRect(4 + s / L * (w - 8), 58, Math.max(1, (e - s) / L * (w - 8)), 8); }
  }
  $('#chr-filter').addEventListener('click', () => { $('#f-chr').value = c; $('#f-type').value = ''; $('#gene-q').value = ''; filterGenes(); if (isNarrow()) { closeSheet('gen-info'); openSheet('gen-left'); } });
  if (isNarrow()) openSheet('gen-info');
}
gcard.addEventListener('click', e => { const b = e.target.closest('[data-gene]'); if (b) selectGene(b.dataset.gene); const s = e.target.closest('[data-chr]'); if (s) { setGenView('karyo'); selectChromosome(s.dataset.chr); } });

// -------- interazioni nelle scene del genoma --------
const gray = new THREE.Raycaster();
function wireGenInteractions() {
  const el = GV.renderer.domElement; const tip = $('#gen-tip');
  const pickG = (ev) => {
    gray.setFromCamera(GV.ndc(ev), GV.camera);
    if (G.view === 'karyo') {
      const h = gray.intersectObjects(K.meshes, false)[0]; if (!h) return null;
      const c = h.object.userData.chr; if (c === 'MT') return { chr: 'MT' };
      const L = G.karyo.lengths[c]; const pos = h.uv.x * L; const band = (G.karyo.bands[c] || []).find(b => pos >= b[1] && pos <= b[2]);
      return { chr: c, pos, band: band ? band[0] : '' };
    }
    if (G.view === 'helix' && G.pickHelix) {
      const h = gray.intersectObject(G.pickHelix, false)[0]; if (!h) return null;
      const D = G.helixData;
      if (G.pickHelix.userData.kind === 'slab') { const u = G.pickHelix.userData[h.instanceId]; const p = D.pairs[u.pair]; return { pair: u.pair, strand: u.strand, base: u.strand ? p.b2 : p.b1 }; }
      const a = D.atoms[h.instanceId]; return { pair: a.pair, strand: a.strand, base: a.base || D.pairs[a.pair][a.strand ? 'b2' : 'b1'], part: a.part, el: a.el };
    }
    if (G.view === 'chromatin') {
      const h = gray.intersectObject(groups.chromatin, true).find(x => x.object.userData.histone); return h ? { histone: h.object.userData.histone } : null;
    }
    return null;
  };
  onTap(el, e => {
    const r = pickG(e); if (!r) return;
    if (r.chr) { if (r.chr === 'MT') { selectChromosome('MT'); return; } selectChromosome(r.chr); }
    else if (r.pair != null) { G.helixPick = r; renderGenCardForView(); }
    else if (r.histone) { G.histPick = r.histone; renderGenCardForView(); }
  });
  let last = 0;
  el.addEventListener('pointermove', e => {
    if (e.buttons || e.pointerType === 'touch') { tip.hidden = true; return; }
    const now = performance.now(); if (now - last < 50) return; last = now;
    const r = pickG(e); const rect = genStage.getBoundingClientRect();
    if (!r) { tip.hidden = true; el.style.cursor = ''; return; }
    let html = '';
    if (r.chr === 'MT') html = 'DNA mitocondriale<small>16.569 bp · 37 geni</small>';
    else if (r.chr) html = `Cromosoma ${r.chr}<small class="mono">${r.chr}${r.band} · ${fmtNum(r.pos / 1e6, 1)} Mb</small>`;
    else if (r.pair != null) html = `${BASE_IT[r.base]} (${r.base}) · coppia ${r.pair + 1}<small>${r.part === 'sugar' ? 'deossiribosio' : r.part === 'phosphate' ? 'gruppo fosfato' : 'base azotata'} · filamento ${r.strand ? '3′→5′' : '5′→3′'}</small>`;
    else if (r.histone) html = `Istone ${r.histone}<small>ottamero istonico</small>`;
    tip.innerHTML = html; tip.style.left = (e.clientX - rect.left) + 'px'; tip.style.top = (e.clientY - rect.top) + 'px'; tip.hidden = false; el.style.cursor = 'pointer';
  });
  el.addEventListener('pointerleave', () => tip.hidden = true);
}

// -------- HUD e schede per vista --------
function renderGenHud() {
  const hud = $('#gen-hud');
  if (G.view === 'helix') hud.innerHTML = `
    <div class="tool"><label for="h-mode">Modello</label><select id="h-mode"><option value="stick">Sfere e bastoncini</option><option value="space">Spazio pieno</option><option value="cartoon">Schematico</option></select></div>
    <div class="tool"><label for="h-col">Colori</label><select id="h-col"><option value="elem">per elemento</option><option value="base">per base</option></select></div>
    <div class="tool"><label for="h-n">Coppie</label><input id="h-n" type="range" min="10" max="${H.seq.length}" step="1" value="${H.n}"><span class="mono" id="h-nv">${H.n}</span></div>
    <button class="ibtn${H.mut ? ' on' : ''}" id="h-mut">Mutazione falciforme</button>
    <button class="ibtn${G.helixSpin ? ' on' : ''}" id="h-spin">Rotazione</button>`;
  if (G.view === 'chromatin') hud.innerHTML = `
    <div class="tool"><label for="c-mode">Scala</label><select id="c-mode"><option value="nucleo">Nucleosoma</option><option value="fibra">Fibra di cromatina</option></select></div>
    <button class="ibtn${G.chromSpin ? ' on' : ''}" id="c-spin">Rotazione</button>`;
  if (G.view === 'karyo') hud.innerHTML = `
    <div class="tool"><label for="k-mode">Colorazione</label><select id="k-mode"><option value="bands">Bande G (Giemsa)</option><option value="density">Densità dei geni</option></select></div>
    <button class="ibtn" id="k-home">Vista d'insieme</button>`;
  const on = (id, ev, f) => { const x = $('#' + id); if (x) x.addEventListener(ev, f); };
  if ($('#h-mode')) { $('#h-mode').value = H.mode; $('#h-col').value = H.color; }
  on('h-mode', 'change', e => { H.mode = e.target.value; rebuildHelix(); });
  on('h-col', 'change', e => { H.color = e.target.value; rebuildHelix(); });
  on('h-n', 'input', e => { H.n = +e.target.value; $('#h-nv').textContent = H.n; clearTimeout(H._t); H._t = setTimeout(() => rebuildHelix(), 120); });
  on('h-mut', 'click', e => { H.mut = !H.mut; if (H.mut && H.n < 24) { H.n = 24; } e.currentTarget.classList.toggle('on', H.mut); renderGenHud(); rebuildHelix(); });
  on('h-spin', 'click', e => { G.helixSpin = !G.helixSpin; e.currentTarget.classList.toggle('on', G.helixSpin); GV.invalidate(); });
  if ($('#c-mode')) $('#c-mode').value = CH.mode;
  on('c-mode', 'change', e => { CH.mode = e.target.value; rebuildChromatin(); chromHome(); renderGenCardForView(); });
  on('c-spin', 'click', e => { G.chromSpin = !G.chromSpin; e.currentTarget.classList.toggle('on', G.chromSpin); GV.invalidate(); });
  if ($('#k-mode')) $('#k-mode').value = K.mode;
  on('k-mode', 'change', e => setKaryoMode(e.target.value));
  on('k-home', 'click', karyoHome);
}
function codonStrip() {
  let seq = H.seq.split(''); if (H.mut) seq[19] = 'T';
  const out = [];
  for (let i = 0; i + 2 < seq.length; i += 3) {
    const cod = seq.slice(i, i + 3).join(''); const aa = CODON[cod];
    const n = i / 3; const inView = i < H.n;
    out.push(`<span class="codon${H.mut && n === 6 ? ' mut' : ''}${inView ? '' : ''}" title="${esc(AA_IT[aa][1])}" style="${inView ? '' : 'opacity:.45'}"><b>${cod}</b><i>${AA_IT[aa][0]}</i></span>`);
  }
  return out.join('');
}
function renderGenCardForView() {
  if (G.view !== 'karyo') G.cardIsGene = false;
  if (G.view === 'helix') {
    const pk = G.helixPick;
    gcard.innerHTML = `
    <div class="card-h"><div class="kicker">Struttura molecolare · DNA di forma B</div><h2>La doppia elica</h2>
    <div class="en">Inizio della sequenza codificante del gene <i>HBB</i> (beta-globina)</div></div>
    <div class="card-b">
      ${pk ? `<div style="border:1px solid var(--line-2);border-radius:10px;padding:10px 12px;margin-bottom:12px">
        <div class="kicker"><span class="dot" style="background:#${BASE_COL[pk.base].toString(16).padStart(6, '0')}"></span>Coppia ${pk.pair + 1} · filamento ${pk.strand ? '3′→5′' : '5′→3′'}</div>
        <p style="margin:6px 0 0;color:var(--bone)">${esc(BASE_IT[pk.base])} appaiata con ${esc(BASE_IT[COMP[pk.base]])}: ${pk.base === 'A' || pk.base === 'T' ? 'due' : 'tre'} legami a idrogeno. ${pk.base === 'A' || pk.base === 'G' ? 'Purina: due anelli fusi.' : 'Pirimidina: un solo anello.'}${pk.part === 'sugar' ? ' Hai selezionato il deossiribosio, lo zucchero a cinque atomi di carbonio che collega la base allo scheletro.' : pk.part === 'phosphate' ? ' Hai selezionato un gruppo fosfato: le sue cariche negative rendono il DNA un acido.' : ''}</p></div>` : ''}
      <p>Il DNA è formato da due filamenti avvolti l'uno sull'altro in un'elica destrorsa. Ogni filamento è una catena di nucleotidi: uno zucchero (deossiribosio), un gruppo fosfato e una base azotata. Le basi dei due filamenti si appaiano al centro secondo regole fisse: adenina con timina, guanina con citosina.</p>
      <p>I filamenti sono antiparalleli: uno corre in direzione 5′→3′, l'altro 3′→5′. Poiché i legami tra gli zuccheri non sono simmetrici, tra i filamenti si aprono un solco maggiore e un solco minore, dove le proteine leggono la sequenza senza aprire l'elica.</p>
      <dl class="facts">
        <dt>Diametro</dt><dd>circa 2 nm</dd>
        <dt>Distanza tra coppie</dt><dd>0,34 nm</dd>
        <dt>Coppie per giro</dt><dd>circa 10,5</dd>
        <dt>Passo dell'elica</dt><dd>circa 3,4–3,6 nm</dd>
        <dt>Genoma umano</dt><dd>circa 3,1 miliardi di coppie per corredo</dd>
        <dt>DNA in una cellula</dt><dd>circa 2 metri, se disteso</dd>
      </dl>
      <div class="sub-h">Dalla sequenza alla proteina</div>
      <p>Ogni tripletta di basi (codone) corrisponde a un aminoacido. Le coppie visibili nel modello sono evidenziate.${H.mut ? ' La sostituzione di una sola base nel settimo codone (GAG→GTG) cambia l\'acido glutammico in valina: è la mutazione dell\'anemia falciforme. La proteina matura perde la metionina iniziale, per questo si parla di posizione 6.' : ' Attiva «Mutazione falciforme» per vedere come una singola base cambia la proteina.'}</p>
      <div class="codons">${codonStrip()}</div>
      <div class="sub-h">Prova con una tua sequenza</div>
      <textarea class="seqin" id="seq-in" spellcheck="false" aria-label="Sequenza di DNA">${esc(H.seq)}</textarea>
      <div class="actions"><button class="ibtn" id="seq-go">Costruisci l'elica</button><button class="ibtn" id="seq-reset">Ripristina HBB</button></div>
      <div class="err" id="seq-err" hidden></div>
      <div class="sub-h">Legenda</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:12.5px">
        ${H.color === 'base' || H.mode === 'cartoon' ? Object.entries(BASE_IT).map(([k, v]) => `<span><span class="dot" style="background:#${BASE_COL[k].toString(16).padStart(6, '0')}"></span> ${v} (${k})</span>`).join('') : Object.entries({ C: 'Carbonio', N: 'Azoto', O: 'Ossigeno', P: 'Fosforo' }).map(([k, v]) => `<span><span class="dot" style="background:#${ELEM_COL[k].toString(16).padStart(6, '0')}"></span> ${v}</span>`).join('')}
      </div>
      <p class="note">Modello costruito con la geometria ideale del DNA B: anelli delle basi, zuccheri e fosfati sono posizionati in modo schematico; gli atomi di idrogeno non sono mostrati.</p>
    </div>`;
    $('#seq-go').addEventListener('click', () => {
      const v = $('#seq-in').value.toUpperCase().replace(/[\s\d]/g, '');
      const err = $('#seq-err');
      if (!/^[ACGT]+$/.test(v)) { err.hidden = false; err.textContent = 'Usa solo le lettere A, C, G e T (gli spazi vengono ignorati).'; return; }
      if (v.length < 4) { err.hidden = false; err.textContent = 'Servono almeno 4 basi.'; return; }
      err.hidden = true; H.seq = v.slice(0, 200); H.n = Math.min(H.seq.length, Math.max(H.n, Math.min(36, H.seq.length))); H.mut = false; G.helixPick = null; renderGenHud(); rebuildHelix(); helixHome();
    });
    $('#seq-reset').addEventListener('click', () => { H.seq = HBB_CDS; H.n = 36; H.mut = false; G.helixPick = null; renderGenHud(); rebuildHelix(); helixHome(); });
  } else if (G.view === 'chromatin') {
    const hp = G.histPick;
    const HI = { H2A: 'H2A e H2B formano due dimeri che chiudono le facce dell\'ottamero. Varianti come H2A.Z e H2A.X segnano regioni particolari: H2A.X fosforilata è uno dei primi segnali di danno al DNA.', H2B: 'H2B si appaia con H2A; la sua ubiquitinazione è collegata alla trascrizione attiva.', H3: 'H3 forma con H4 il tetramero centrale. La sua coda è il bersaglio più studiato delle modificazioni epigenetiche: H3K4me3 segna i promotori attivi, H3K27me3 e H3K9me3 i geni silenziati.', H4: 'H4 è tra le proteine più conservate in evoluzione. L\'acetilazione della sua coda (per esempio su K16) rende la cromatina più aperta.' };
    gcard.innerHTML = `
    <div class="card-h"><div class="kicker">Organizzazione del genoma</div><h2>${CH.mode === 'nucleo' ? 'Il nucleosoma' : 'La fibra di cromatina'}</h2>
    <div class="en">${CH.mode === 'nucleo' ? '147 coppie di basi avvolte su un ottamero di istoni' : 'Nucleosomi in successione, modello a zigzag'}</div></div>
    <div class="card-b">
      ${hp ? `<div style="border:1px solid var(--line-2);border-radius:10px;padding:10px 12px;margin-bottom:12px"><div class="kicker">Istone ${hp}</div><p style="margin:6px 0 0;color:var(--bone)">${esc(HI[hp])}</p></div>` : ''}
      ${CH.mode === 'nucleo' ? `
      <p>Per entrare in un nucleo di circa 6 micrometri, i due metri di DNA di ogni cellula vengono avvolti attorno a rocchetti di proteine, gli istoni. Ogni nucleosoma è formato da otto istoni (due copie ciascuno di H2A, H2B, H3 e H4) attorno ai quali il DNA compie circa 1,65 giri in senso sinistrorso.</p>
      <p>Gli istoni sono ricchi di lisina e arginina, aminoacidi carichi positivamente che attraggono i fosfati negativi del DNA. Le loro code flessibili sporgono dal nucleosoma e portano modificazioni chimiche (acetilazione, metilazione, fosforilazione) che decidono quanto un gene sia accessibile: è il cuore dell'epigenetica.</p>
      <dl class="facts"><dt>DNA avvolto</dt><dd>147 bp, circa 1,65 giri</dd><dt>Diametro del nucleosoma</dt><dd>circa 11 nm</dd><dt>DNA di collegamento</dt><dd>20–80 bp</dd><dt>Nucleosomi per cellula</dt><dd>circa 30 milioni</dd></dl>
      <div class="sub-h">Legenda</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:12.5px">${[['H2A', '#e8789c'], ['H2B', '#d8b45c'], ['H3', '#9389ec'], ['H4', '#5fc0c8']].map(([n, c]) => `<span><span class="dot" style="background:${c}"></span> Istone ${n}</span>`).join('')}</div>
      <p class="note">Clicca su un istone per leggere il suo ruolo.</p>` : `
      <p>I nucleosomi collegati dal DNA linker formano la «collana di perle» da 10 nm. L'istone H1 e le interazioni tra nucleosomi vicini la ripiegano in strutture più compatte. Il modello mostra una disposizione a zigzag a due inizi osservata in vitro; nelle cellule la cromatina appare più irregolare e dinamica.</p>
      <p>Nella mitosi la compattazione raggiunge il massimo: i cromosomi diventano visibili al microscopio ottico, circa 10.000 volte più corti del DNA che contengono.</p>
      <dl class="facts"><dt>Collana di perle</dt><dd>circa 10 nm</dd><dt>Fibra compatta (in vitro)</dt><dd>circa 30 nm</dd><dt>Compattazione in mitosi</dt><dd>circa 10.000 volte</dd></dl>`}
    </div>`;
  } else if (G.view === 'karyo') {
    if (G.cardIsGene) return;
    if (G.chrSel) { selectChromosome(G.chrSel); return; }
    const cod = G.genes.filter(g => g.kind === 'c').length;
    gcard.innerHTML = `
    <div class="card-h"><div class="kicker">Genoma umano · GRCh38</div><h2>Il cariotipo</h2><div class="en">22 coppie di autosomi, i cromosomi sessuali X e Y, il DNA mitocondriale</div></div>
    <div class="card-b">
      <p>Ogni cellula con nucleo contiene 46 cromosomi: 23 ereditati dalla madre e 23 dal padre. Qui ne è mostrato un esemplare per tipo, nella forma che assumono durante la divisione cellulare: due cromatidi fratelli identici uniti al centromero.</p>
      <p>Le bande chiare e scure sono quelle che si osservano colorando i cromosomi con il Giemsa: le bande chiare sono più ricche di geni e di coppie G–C, quelle scure più povere. Le coordinate delle bande (per esempio 17p13.1) servono a indicare la posizione di un gene.</p>
      <dl class="facts"><dt>Geni nel catalogo</dt><dd>${fmtInt(G.genes.length)}</dd><dt>Codificanti proteine</dt><dd>${fmtInt(cod)}</dd><dt>Parte codificante del genoma</dt><dd>circa l'1,5%</dd></dl>
      <p class="note">Passa sopra un cromosoma per leggere la banda; clicca per aprire la sua scheda. Scegli un gene dall'elenco per vederne la posizione.</p>
      <div class="chips">${CHRS.map(c => `<button class="chip" data-chr="${c}">${c}</button>`).join('')}<button class="chip" data-chr="MT">mtDNA</button></div>
    </div>`;
  }
}
