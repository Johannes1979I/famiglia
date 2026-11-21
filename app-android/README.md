# Famiglia — app Android

Finestra a tutto schermo sulla webapp <https://johannes1979i.github.io/famiglia/>:
le sezioni e i dati sono quelli del sito, quindi **l'app non va ricompilata
quando la webapp cambia**. I link esterni (proposte dei regali, WhatsApp,
Telegram, telefono, email, mappe) si aprono nell'app giusta del telefono.

La chiave della famiglia non è nel codice: si passa alla compilazione.

```
flutter build apk --release --dart-define=CHIAVE=<chiave del link>
```

Si compila sul PC del laboratorio (`C:\Users\Zarletti\Desktop\famiglia-app`,
Flutter in `C:\src\flutter\flutter\bin`): la sua chiave di debug è fissa, così
gli aggiornamenti si installano sopra senza disinstallare.
Impronta SHA-256 del certificato: `C0:FC:94:CD:…:74:11:12`.

Nella app non funzionano stampa e «Scarica per Excel» (limiti della WebView):
per quelle si usa il sito dal browser.
