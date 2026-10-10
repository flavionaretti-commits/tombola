# TOMBOLA!

Una PWA gratuita, senza pubblicità, progettata per monitor e proiettori orizzontali. A sinistra l'urna animata con manovella, a destra il tabellone completo dei numeri 1–90.

## Funzioni

- Estrazione imparziale e senza ripetizioni fra i numeri ancora disponibili (usa `crypto.getRandomValues`, se disponibile).
- Animazione della manovella, palline che si mescolano, uscita della pallina estratta, evidenziazione del numero sul tabellone.
- Effetti sonori sintetizzati sul dispositivo con Web Audio: non richiedono rete e sono disattivabili.
- Ultimo numero in grande, contatore delle estrazioni, cronologia degli ultimi sette numeri.
- Annullamento dell'ultima estrazione e azzeramento completo con conferma.
- Salvataggio automatico dei numeri estratti in `localStorage` (sullo stesso browser/dispositivo).
- Modalità giorno/notte e visualizzazione a schermo intero dove supportata.
- PWA installabile e funzionamento offline dopo il primo caricamento da GitHub Pages.

## Tastiera

`Spazio` o `E` = estrai; `Z` = annulla ultima; `F` = schermo intero; `M` = suoni on/off.

## Pubblicazione con GitHub Pages

Carica **tutti i file** nella radice di una repository pubblica `tombola`, poi in **Settings → Pages** seleziona **Deploy from a branch**, branch `main`, cartella `/ (root)`. L'indirizzo sarà `https://<utente>.github.io/tombola/`.

Non sono richiesti account, backend, dipendenze JavaScript né immagini esterne. Il font usa Outfit/DM Sans quando la rete lo permette, altrimenti il font di sistema.

## Crediti

Ideazione e direzione didattica: Flavio Naretti. Realizzazione della PWA: in collaborazione con ChatGPT.
## Lingue / Languages

Interfaccia, istruzioni e messaggi disponibili in italiano e inglese. Il pulsante con bandierina tonda (come in STORYDICE!) indica la lingua alternativa e la preferenza viene salvata localmente.
