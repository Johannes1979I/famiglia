/* 📅 Scadenze — auto, casa, documenti, bollette, tasse. */
(function () {
  'use strict';
  var U = Sezione.U;
  var RICORRENZE = [
    { valore: '0', testo: 'Una volta sola' }, { valore: '1', testo: 'Ogni mese' }, { valore: '2', testo: 'Ogni 2 mesi' },
    { valore: '3', testo: 'Ogni 3 mesi' }, { valore: '6', testo: 'Ogni 6 mesi' }, { valore: '12', testo: 'Ogni anno' },
    { valore: '24', testo: 'Ogni 2 anni' }, { valore: '48', testo: 'Ogni 4 anni' }, { valore: '60', testo: 'Ogni 5 anni' },
    { valore: '120', testo: 'Ogni 10 anni' }
  ];
  var ICO = { Auto: '🚗', Casa: '🏠', Documenti: '🪪', Bollette: '💡', Tasse: '🧾', Salute: '🩺', Scuola: '🎒', Abbonamenti: '📺', Assicurazioni: '🛡️', Banca: '🏦', Altro: '📌' };
  function ric(r) { return Number(r.ricorrenza || 0); }
  function g(r) { return U.giorniA(r.data); }
  function preavviso(r) { return r.preavviso === null || r.preavviso === undefined ? 15 : r.preavviso; }
  var TIPICHE = [
    ['Bollo auto', 'Auto', 12], ['Assicurazione auto (RC)', 'Auto', 12], ['Revisione auto', 'Auto', 24], ['Tagliando auto', 'Auto', 12],
    ['Patente — rinnovo', 'Documenti', 120], ['Passaporto', 'Documenti', 120], ['Tessera sanitaria', 'Documenti', 72],
    ['IMU — acconto (16 giugno)', 'Tasse', 12], ['IMU — saldo (16 dicembre)', 'Tasse', 12], ['TARI', 'Tasse', 12], ['Dichiarazione dei redditi (730)', 'Tasse', 12],
    ['Assicurazione casa', 'Assicurazioni', 12], ['Bolletta luce', 'Bollette', 2], ['Bolletta gas', 'Bollette', 2], ['Bolletta acqua', 'Bollette', 3],
    ['Canone internet / telefono', 'Bollette', 1], ['Rata condominio', 'Casa', 3], ['Abbonamenti streaming', 'Abbonamenti', 1]
  ];

  Sezione.definisci('scadenze', {
    raccolta: 'scadenze',
    nuovoTesto: 'Nuova scadenza',
    campi: [
      { k: 'titolo', etichetta: 'Cosa scade', obbligatorio: true, segnaposto: 'Es. Bollo auto' },
      { k: 'categoria', etichetta: 'Categoria', tipo: 'scelta', mezzo: true, predefinito: 'Altro', opzioni: Object.keys(ICO).map(function (k) { return { valore: k, testo: ICO[k] + ' ' + k }; }) },
      { k: 'data', etichetta: 'Scade il', tipo: 'data', mezzo: true },
      { k: 'ricorrenza', etichetta: 'Si ripete', tipo: 'scelta', mezzo: true, predefinito: '12', opzioni: RICORRENZE, aiuto: 'Quando la segni fatta, la data va avanti da sola.' },
      { k: 'preavviso', etichetta: 'Avvisami prima (giorni)', tipo: 'numero', mezzo: true, predefinito: 15 },
      { k: 'importo', etichetta: 'Importo', tipo: 'euro', mezzo: true, segnaposto: '€' },
      { k: 'chi', etichetta: 'Chi se ne occupa', tipo: 'scelta', mezzo: true, opzioni: function () { return Fam.membri().concat(['Insieme']); } },
      { k: 'note', etichetta: 'Note', tipo: 'area', segnaposto: 'Targa, numero di polizza, dove si paga…' }
    ],
    spunta: 'fatto',
    ordina: function (a, b) {
      return (a.fatto ? 1 : 0) - (b.fatto ? 1 : 0) || (a.data ? 0 : 1) - (b.data ? 0 : 1) || String(a.data || '').localeCompare(String(b.data || ''));
    },
    gruppo: function (r) {
      if (r.fatto) return '✓ Fatte';
      var d = g(r);
      if (d === null) return 'Senza data';
      if (d < 0) return '⚠️ Scadute';
      if (d <= preavviso(r)) return '⏰ In arrivo';
      if (d <= 90) return 'Nei prossimi 3 mesi';
      return 'Più avanti';
    },
    titoloVoce: function (r) { return (ICO[r.categoria] || '📌') + ' ' + (r.titolo || ''); },
    sottoVoce: function (r) {
      var rr = RICORRENZE.filter(function (x) { return x.valore === String(r.ricorrenza || '0'); })[0];
      return [r.data ? U.data(r.data, true) : 'data da inserire', rr && rr.valore !== '0' ? rr.testo.toLowerCase() : '', typeof r.importo === 'number' ? U.euro(r.importo) : '', r.chi ? '👤 ' + r.chi : '', r.ultimaVolta ? 'ultima: ' + U.data(r.ultimaVolta) : ''].filter(Boolean).join(' · ');
    },
    badge: function (r) {
      if (r.fatto) return { testo: 'fatta', tipo: 'tenue' };
      var d = g(r);
      if (d === null) return { testo: 'senza data', tipo: 'attenzione' };
      if (d < 0) return { testo: 'scaduta ' + U.traGiorni(d), tipo: 'urgente' };
      if (d <= preavviso(r)) return { testo: U.traGiorni(d), tipo: 'attenzione' };
      return { testo: U.traGiorni(d), tipo: 'tenue' };
    },
    dopoSpunta: function (r, v, api) {
      if (!v || !ric(r) || !r.data) return false;
      var nuova = U.aggiungiMesi(r.data, ric(r));
      api.imposta(r.id, { data: nuova, ultimaVolta: U.oggiISO(), fatto: false }, 'fatto');
      api.avviso('✓ Fatto! La prossima è il ' + U.data(nuova));
      return true;
    },
    filtri: [
      { id: 'aperte', testo: 'Da fare', f: function (r) { return !r.fatto; } },
      { id: 'arrivo', testo: 'In arrivo', f: function (r) { var d = g(r); return !r.fatto && d !== null && d <= preavviso(r); } },
      { id: 'tutte', testo: 'Tutte', f: function () { return true; } },
      { id: 'fatte', testo: 'Fatte', f: function (r) { return !!r.fatto; } }
    ],
    riepilogo: function (righe) {
      var aperte = righe.filter(function (r) { return !r.fatto; });
      var scadute = aperte.filter(function (r) { var d = g(r); return d !== null && d < 0; }).length;
      var arrivo = aperte.filter(function (r) { var d = g(r); return d !== null && d >= 0 && d <= preavviso(r); }).length;
      var soldi = aperte.filter(function (r) { var d = g(r); return d !== null && d <= 30 && typeof r.importo === 'number'; })
        .reduce(function (s, r) { return s + r.importo; }, 0);
      return [
        { valore: String(scadute), etichetta: 'scadute', ico: '⚠️', cls: scadute ? 'urgente' : 'ok' },
        { valore: String(arrivo), etichetta: 'in arrivo', ico: '⏰', cls: arrivo ? 'attenzione' : '' },
        { valore: U.euro(soldi), etichetta: 'da pagare entro 30 giorni', ico: '💶' }
      ];
    },
    azioni: [
      { testo: '✨ Aggiungi le scadenze tipiche', fai: function (api) {
        var h = Fam.h, gia = {}, spunte = [];
        api.tutte().forEach(function (r) { gia[r.titolo] = 1; });
        var box = h('div', null, h('p', { class: 'tenue', text: 'Scegli quelle che vi riguardano: poi aprile una per una e mettete la data giusta.' }),
          Fam.persone().map(function (p) { return ['Carta d\'identità — ' + p, 'Documenti', 120]; }).concat(TIPICHE)
            .filter(function (t) { return !gia[t[0]]; }).map(function (t) {
            var c = h('input', { type: 'checkbox' }); spunte.push([c, t]);
            return h('label', { class: 'campo campo-spunta' }, c, h('span', { text: (ICO[t[1]] || '') + ' ' + t[0] }));
          }));
        Fam.dialogo('Scadenze tipiche', box, [{ testo: 'Annulla' }, { testo: 'Aggiungi', primario: true, azione: function () {
          var n = 0;
          spunte.forEach(function (x) { if (x[0].checked) { n++; api.nuova({ titolo: x[1][0], categoria: x[1][1], ricorrenza: String(x[1][2]), preavviso: 15 }); } });
          api.avviso(n + ' scadenze aggiunte: ora inserisci le date');
        } }]);
      } }
    ],
    vuoto: 'Nessuna scadenza. Da «Altro» puoi aggiungere quelle tipiche (bollo, revisione, documenti, tasse) in un colpo.',
    novita: function (r) { return r.titolo; },
    home: function (righe) {
      var aperte = righe.filter(function (r) { return !r.fatto; });
      var sc = aperte.filter(function (r) { var d = g(r); return d !== null && d < 0; }).length;
      var ar = aperte.filter(function (r) { var d = g(r); return d !== null && d >= 0 && d <= preavviso(r); });
      if (!sc && !ar.length) return righe.length ? 'Tutto in regola' : 'Da compilare';
      return [sc ? sc + ' scadute' : '', ar.length ? ar.length + ' in arrivo' : ''].filter(Boolean).join(' · ');
    }
  });
})();
