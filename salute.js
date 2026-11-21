/* 🩺 Salute — visite, esami, vaccini, terapie di ognuno. */
(function () {
  'use strict';
  var U = Sezione.U;
  var ICO = { 'Visita': '🩺', 'Esami': '🧪', 'Vaccino': '💉', 'Farmaco / terapia': '💊', 'Dentista': '🦷', 'Pediatra': '🧸', 'Oculista': '👓', 'Certificato': '📄', 'Altro': '📌' };
  function g(r) { return U.giorniA(r.data); }

  Sezione.definisci('salute', {
    raccolta: 'salute',
    nuovoTesto: 'Nuovo appuntamento',
    campi: [
      { k: 'titolo', etichetta: 'Cosa', obbligatorio: true, segnaposto: 'Es. Esami del sangue, controllo denti' },
      { k: 'tipo', etichetta: 'Tipo', tipo: 'scelta', mezzo: true, predefinito: 'Visita', opzioni: Object.keys(ICO).map(function (k) { return { valore: k, testo: ICO[k] + ' ' + k }; }) },
      { k: 'per', etichetta: 'Per chi', tipo: 'persona', mezzo: true, obbligatorio: true },
      { k: 'data', etichetta: 'Giorno', tipo: 'data', mezzo: true, aiuto: 'Vuoto = ancora da prenotare.' },
      { k: 'ora', etichetta: 'Ora', tipo: 'ora', mezzo: true },
      { k: 'dove', etichetta: 'Medico / struttura', mezzo: true },
      { k: 'telefono', etichetta: 'Telefono', tipo: 'telefono', mezzo: true },
      { k: 'prossimo', etichetta: 'Prossimo controllo', tipo: 'data', mezzo: true, aiuto: 'Quando segni fatto, lo metto in agenda.' },
      { k: 'costo', etichetta: 'Costo / ticket', tipo: 'euro', mezzo: true },
      { k: 'esito', etichetta: 'Esito, cosa ha detto il medico, terapia', tipo: 'area', righe: 3 }
    ],
    spunta: 'fatto',
    ordina: function (a, b) {
      return (a.fatto ? 1 : 0) - (b.fatto ? 1 : 0) || (a.data ? 0 : 1) - (b.data ? 0 : 1) ||
        (a.fatto ? String(b.data || '').localeCompare(String(a.data || '')) : String(a.data || '').localeCompare(String(b.data || '')));
    },
    gruppo: function (r) {
      if (r.fatto) return '📁 Storico';
      if (!r.data) return '📞 Da prenotare';
      return g(r) < 0 ? '⚠️ Passati, da segnare' : '📅 In agenda';
    },
    titoloVoce: function (r) { return (ICO[r.tipo] || '🩺') + ' ' + (r.titolo || '') + (r.per ? ' — ' + r.per : ''); },
    sottoVoce: function (r) {
      return [r.data ? U.data(r.data, true) + (r.ora ? ' alle ' + r.ora : '') : '', r.dove, r.fatto && r.esito ? String(r.esito).slice(0, 90) : '', r.prossimo ? 'prossimo controllo: ' + U.data(r.prossimo) : ''].filter(Boolean).join(' · ');
    },
    badge: function (r) {
      if (r.fatto) return null;
      if (!r.data) return { testo: 'da prenotare', tipo: 'attenzione' };
      var d = g(r);
      if (d < 0) return { testo: U.traGiorni(d), tipo: 'urgente' };
      if (d <= 3) return { testo: U.traGiorni(d), tipo: 'attenzione' };
      return { testo: U.traGiorni(d), tipo: 'tenue' };
    },
    extraVoce: function (r) {
      return r.telefono && !r.fatto ? Fam.h('a', { class: 'azione-voce', href: 'tel:' + String(r.telefono).replace(/[^\d+]/g, ''), title: 'Chiama', text: '📞', onclick: function (e) { e.stopPropagation(); } }) : null;
    },
    dopoSpunta: function (r, v, api) {
      if (!v || !r.prossimo) return false;
      api.imposta(r.id, { fatto: true }, 'fatto');
      api.nuova({ titolo: r.titolo, tipo: r.tipo, per: r.per, dove: r.dove, telefono: r.telefono, data: r.prossimo });
      api.avviso('In agenda il prossimo controllo: ' + U.data(r.prossimo));
      return true;
    },
    filtri: function () {
      var f = [
        { id: 'aperti', testo: 'In agenda', f: function (r) { return !r.fatto; } },
        { id: 'prenotare', testo: 'Da prenotare', f: function (r) { return !r.fatto && !r.data; } }
      ];
      Fam.persone().forEach(function (p) { f.push({ id: 'p-' + p, testo: p, f: function (r) { return r.per === p; } }); });
      f.push({ id: 'storico', testo: 'Storico', f: function (r) { return !!r.fatto; } });
      return f;
    },
    riepilogo: function (righe) {
      var a = righe.filter(function (r) { return !r.fatto; });
      var pros = a.filter(function (r) { return r.data && g(r) >= 0; }).sort(function (x, y) { return String(x.data).localeCompare(String(y.data)); })[0];
      return [
        { valore: pros ? U.data(pros.data) : '—', etichetta: pros ? 'prossimo: ' + pros.titolo + (pros.per ? ' (' + pros.per + ')' : '') : 'nessun appuntamento', ico: '📅' },
        { valore: String(a.filter(function (r) { return !r.data; }).length), etichetta: 'da prenotare', ico: '📞' },
        { valore: U.euro(righe.filter(function (r) { return String(r.data || '').slice(0, 4) === String(new Date().getFullYear()); }).reduce(function (s, r) { return s + (r.costo || 0); }, 0)), etichetta: 'spesi quest\'anno (ticket, visite)', ico: '💶' }
      ];
    },
    vuoto: 'Nessun appuntamento. Segnate visite, esami e vaccini: nello storico resta l\'esito, utile alla visita successiva.',
    novita: function (r) { return r.titolo + (r.per ? ' (' + r.per + ')' : ''); },
    home: function (righe) {
      var a = righe.filter(function (r) { return !r.fatto && r.data && g(r) >= 0; }).sort(function (x, y) { return String(x.data).localeCompare(String(y.data)); });
      var dp = righe.filter(function (r) { return !r.fatto && !r.data; }).length;
      return a.length ? 'Prossimo: ' + a[0].titolo + ', ' + U.data(a[0].data) : dp ? dp + ' da prenotare' : 'Niente in agenda';
    }
  });
})();
