/* ✈️ Viaggi — la valigia da spuntare, un elenco per ogni viaggio. */
(function () {
  'use strict';
  var U = Sezione.U;
  var CAT = ['Documenti e soldi', 'Vestiti', 'Igiene', 'Farmaci', 'Elettronica', 'Bambini', 'Mare / montagna', 'Auto', 'Prima di partire', 'Altro'];
  var ICO = { 'Documenti e soldi': '🪪', 'Vestiti': '👕', 'Igiene': '🧴', 'Farmaci': '💊', 'Elettronica': '🔌', 'Bambini': '🧸', 'Mare / montagna': '🏖️', 'Auto': '🚗', 'Prima di partire': '🏠', 'Altro': '🎒' };
  var BASE = {
    'Documenti e soldi': ['Carte d\'identità / passaporti', 'Tessere sanitarie', 'Patente e libretto auto', 'Carte di pagamento e contanti', 'Prenotazioni e biglietti'],
    'Vestiti': ['Biancheria', 'Calzini', 'Pigiami', 'Magliette', 'Pantaloni', 'Felpa / maglione', 'Giacca', 'Scarpe comode', 'Ciabatte'],
    'Igiene': ['Spazzolini e dentifricio', 'Shampoo e bagnoschiuma', 'Deodorante', 'Pettine / spazzola', 'Rasoio', 'Crema solare'],
    'Farmaci': ['Antidolorifico / antifebbre', 'Cerotti e disinfettante', 'Farmaci abituali', 'Repellente zanzare'],
    'Elettronica': ['Caricabatterie telefoni', 'Power bank', 'Cuffie', 'Adattatore prese'],
    'Bambini': ['Giochi e libri', 'Merende per il viaggio', 'Tablet carico'],
    'Prima di partire': ['Chiudere gas e acqua', 'Staccare le prese', 'Svuotare il frigo', 'Buttare la spazzatura', 'Chiudere finestre e tapparelle', 'Piante: chi le annaffia?']
  };
  function giorniPartenza(c) { return c && c.dal ? U.giorniA(c.dal) : null; }
  function aggiungiBase(api, idViaggio) {
    var gia = {};
    api.tutte().forEach(function (r) { if (r.viaggio === idViaggio) gia[U.semplice(r.cosa)] = 1; });
    var n = 0;
    Object.keys(BASE).forEach(function (cat) {
      BASE[cat].forEach(function (cosa) {
        if (gia[U.semplice(cosa)]) return;
        n++; api.nuova({ cosa: cosa, categoria: cat, per: 'Tutti', preso: false, viaggio: idViaggio });
      });
    });
    return n;
  }

  Sezione.definisci('viaggi', {
    raccolta: 'valigia',
    nuovoTesto: 'Aggiungi alla valigia',
    contesto: {
      raccolta: 'viaggi', campo: 'viaggio', etichetta: 'Viaggio', nuovo: 'Nuovo viaggio', ordina: 'dal',
      vuoto: 'Nessun viaggio. Creane uno: preparo io la lista base della valigia, poi la adattate.',
      campi: [
        { k: 'titolo', etichetta: 'Dove andate', segnaposto: 'Es. Montagna a Natale' },
        { k: 'dal', etichetta: 'Partenza', tipo: 'data', mezzo: true },
        { k: 'al', etichetta: 'Ritorno', tipo: 'data', mezzo: true },
        { k: 'alloggio', etichetta: 'Alloggio / indirizzo' },
        { k: 'note', etichetta: 'Note (prenotazioni, orari, contatti)', tipo: 'area', righe: 3 }
      ],
      descr: function (c) {
        var d = giorniPartenza(c);
        return [c.dal ? 'dal ' + U.data(c.dal) : '', c.al ? 'al ' + U.data(c.al) : '', d !== null && d >= 0 ? '· si parte ' + U.traGiorni(d) : ''].filter(Boolean).join(' ');
      },
      dopoCreazione: function (c, api) { var n = aggiungiBase(api, c.id); api.avviso('Valigia base pronta: ' + n + ' voci. Togliete o aggiungete quello che serve.'); }
    },
    campi: [
      { k: 'cosa', etichetta: 'Cosa', obbligatorio: true },
      { k: 'categoria', etichetta: 'Categoria', tipo: 'scelta', mezzo: true, predefinito: 'Altro', opzioni: CAT.map(function (k) { return { valore: k, testo: ICO[k] + ' ' + k }; }) },
      { k: 'per', etichetta: 'Per chi', tipo: 'persona', conTutti: true, mezzo: true, predefinito: 'Tutti' },
      { k: 'quanti', etichetta: 'Quanti', mezzo: true },
      { k: 'note', etichetta: 'Note' }
    ],
    spunta: 'preso',
    ordina: function (a, b) { return CAT.indexOf(a.categoria) - CAT.indexOf(b.categoria) || (a.preso ? 1 : 0) - (b.preso ? 1 : 0) || String(a.cosa).localeCompare(String(b.cosa), 'it'); },
    gruppo: function (r) { return (ICO[r.categoria] || '🎒') + ' ' + (r.categoria || 'Altro'); },
    titoloVoce: function (r) { return (r.cosa || '') + (r.quanti ? ' × ' + r.quanti : ''); },
    sottoVoce: function (r) { return [r.per && r.per !== 'Tutti' ? '👤 ' + r.per : '', r.note].filter(Boolean).join(' · '); },
    filtri: function () {
      var f = [
        { id: 'manca', testo: 'Da mettere', f: function (r) { return !r.preso; } },
        { id: 'tutto', testo: 'Tutto', f: function () { return true; } }
      ];
      Fam.persone().forEach(function (p) { f.push({ id: 'p-' + p, testo: p, f: function (r) { return r.per === p || r.per === 'Tutti' || !r.per; } }); });
      return f;
    },
    rapida: { segnaposto: '🎒 Aggiungi alla valigia…', aggiungi: function (t, api) { api.nuova({ cosa: t, categoria: 'Altro', per: 'Tutti', preso: false }); } },
    riepilogo: function (righe, api) {
      var c = api.contesto(), presi = righe.filter(function (r) { return r.preso; }).length, d = giorniPartenza(c);
      return [
        { valore: presi + ' / ' + righe.length, etichetta: 'in valigia', ico: '🧳', barra: righe.length ? presi / righe.length : 0 },
        { valore: d === null ? '—' : d > 0 ? String(d) : d === 0 ? 'Oggi!' : '—', etichetta: d === null ? 'metti la data di partenza' : d > 0 ? 'giorni alla partenza' : d === 0 ? 'si parte' : 'viaggio passato', ico: '✈️' }
      ];
    },
    azioni: [
      { testo: '✨ Aggiungi la lista base', fai: function (api) { var c = api.contesto(); if (!c) return; api.avviso(aggiungiBase(api, c.id) + ' voci aggiunte'); } },
      { testo: '↩️ Togli tutte le spunte (per riusarla)', fai: function (api) {
        api.righe().forEach(function (r) { if (r.preso) api.R.imposta(r.id, { preso: false }, 'preso'); }); api.disegna();
      } },
      { testo: '📋 Copia da un altro viaggio', fai: function (api) {
        var h = Fam.h, c = api.contesto(), altri = api.C.tutte().filter(function (x) { return !x.eliminato && c && x.id !== c.id; });
        if (!altri.length) { api.avviso('Non ci sono altri viaggi'); return; }
        var sel = h('select', null, altri.map(function (x) { return h('option', { value: x.id, text: x.titolo }); }));
        Fam.dialogo('Copia la valigia da…', sel, [{ testo: 'Annulla' }, { testo: 'Copia', primario: true, azione: function () {
          var gia = {}; api.righe().forEach(function (r) { gia[U.semplice(r.cosa)] = 1; });
          var n = 0;
          api.R.tutte().filter(function (r) { return !r.eliminato && r.viaggio === sel.value && !gia[U.semplice(r.cosa)]; }).forEach(function (r) {
            n++; api.nuova({ cosa: r.cosa, categoria: r.categoria, per: r.per, quanti: r.quanti, note: r.note, preso: false });
          });
          api.avviso(n + ' voci copiate');
        } }]);
      } }
    ],
    vuoto: 'Valigia vuota.',
    novita: function (r) { return r.cosa; },
    home: function () {
      var V = Fam.raccolta('viaggi').tutte().filter(function (v) { return !v.eliminato && v.dal && U.giorniA(v.dal) >= 0; })
        .sort(function (a, b) { return String(a.dal).localeCompare(String(b.dal)); });
      return V.length ? V[0].titolo + ' ' + U.traGiorni(U.giorniA(V[0].dal)) : 'Nessun viaggio in vista';
    }
  });
})();
