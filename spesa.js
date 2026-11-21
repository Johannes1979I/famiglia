/* 🛒 Spesa — lista condivisa da spuntare al supermercato. */
(function () {
  'use strict';
  var U = Sezione.U;
  function testoLista(righe) {
    var gruppi = {};
    righe.forEach(function (r) { (gruppi[r.reparto || 'Altro'] = gruppi[r.reparto || 'Altro'] || []).push(r); });
    return Object.keys(gruppi).sort(function (a, b) { return Reparti.indice(a) - Reparti.indice(b); }).map(function (g) {
      return Reparti.icona(g) + ' ' + g + '\n' + gruppi[g].map(function (r) {
        return '- ' + r.cosa + (r.quanto ? ' (' + r.quanto + ')' : '') + (r.urgente ? ' ‼️' : '');
      }).join('\n');
    }).join('\n\n');
  }

  Sezione.definisci('spesa', {
    raccolta: 'spesa',
    nuovoTesto: 'Nuova voce',
    campi: [
      { k: 'cosa', etichetta: 'Cosa', obbligatorio: true, segnaposto: 'Es. latte' },
      { k: 'quanto', etichetta: 'Quanto', segnaposto: 'Es. 2, 1 kg', mezzo: true },
      { k: 'reparto', etichetta: 'Reparto', tipo: 'scelta', mezzo: true, opzioni: Reparti.elenco.map(function (r) { return { valore: r.nome, testo: r.ico + ' ' + r.nome }; }) },
      { k: 'negozio', etichetta: 'Dove', tipo: 'scelta', libera: true, mezzo: true, segnaposto: 'Supermercato', opzioni: ['Supermercato', 'Mercato', 'Farmacia', 'Macelleria', 'Panificio', 'Online', 'Ferramenta'] },
      { k: 'urgente', etichetta: 'Urgente', tipo: 'spunta' },
      { k: 'note', etichetta: 'Note', segnaposto: 'Marca, alternativa se manca…' }
    ],
    spunta: 'preso',
    nascondi: function (r) { return !!r.archiviato; },
    ordina: function (a, b) {
      return (a.preso ? 1 : 0) - (b.preso ? 1 : 0) || Reparti.indice(a.reparto) - Reparti.indice(b.reparto) ||
        (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0) || String(a.cosa).localeCompare(String(b.cosa), 'it');
    },
    gruppo: function (r) { return r.preso ? '✓ Già presi' : Reparti.icona(r.reparto) + ' ' + (r.reparto || 'Altro'); },
    titoloVoce: function (r) { return (r.cosa || '') + (r.quanto ? ' · ' + r.quanto : ''); },
    sottoVoce: function (r) { return [r.negozio && r.negozio !== 'Supermercato' ? '📍 ' + r.negozio : '', r.note || '', r.preso && r.presoDa ? 'preso da ' + r.presoDa : ''].filter(Boolean).join(' · '); },
    badge: function (r) { return r.urgente && !r.preso ? { testo: 'urgente', tipo: 'urgente' } : null; },
    novita: function (r) { return r.cosa; },
    filtri: [
      { id: 'dafare', testo: 'Da prendere', f: function (r) { return !r.preso; } },
      { id: 'tutto', testo: 'Tutto', f: function () { return true; } },
      { id: 'urgenti', testo: 'Urgenti', f: function (r) { return r.urgente && !r.preso; } },
      { id: 'presi', testo: 'Presi', f: function (r) { return !!r.preso; } }
    ],
    riepilogo: function (righe) {
      var da = righe.filter(function (r) { return !r.preso; }), presi = righe.length - da.length;
      return [
        { valore: String(da.length), etichetta: 'da prendere', ico: '🛒' },
        { valore: String(da.filter(function (r) { return r.urgente; }).length), etichetta: 'urgenti', ico: '‼️', cls: da.some(function (r) { return r.urgente; }) ? 'urgente' : '' },
        { valore: presi + ' / ' + righe.length, etichetta: 'già nel carrello', ico: '✅', barra: righe.length ? presi / righe.length : 0 }
      ];
    },
    rapida: {
      segnaposto: 'Cosa manca? (es. 2 latte, pane)',
      suggerimenti: function (api) {
        return api.R.tutte().filter(function (r) { return r.cosa; })
          .sort(function (a, b) { return (b.usi || 1) - (a.usi || 1); }).map(function (r) { return r.cosa; });
      },
      aggiungi: function (testo, api) {
        testo.split(/\s*[,;\n]\s*/).filter(Boolean).forEach(function (t) {
          var esito = Reparti.aggiungi(api.R, t);
          if (esito && esito.gia) api.avviso(esito.riga.cosa + ' era già in lista');
        });
        api.disegna();
      }
    },
    dopoSpunta: function (r, v, api) {
      api.imposta(r.id, v ? { preso: true, presoDa: Fam.io(), presoIl: new Date().toISOString() } : { preso: false }, 'preso');
      return true;
    },
    azioni: [
      { testo: '🧹 Togli dalla lista i già presi', fai: function (api) {
        var presi = api.righe().filter(function (r) { return r.preso; });
        presi.forEach(function (r) { api.R.imposta(r.id, { archiviato: true }, 'archiviato'); });
        api.disegna();
        api.avviso(presi.length ? presi.length + ' voci tolte: restano fra i suggerimenti' : 'Nessuna voce presa da togliere');
      } },
      { testo: '📋 Copia la lista (per WhatsApp)', fai: function (api) {
        var t = '🛒 Spesa\n\n' + testoLista(api.righe().filter(function (r) { return !r.preso; }));
        (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { api.avviso('Lista copiata'); }, function () { api.avviso('Copia non riuscita', { tipo: 'ko' }); });
      } }
    ],
    vuoto: 'Lista vuota: scrivi qui sopra cosa manca. Separando con la virgola ne aggiungi tante insieme.',
    home: function (righe) {
      var da = righe.filter(function (r) { return !r.preso; }), urg = da.filter(function (r) { return r.urgente; }).length;
      return da.length ? da.length + ' da prendere' + (urg ? ' · ' + urg + ' urgenti' : '') : 'Lista vuota';
    }
  });
})();
