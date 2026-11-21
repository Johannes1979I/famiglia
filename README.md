# Famiglia

Piccola webapp di casa, condivisa fra marito e moglie: ognuno la apre dal
proprio telefono o computer e vede subito quello che l'altro ha salvato.

Prima sezione: **🎄 Regali** — una riga per persona con *Fatto*, *Proposte / idee*,
*Regalo scelto*, *Da fare*, *Budget*, *Speso*, *A cura di*, *Incartato*,
più link, note e «nascondi a» nei dettagli (⋯). Liste separate per ogni
occasione (Natale 2026, Natale 2027, compleanni…), cestino, ultime modifiche,
stampa e file per Excel.

## Come funziona

- Sito statico su GitHub Pages: HTML, CSS e JavaScript, nessuna libreria esterna.
- I dati stanno su **Firestore** (progetto `residence-holiday-ef6e9`, collezione
  `famiglia`), scritti via REST da `famiglia.js`.
- **Nessuna password**: si entra con un link che contiene una chiave casuale
  lunga (`#k=…`). La chiave sta dopo il `#`, quindi non arriva mai al server di
  GitHub, e non è scritta in questo repository. Chi non ha il link non vede
  niente e l'elenco delle famiglie non è leggibile.
- Ogni modifica si salva subito sul dispositivo e parte verso il cloud dopo un
  attimo, **solo con i campi toccati**: se uno scrive le idee e l'altra spunta
  «fatto» sulla stessa riga, non si sovrascrivono. Senza rete le modifiche
  aspettano e partono da sole.
- Gli aggiornamenti dell'altra persona arrivano ogni 15 secondi (e appena si
  torna sull'app), con un avviso «✎ … ha aggiornato …».

## Regola Firestore da aggiungere

Nella console Firebase → Firestore → **Regole**, dentro
`match /databases/{database}/documents { … }`, **aggiungere** (non sostituire:
festa, Certamen e assemblee usano le altre) e premere **Pubblica**:

```
    // ===================== FAMIGLIA (app di casa) =====================
    // Nessun login: entra solo chi conosce la chiave lunga del link d'invito.
    // L'elenco delle famiglie non si può leggere (niente «list» qui).
    match /famiglia/{chiave} {
      allow get, create, update: if chiave.size() >= 32;
      match /{sotto=**} {
        allow read, write: if chiave.size() >= 32;
      }
    }
```

## Prove

`regali.html?prova=1&io=Nome` usa un server finto nel browser (niente cloud).
Due schede con `io=` diversi si comportano come due telefoni.

## Struttura

| File | Cosa fa |
|---|---|
| `famiglia.js` | chiave, «chi sei», sincronizzazione con Firestore, finestre, invito |
| `stile.css` | tema «casa» (blu petrolio e terracotta) |
| `index.html` | home a riquadri |
| `regali.html` + `regali.js` | sezione regali, con tema natalizio per le liste di Natale |
| `qr.js` | codice QR per l'invito |
