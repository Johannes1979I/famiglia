/* 🎒 Scuola e attività dei figli — compiti, verifiche, colloqui, sport. */
(function () {
  'use strict';
  var U = Sezione.U;
  var ICO = { 'Compito': '📝', 'Verifica / interrogazione': '📚', 'Colloquio': '👩‍🏫', 'Riunione': '🗣️', 'Gita': '🚌', 'Attività / sport': '⚽',
    'Festa': '🎈', 'Pagamento': '💶', 'Da portare': '🎒', 'Altro': '📌' };
  function g(r) { return U.giorniA(r.data); }
  function figli() { var m = Fam.membri(); return Fam.persone().filter(function (p) { return m.indexOf(p) < 0; }); }

  Sezione.definisci('scuola', {
    raccolta: 'scuola',
    nuovoTesto: 'Nuovo impegno',
    campi: [
      { k: 'titolo', etichetta: 'Cosa', obbligatorio: true, segnaposto: 'Es. Verifica di matematica, piscina' },
      { k: 'tipo', etichetta: 'Tipo', tipo: 'scelta', mezzo: true, predefinito: 'Compito', opzioni: Object.keys(ICO).map(function (k) { return { valore: k, testo: ICO[k] + ' ' + k }; }) },
      { k: 'per', etichetta: 'Per', tipo: 'persona', mezzo: true, predefinito: function () { return figli()[0] || ''; } },
      { k: 'data', etichetta: 'Giorno', tipo: 'data', mezzo: true, predefinito: function () { return U.aggiungiGiorni(U.oggiISO(), 1); } },
      { k: 'ora', etichetta: 'Ora', tipo: 'ora', mezzo: true },
      { k: 'luogo', etichetta: 'Dove / materia', mezzo: true },
      { k: 'accompagna', etichetta: 'Chi accompagna / va', tipo: 'scelta', mezzo: true, opzioni: function () { return Fam.membri().concat(['Insieme', 'Nonni']); } },
      { k: 'portare', etichetta: 'Da portare o preparare', segnaposto: 'Es. tuta, firma sul diario, 5 € per la gita' },
      { k: 'note', etichetta: 'Note', tipo: 'area', righe: 2 }
    ],
    spunta: 'fatto',
    ordina: function (a, b) {
      return (a.fatto ? 1 : 0) - (b.fatto ? 1 : 0) || (a.data ? 0 : 1) - (b.data ? 0 : 1) ||
        String(a.data || '').localeCompare(String(b.data || '')) || String(a.ora || '').localeCompare(String(b.ora || ''));
    },
    gruppo: function (r) {
      if (r.fatto) return '✓ Fatti';
      var d = g(r);
      if (d === null) return 'Senza data';
      if (d < 0) return '⚠️ Passati, da segnare';
      if (d === 0) return '📍 Oggi';
      if (d === 1) return '➡️ Domani';
      if (d <= 7) return 'Questa settimana';
      return 'Più avanti';
    },
    titoloVoce: function (r) { return (ICO[r.tipo] || '📌') + ' ' + (r.titolo || ''); },
    sottoVoce: function (r) {
      return [r.data ? U.data(r.data, true) + (r.ora ? ' alle ' + r.ora : '') : '', r.per ? '👤 ' + r.per : '', r.luogo, r.accompagna ? '🚗 ' + r.accompagna : '', r.portare ? '🎒 ' + r.portare : ''].filter(Boolean).join(' · ');
    },
    badge: function (r) {
      if (r.fatto) return null;
      var d = g(r); if (d === null) return null;
      if (d < 0) return { testo: U.traGiorni(d), tipo: 'urgente' };
      if (d <= 1) return { testo: U.traGiorni(d), tipo: 'attenzione' };
      return { testo: U.traGiorni(d), tipo: 'tenue' };
    },
    filtri: function () {
      var f = [
        { id: 'dafare', testo: 'Da fare', f: function (r) { return !r.fatto; } },
        { id: 'settimana', testo: 'Questa settimana', f: function (r) { var d = g(r); return !r.fatto && d !== null && d <= 7; } },
        { id: 'verifiche', testo: 'Verifiche', f: function (r) { return !r.fatto && r.tipo === 'Verifica / interrogazione'; } }
      ];
      figli().forEach(function (p) { f.push({ id: 'p-' + p, testo: p, f: function (r) { return r.per === p && !r.fatto; } }); });
      f.push({ id: 'tutti', testo: 'Tutti', f: function () { return true; } });
      return f;
    },
    riepilogo: function (righe) {
      var a = righe.filter(function (r) { return !r.fatto; });
      var n = function (fn) { return a.filter(fn).length; };
      return [
        { valore: String(n(function (r) { return g(r) === 0; })), etichetta: 'oggi', ico: '📍' },
        { valore: String(n(function (r) { return g(r) === 1; })), etichetta: 'domani', ico: '➡️' },
        { valore: String(n(function (r) { var d = g(r); return r.tipo === 'Verifica / interrogazione' && d !== null && d >= 0 && d <= 7; })), etichetta: 'verifiche in settimana', ico: '📚' }
      ];
    },
    vuoto: 'Nessun impegno. Segnate compiti, verifiche, colloqui, sport e cosa portare: lo vedete tutti e due.',
    novita: function (r) { return r.titolo; },
    home: function (righe) {
      var a = righe.filter(function (r) { return !r.fatto && g(r) !== null && g(r) >= 0; }).sort(function (x, y) { return String(x.data).localeCompare(String(y.data)); });
      if (!a.length) return 'Niente in programma';
      return (g(a[0]) <= 1 ? U.traGiorni(g(a[0])).replace(/^./, function (c) { return c.toUpperCase(); }) + ': ' : U.data(a[0].data) + ': ') + a[0].titolo;
    }
  });
})();
