// =====================================================================
//  AVVIO E NAVIGAZIONE
// =====================================================================
function showSection(which) {
  const anat = which === 'anat';
  $('#v-anat').hidden = !anat; $('#v-gen').hidden = anat;
  $('#tab-anat').setAttribute('aria-selected', String(anat)); $('#tab-gen').setAttribute('aria-selected', String(!anat));
  if (AV) { AV.active = anat; if (anat) { AV.resize(); } }
  if (!anat) {
    if (!G.loaded) loadGenes().catch(err => { $('#gene-count').textContent = 'Errore nel caricamento del catalogo: ' + err.message; });
    if (!GV) { G.onLoaded = () => { if (!groups[G.view]) setGenView(G.view); }; initGenome3D(); setGenView('helix'); }
    GV.active = true; GV.resize();
  } else if (GV) GV.active = false;
  try { history.replaceState(null, '', anat ? '#anatomia' : '#genoma'); } catch { }
  lsSet('corpus.tab', which);
}
$('#tab-anat').addEventListener('click', () => showSection('anat'));
$('#tab-gen').addEventListener('click', () => showSection('gen'));
$('#btn-about').addEventListener('click', () => $('#about').hidden = false);
$('#about-close').addEventListener('click', () => $('#about').hidden = true);
$('#about').addEventListener('click', e => { if (e.target.id === 'about') $('#about').hidden = true; });

(function () { const c = document.createElement('canvas'); if (!(c.getContext('webgl2') || c.getContext('webgl'))) { $('#anat-ttl').textContent = 'Grafica 3D non disponibile'; $('#anat-sub').textContent = 'Il browser non supporta WebGL o l\'accelerazione grafica è disattivata. Prova ad attivarla nelle impostazioni o ad aprire la pagina con un browser aggiornato.'; } })();
addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!$('#about').hidden) { $('#about').hidden = true; return; } ['anat-left', 'anat-info', 'gen-left', 'gen-info'].forEach(closeSheet); });
if (location.hash === '#donna') lsSet('corpus.sex', 'f'); else if (location.hash === '#uomo') lsSet('corpus.sex', 'm');
initAnatomy().catch(err => { console.error(err); $('#anat-sub').textContent = 'Errore: ' + err.message; });
if (location.hash === '#genoma') showSection('gen');
