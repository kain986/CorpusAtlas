# Fonti dei dati e licenze

## Modello anatomico maschile
BodyParts3D 4.0, © The Database Center for Life Science (DBCLS), licenza [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Mitsuhashi N. et al. (2009), *BodyParts3D: 3D structure database for anatomical concepts*, Nucleic Acids Research 37: D782–D785. https://doi.org/10.1093/nar/gkn613
Dataset: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html

## Modello anatomico femminile
Kristen Browne e Heidi Schlehlein, Human Reference Atlas / HuBMAP, *3D Reference Organ Set for Female* v1.5 (2023), licenza [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). DOI: https://doi.org/10.48539/HBM352.BTSQ.586
Dataset: https://lod.humanatlas.io/ref-organ/united-female/v1.5

Per entrambi i modelli la geometria è quella semplificata e impacchettata dal progetto open source [human-atlas](https://github.com/ashemag/human-atlas) (MIT): coordinate in metri con asse Y verso l'alto, semplificazione meshoptimizer con errore relativo massimo 0,2%, normali quantizzate a 16 bit. Tutte le mesh di origine sono conservate.

Adattamenti di Corpus: nomi italiani, raggruppamenti in organi e regioni, riclassificazione di alcune strutture tra sistemi, colori, descrizioni.

## Genoma
- Annotazione dei geni: Ensembl release 110 (GRCh38), nella cache distribuita da [Ideogram.js](https://github.com/eweitz/ideogram) (CC0 1.0).
- Sinonimi: HGNC (https://www.genenames.org).
- Bande citogenetiche: NCBI GRCh38 (GCF_000001405.26), risoluzione 850 bande.
- Domini proteici: Pfam / InterPro.
- Espressione nei tessuti: GTEx Portal, mediane in TPM.

## Foto reali e al microscopio
Le immagini non sono incluse nel repository: vengono cercate al momento su [Wikimedia Commons](https://commons.wikimedia.org) e mostrate con autore e licenza indicati dalla pagina originale di ciascun file, a cui l'immagine rimanda.

## Librerie
[three.js](https://threejs.org) r169 (MIT), caricata da cdn.jsdelivr.net. Caratteri Bodoni Moda e IBM Plex da Google Fonts (SIL Open Font License).
