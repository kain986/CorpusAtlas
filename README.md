# Corpus — atlante 3D del corpo umano e del genoma

Webapp educativa in italiano per esplorare in 3D il corpo umano e il DNA. Funziona interamente nel browser: nessun server, nessun account, nessuna installazione.

**Anatomia**
- Due modelli di riferimento selezionabili: **uomo** (2.234 strutture, BodyParts3D) e **donna** (888 strutture, Human Reference Atlas).
- Ogni struttura è cliccabile, con nome italiano, ingombro misurato e scheda dell'organo o della regione a cui appartiene.
- Schede descrittive per 16 apparati e circa 60 organi e regioni, con **foto reali e al microscopio** da Wikimedia Commons (autore e licenza indicati).
- Strumenti: viste rapide, attivazione per apparato, vista esplosa, piani di sezione sagittale/coronale/trasversale, isolamento, trasparenza del contesto, ricerca in italiano e in inglese, occlusione ambientale.

**Genoma**
- **Doppia elica** atomo per atomo (DNA B), con traduzione in codoni, mutazione dell'anemia falciforme e sequenza personalizzata.
- **Cromatina**: nucleosoma con gli istoni e fibra di cromatina.
- **Cariotipo** 3D con bande G reali o densità dei geni, più il DNA mitocondriale.
- **Catalogo di 30.842 geni** (19.418 codificanti): posizione, banda, struttura esoni-introni, domini proteici, espressione in 49 tessuti GTEx, collegamenti alle banche dati; schede illustrate in italiano per 155 geni noti.

## Pubblicazione con GitHub Pages
Il sito pronto è nella cartella `docs/`. In *Settings → Pages* scegli *Deploy from a branch*, branch `main`, cartella `/docs`. Il sito sarà su `https://<utente>.github.io/CorpusAtlas/`.

Collegamenti diretti: `#genoma` apre la sezione del DNA, `#donna` e `#uomo` scelgono il modello anatomico.

Per provarlo in locale serve un server statico (i file vengono caricati con `fetch`):

```sh
python3 -m http.server -d docs 8000
# poi apri http://localhost:8000
```

## Struttura del repository

| Percorso | Contenuto |
|---|---|
| `src/` | Sorgenti: `page.html` (struttura e stile), `core.js` (viewport 3D e utilità), `anatomy.js`, `genome.js`, `main.js`, testi italiani in `data_it.js` e `media_it.js` |
| `data-src/` | Traduzioni dei nomi anatomici, descrizioni di sistemi e organi |
| `tools/` | Script Python che generano i dati e il file `docs/index.html` |
| `docs/` | Sito pubblicato: pagina unica, geometrie compresse e dati genomici |

Dopo una modifica a `src/`, rigenera la pagina:

```sh
python3 tools/bundle.py
```

Per rigenerare anche i dati servono le fonti originali (non incluse):

```sh
# geometrie (modello maschile e, nel commit d72b4f6, femminile)
git clone https://github.com/ashemag/human-atlas vendor/human-atlas
# file del modello femminile estratti dal commit d72b4f6 di human-atlas in vendor/female
# cache genomica di Ideogram.js
npm pack ideogram@1.53.0 && mkdir -p vendor/ideogram && tar xzf ideogram-1.53.0.tgz -C vendor/ideogram

python3 tools/build_anatomy.py
python3 tools/build_female.py
python3 tools/build_genome.py
python3 tools/bundle.py
```

I file `*.bin.wasm` e `*.tsv.wasm` sono in realtà dati compressi con gzip: l'estensione serve solo a farli servire da qualsiasi hosting statico; l'app li decomprime nel browser.

## Note
Strumento educativo, non clinico né diagnostico. Il modello femminile ha organi interni molto dettagliati ma scheletro e muscoli solo parziali. Le foto di Commons sono scelte da ricerche mirate e alcune possono essere poco pertinenti: le frecce mostrano alternative.

Codice con licenza MIT; i dati mantengono le licenze originali, elencate in [ATTRIBUTION.md](ATTRIBUTION.md).
