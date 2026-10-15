import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- utilità ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const fmtInt = n => n.toLocaleString('it-IT');
const fmtNum = (n, d = 1) => n.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isNarrow = () => matchMedia('(max-width: 900px)').matches;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };

async function fetchBytes(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Impossibile scaricare ${url} (${res.status})`);
  let buf;
  if (onProgress && res.body && res.headers.get('content-length')) {
    const total = +res.headers.get('content-length'); const reader = res.body.getReader();
    const chunks = []; let got = 0;
    for (; ;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; onProgress(Math.min(1, got / total)); }
    buf = new Uint8Array(got); let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
  } else buf = new Uint8Array(await res.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const ds = new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip')));
    return await ds.arrayBuffer();
  }
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}
async function fetchText(url) { return new TextDecoder().decode(await fetchBytes(url)); }

// ---------- viewport 3D con rendering su richiesta ----------
class Viewport {
  constructor(host, { ao = false, labels = false, fov = 32, near = 0.01, far = 100 } = {}) {
    this.host = host;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.domElement.className = 'gl';
    host.prepend(r.domElement);
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.6;
    this.camera = new THREE.PerspectiveCamera(fov, 1, near, far);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('change', () => this.invalidate());
    this.needs = true; this.active = true; this.autoRotate = false; this.anim = null; this.tickers = [];
    if (labels) {
      this.labelRenderer = new CSS2DRenderer();
      Object.assign(this.labelRenderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
      host.appendChild(this.labelRenderer.domElement);
    }
    this.aoEnabled = false;
    if (ao) this.setupComposer();
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    const loop = (t) => { requestAnimationFrame(loop); this.frame(t); };
    requestAnimationFrame(loop);
  }
  setupComposer() {
    const r = this.renderer;
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.gtao = new GTAOPass(this.scene, this.camera, 2, 2);
    this.gtao.blendIntensity = 0.85;
    this.gtao.updateGtaoMaterial({ radius: 0.06, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    this.composer.addPass(this.gtao);
    this.composer.addPass(new OutputPass());
  }
  resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
    if (this.labelRenderer) this.labelRenderer.setSize(w, h);
    this.invalidate();
  }
  invalidate() { this.needs = true; }
  flyTo(target, position, dur = 900) {
    const c = this.camera, ctl = this.controls;
    const t0 = ctl.target.clone(), p0 = c.position.clone(); const start = performance.now();
    if (reducedMotion) dur = 1;
    this.anim = (now) => {
      let k = clamp((now - start) / dur, 0, 1); const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      ctl.target.lerpVectors(t0, target, e); c.position.lerpVectors(p0, position, e);
      if (k >= 1) this.anim = null; this.invalidate();
    };
  }
  frame(t) {
    if (!this.active) return;
    if (this.anim) this.anim(t);
    for (const f of this.tickers) if (f(t)) this.needs = true;
    if (this.autoRotate) {
      const ctl = this.controls; const off = this.camera.position.clone().sub(ctl.target);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.0025); this.camera.position.copy(ctl.target).add(off); this.needs = true;
    }
    const moved = this.controls.update();
    if (!this.needs && !moved) return;
    this.needs = false;
    if (this.composer && this.aoEnabled) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    if (this.labelRenderer) this.labelRenderer.render(this.scene, this.camera);
  }
  ndc(ev) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  }
}

// gestore click vs trascinamento
function onTap(el, cb, dbl) {
  let sx = 0, sy = 0, t = 0, lastTap = 0;
  el.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; t = performance.now(); });
  el.addEventListener('pointerup', e => {
    if (Math.hypot(e.clientX - sx, e.clientY - sy) > 6 || performance.now() - t > 600) return;
    const now = performance.now();
    if (dbl && now - lastTap < 320) { lastTap = 0; dbl(e); return; }
    lastTap = now; cb(e);
  });
}

// schermata informazioni e pannelli mobili
function openSheet(id) { const el = document.getElementById(id); if (el) el.classList.add('open'); }
function closeSheet(id) { const el = document.getElementById(id); if (el) el.classList.remove('open'); }
document.addEventListener('click', e => {
  const o = e.target.closest('[data-open]'); if (o) { const id = o.dataset.open; const el = document.getElementById(id); el.classList.toggle('open'); }
  const c = e.target.closest('[data-close]'); if (c) closeSheet(c.dataset.close);
});
