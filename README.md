# Famiglia

Piccola webapp di casa, condivisa fra marito e moglie: ognuno la apre dal
proprio telefono o computer e vede subito quello che l'altro ha salvato.

Sezioni (una pagina ciascuna, dalla home a riquadri):

| Pagina | Cosa fa |
|---|---|
| 🎄 `regali.html` | liste regali per Natale e ogni occasione; tema natalizio per le liste di Natale; i link scritti nelle proposte diventano pulsanti |
| 🛒 `spesa.html` | lista della spesa per reparti, aggiunta multipla («2 latte, pane»), suggerimenti di quello che comprate più spesso |
| 🍝 `menu.html` | pranzi e cene della settimana; gli ingredienti vanno alla spesa con un tocco |
| 📅 `scadenze.html` | auto, documenti, bollette, tasse; quelle che si ripetono vanno avanti da sole |
| 🎂 `compleanni.html` | compleanni e anniversari; il pulsante 🎁 apre la lista regali dell'occasione |
| 💶 `spese.html` | spese di famiglia, resoconto per categoria e conguaglio fra i due |
| 🎒 `scuola.html` | compiti, verifiche, colloqui, sport e cosa portare |
| 🩺 `salute.html` | visite, esami, vaccini; il prossimo controllo va in agenda da solo |
| 🔧 `casa.html` · 📇 `numeri.html` | manutenzioni periodiche; numeri utili da chiamare con un tocco |
| ✈️ `viaggi.html` | la valigia da spuntare per ogni viaggio, con lista base già pronta |
| 🔔 `avvisi.html` | promemoria quotidiano su Telegram (GitHub Actions, `.github/avvisi.mjs`) |

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
- Per non consumare la quota gratuita di Firestore, il documento `famiglia/<chiave>`
  tiene l'ora dell'ultima scrittura di ogni raccolta (`v_spesa`, `v_regali`…):
  ogni 20 secondi si legge solo lui, e una raccolta si rilegge intera solo se è cambiata.
- Gli aggiornamenti dell'altra persona arrivano entro 20 secondi (e appena si
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
| `sezione.js` | motore comune delle sezioni a elenco: ogni `<sezione>.js` è solo una configurazione |
| `reparti.js` | reparti del supermercato e aggiunta alla spesa (usato da Spesa e Menù) |
| `.github/avvisi.mjs` | il giro orario degli avvisi Telegram; prova a secco: `FAM_CHIAVE=… SOLO_TESTO=1 node .github/avvisi.mjs` |
| `stile.css` | tema «casa» (blu petrolio e terracotta) |
| `index.html` | home a riquadri |
| `regali.html` + `regali.js` | sezione regali, con tema natalizio per le liste di Natale |
| `qr.js` | codice QR per l'invito |

## Avvisi su Telegram

Servono due segreti nel repository (Settings → Secrets → Actions):
`FAM_CHIAVE` (la chiave del link) e `TELEGRAM_TOKEN` (il token del bot, da
@BotFather). Il nome utente del bot va nel campo `bot` del documento
`famiglia/<chiave>/impostazioni/avvisi`. Il token non va mai scritto nel sito:
il sito è pubblico.
