/* 🔧 Casa e manutenzioni — caldaia, condizionatori, auto, elettrodomestici. */
(function () {
  'use strict';
  var U = Sezione.U;
  var ICO = { 'Caldaia': '🔥', 'Condizionatori': '❄️', 'Auto': '🚗', 'Elettrodomestici': '🧺', 'Impianto elettrico': '⚡', 'Idraulica': '🚰',
    'Tetto e grondaie': '🏠', 'Giardino': '🌿', 'Piscina': '🏊', 'Sicurezza': '🧯', 'Pulizie': '🧽', 'Altro': '🔧' };
  function prossima(r) {
    if (r.prossimaManuale) return r.prossimaManuale;
    if (!r.ultima || !r.ogniMesi) return null;
    return U.aggiungiMesi(r.ultima, Math.round(r.ogniMesi));
  }
  function g(r) { return U.giorniA(prossima(r)); }
  var TIPICHE = [
    ['Caldaia — controllo e analisi fumi', 'Caldaia', 12], ['Condizionatori — pulizia filtri', 'Condizionatori', 12],
    ['Tagliando auto', 'Auto', 12], ['Cambio gomme estive/invernali', 'Auto', 6], ['Lavatrice — lavaggio a vuoto e anticalcare', 'Elettrodomestici', 2],
    ['Lavastoviglie — pulizia filtro', 'Elettrodomestici', 1], ['Cappa — filtri', 'Elettrodomestici', 6], ['Frigorifero — sbrinare e pulire', 'Elettrodomestici', 6],
    ['Grondaie — pulizia', 'Tetto e grondaie', 12], ['Rilevatori di fumo/gas — batterie', 'Sicurezza', 12], ['Estintore — revisione', 'Sicurezza', 6],
    ['Salvavita — prova del pulsante', 'Impianto elettrico', 6], ['Addolcitore / filtri acqua', 'Idraulica', 6], ['Zanzariere — montare/smontare', 'Altro', 6]
  ];

  Sezione.definisci('casa', {
    raccolta: 'casa',
    nuovoTesto: 'Nuova manutenzione',
    campi: [
      { k: 'cosa', etichetta: 'Cosa', obbligatorio: true, segnaposto: 'Es. Caldaia — controllo annuale' },
      { k: 'area', etichetta: 'Dove / oggetto', tipo: 'scelta', mezzo: true, predefinito: 'Altro', opzioni: Object.keys(ICO).map(function (k) { return { valore: k, testo: ICO[k] + ' ' + k }; }) },
      { k: 'ogniMesi', etichetta: 'Ogni quanti mesi', tipo: 'numero', mezzo: true, predefinito: 12 },
      { k: 'ultima', etichetta: 'Ultima volta', tipo: 'data', mezzo: true },
      { k: 'prossimaManuale', etichetta: 'Prossima (se diversa dal calcolo)', tipo: 'data', mezzo: true, aiuto: 'Lascia vuoto: la calcolo dall\'ultima volta.' },
      { k: 'ditta', etichetta: 'Chi la fa', mezzo: true, segnaposto: 'Ditta o tecnico' },
      { k: 'telefono', etichetta: 'Telefono', tipo: 'telefono', mezzo: true },
      { k: 'costo', etichetta: 'Costo indicativo', tipo: 'euro', mezzo: true },
      { k: 'note', etichetta: 'Note e storico', tipo: 'area', righe: 3, segnaposto: 'Modello, codice, cosa è stato fatto' }
    ],
    ordina: function (a, b) {
      var x = g(a), y = g(b);
      return (x === null ? 1e5 : x) - (y === null ? 1e5 : y) || String(a.cosa).localeCompare(String(b.cosa), 'it');
    },
    gruppo: function (r) {
      var d = g(r);
      if (d === null) return 'Da programmare';
      if (d < 0) return '⚠️ In ritardo';
      if (d <= 30) return '⏰ Entro un mese';
      return 'Più avanti';
    },
    titoloVoce: function (r) { return (ICO[r.area] || '🔧') + ' ' + (r.cosa || ''); },
    sottoVoce: function (r) {
      var p = prossima(r);
      return [p ? 'prossima: ' + U.data(p) : 'manca l\'ultima data', r.ultima ? 'ultima: ' + U.data(r.ultima) : '', r.ogniMesi ? 'ogni ' + r.ogniMesi + ' mesi' : '', r.ditta].filter(Boolean).join(' · ');
    },
    badge: function (r) {
      var d = g(r);
      if (d === null) return { testo: 'da programmare', tipo: 'attenzione' };
      if (d < 0) return { testo: 'in ritardo', tipo: 'urgente' };
      if (d <= 30) return { testo: U.traGiorni(d), tipo: 'attenzione' };
      return { testo: U.traGiorni(d), tipo: 'tenue' };
    },
    extraVoce: function (r, api) {
      var h = Fam.h;
      return h('span', { style: 'display:flex;gap:6px' },
        r.telefono ? h('a', { class: 'azione-voce', href: 'tel:' + String(r.telefono).replace(/[^\d+]/g, ''), title: 'Chiama', text: '📞', onclick: function (e) { e.stopPropagation(); } }) : null,
        h('button', { type: 'button', class: 'azione-voce', title: 'Segna fatta oggi', text: '✓ Fatta oggi', onclick: function (e) {
          e.stopPropagation();
          var nota = U.data(U.oggiISO()) + ' — fatta' + (Fam.io() ? ' (' + Fam.io() + ')' : '');
          api.imposta(r.id, { ultima: U.oggiISO(), prossimaManuale: null, note: (r.note ? r.note + '\n' : '') + nota }, 'ultima');
          api.avviso('Segnata. Prossima: ' + (prossima(api.R.prendi(r.id)) ? U.data(prossima(api.R.prendi(r.id))) : 'da programmare'));
        } }));
    },
    filtri: [
      { id: 'tutte', testo: 'Tutte', f: function () { return true; } },
      { id: 'presto', testo: 'Entro un mese', f: function (r) { var d = g(r); return d !== null && d <= 30; } },
      { id: 'ritardo', testo: 'In ritardo', f: function (r) { var d = g(r); return d !== null && d < 0; } }
    ],
    riepilogo: function (righe) {
      var rit = righe.filter(function (r) { var d = g(r); return d !== null && d < 0; }).length;
      var mese = righe.filter(function (r) { var d = g(r); return d !== null && d >= 0 && d <= 30; }).length;
      return [
        { valore: String(rit), etichetta: 'in ritardo', ico: '⚠️', cls: rit ? 'urgente' : 'ok' },
        { valore: String(mese), etichetta: 'entro un mese', ico: '⏰', cls: mese ? 'attenzione' : '' },
        { valore: String(righe.length), etichetta: 'manutenzioni seguite', ico: '🔧' }
      ];
    },
    azioni: [
      { testo: '✨ Aggiungi le manutenzioni tipiche', fai: function (api) {
        var h = Fam.h, gia = {}, spunte = [];
        api.tutte().forEach(function (r) { gia[r.cosa] = 1; });
        var box = h('div', null, h('p', { class: 'tenue', text: 'Scegli quelle che vi servono, poi segna per ognuna l\'ultima volta che è stata fatta.' }),
          TIPICHE.filter(function (t) { return !gia[t[0]]; }).map(function (t) {
            var c = h('input', { type: 'checkbox' }); spunte.push([c, t]);
            return h('label', { class: 'campo campo-spunta' }, c, h('span', { text: (ICO[t[1]] || '') + ' ' + t[0] + ' (ogni ' + t[2] + ' mesi)' }));
          }));
        Fam.dialogo('Manutenzioni tipiche', box, [{ testo: 'Annulla' }, { testo: 'Aggiungi', primario: true, azione: function () {
          var n = 0;
          spunte.forEach(function (x) { if (x[0].checked) { n++; api.nuova({ cosa: x[1][0], area: x[1][1], ogniMesi: x[1][2] }); } });
          api.avviso(n + ' aggiunte');
        } }]);
      } },
      { testo: '📇 Numeri utili', fai: function () { location.href = 'numeri.html' + location.search + '#k=' + Fam.chiave; } }
    ],
    vuoto: 'Nessuna manutenzione. Da «Altro» aggiungi quelle tipiche (caldaia, condizionatori, auto…) e segna l\'ultima volta.',
    novita: function (r) { return r.cosa; },
    home: function (righe) {
      var rit = righe.filter(function (r) { var d = g(r); return d !== null && d < 0; }).length;
      var mese = righe.filter(function (r) { var d = g(r); return d !== null && d >= 0 && d <= 30; }).length;
      if (!righe.length) return 'Da compilare';
      return rit || mese ? [rit ? rit + ' in ritardo' : '', mese ? mese + ' entro un mese' : ''].filter(Boolean).join(' · ') : 'Tutto in ordine';
    }
  });
})();
