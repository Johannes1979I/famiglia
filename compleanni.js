/* 🎂 Compleanni e ricorrenze — con il pulsante che apre la lista regali. */
(function () {
  'use strict';
  var U = Sezione.U;
  var ICO = { Compleanno: '🎂', Onomastico: '🌸', Anniversario: '💍', Ricorrenza: '⭐' };

  /* prossima volta che cade la data (oggi compreso) */
  function prossima(r) {
    if (!r.data) return null;
    var d = U.aData(r.data), o = new Date(); o.setHours(0, 0, 0, 0);
    function il(anno) {
      var m = d.getMonth(), g = d.getDate();
      var ultimo = new Date(anno, m + 1, 0).getDate();
      return new Date(anno, m, Math.min(g, ultimo));
    }
    var p = il(o.getFullYear());
    if (p < o) p = il(o.getFullYear() + 1);
    return p;
  }
  function giorni(r) { var p = prossima(r); if (!p) return null; var o = new Date(); o.setHours(0, 0, 0, 0); return Math.round((p - o) / 864e5); }
  function anni(r) {
    var p = prossima(r); if (!p || r.annoIgnoto || !r.data) return null;
    var n = p.getFullYear() - U.aData(r.data).getFullYear();
    return n > 0 ? n : null;
  }
  function preavviso(r) { return r.preavviso === null || r.preavviso === undefined ? 7 : r.preavviso; }
  function frase(r) {
    var n = anni(r);
    if (!n) return '';
    if (r.tipo === 'Anniversario') return n + '° anniversario';
    if (r.tipo === 'Compleanno' || !r.tipo) return 'compie ' + n + ' anni';
    return n + ' anni';
  }

  function apriListaRegali(r) {
    var L = Fam.raccolta('liste'), G = Fam.raccolta('regali');
    var p = prossima(r), titolo = (r.tipo === 'Compleanno' || !r.tipo ? 'Compleanno di ' : (r.tipo || '') + ' · ') + r.nome + ' ' + p.getFullYear();
    var esistente = L.tutte().filter(function (l) { return !l.eliminato && l.titolo === titolo; })[0];
    var id = esistente ? esistente.id : L.nuova({ titolo: titolo, data: U.daData(p) }).id;
    if (!esistente) G.nuova({ lista: id, nome: r.nome, ordine: 1, fatto: false, idee: r.idee || null });
    Fam.ls('fam_lista_' + Fam.chiave.slice(0, 10), id);
    Promise.all([L.sincronizza(), G.sincronizza()]).then(function () {
      location.href = 'regali.html' + location.search + '#k=' + Fam.chiave;
    });
  }

  Sezione.definisci('compleanni', {
    raccolta: 'compleanni',
    nuovoTesto: 'Nuova ricorrenza',
    campi: [
      { k: 'nome', etichetta: 'Chi (o cosa)', obbligatorio: true, segnaposto: 'Es. Mamma, nonna Anna, il nostro matrimonio' },
      { k: 'tipo', etichetta: 'Tipo', tipo: 'scelta', mezzo: true, predefinito: 'Compleanno', opzioni: Object.keys(ICO).map(function (k) { return { valore: k, testo: ICO[k] + ' ' + k }; }) },
      { k: 'data', etichetta: 'Data', tipo: 'data', mezzo: true, obbligatorio: true, aiuto: 'Se non sai l\'anno mettine uno qualsiasi e spunta qui sotto.' },
      { k: 'annoIgnoto', etichetta: 'Non conosco l\'anno (non calcolare gli anni)', tipo: 'spunta' },
      { k: 'preavviso', etichetta: 'Avvisami prima (giorni)', tipo: 'numero', mezzo: true, predefinito: 7 },
      { k: 'telefono', etichetta: 'Telefono per gli auguri', tipo: 'telefono', mezzo: true },
      { k: 'idee', etichetta: 'Idee regalo', tipo: 'area', righe: 2, segnaposto: 'Passano nella lista regali quando la crei' },
      { k: 'note', etichetta: 'Note', tipo: 'area', righe: 2 }
    ],
    ordina: function (a, b) { return (giorni(a) === null ? 999 : giorni(a)) - (giorni(b) === null ? 999 : giorni(b)); },
    gruppo: function (r) {
      var d = giorni(r);
      if (d === null) return 'Senza data';
      if (d <= 7) return '🎉 Questa settimana';
      if (d <= 31) return 'Entro un mese';
      if (d <= 92) return 'Nei prossimi 3 mesi';
      return 'Più avanti';
    },
    titoloVoce: function (r) { return (ICO[r.tipo] || '🎂') + ' ' + (r.nome || ''); },
    sottoVoce: function (r) {
      var p = prossima(r);
      return [p ? p.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) : '', frase(r)].filter(Boolean).join(' · ');
    },
    badge: function (r) {
      var d = giorni(r);
      if (d === null) return null;
      if (d === 0) return { testo: 'oggi! 🎉', tipo: 'urgente' };
      if (d <= preavviso(r)) return { testo: U.traGiorni(d), tipo: 'attenzione' };
      return { testo: U.traGiorni(d), tipo: 'tenue' };
    },
    extraVoce: function (r) {
      var h = Fam.h;
      return h('span', { style: 'display:flex;gap:6px' },
        r.telefono ? h('a', { class: 'azione-voce', href: 'https://wa.me/' + String(r.telefono).replace(/[^\d]/g, '').replace(/^(?!39)(3\d{8,9})$/, '39$1') + '?text=' + encodeURIComponent('Tanti auguri! 🎉'), target: '_blank', rel: 'noopener', title: 'Auguri su WhatsApp', text: '💬' }) : null,
        h('button', { type: 'button', class: 'azione-voce', title: 'Apri la lista regali per questa occasione', text: '🎁 Regalo', onclick: function (e) { e.stopPropagation(); apriListaRegali(r); } }));
    },
    filtri: [
      { id: 'tutti', testo: 'Tutti', f: function () { return true; } },
      { id: 'mese', testo: 'Entro un mese', f: function (r) { var d = giorni(r); return d !== null && d <= 31; } },
      { id: 'compleanni', testo: 'Compleanni', f: function (r) { return !r.tipo || r.tipo === 'Compleanno'; } },
      { id: 'altro', testo: 'Altre ricorrenze', f: function (r) { return r.tipo && r.tipo !== 'Compleanno'; } }
    ],
    riepilogo: function (righe) {
      var s = righe.slice().sort(function (a, b) { return (giorni(a) === null ? 999 : giorni(a)) - (giorni(b) === null ? 999 : giorni(b)); });
      var p = s[0];
      return [
        { valore: p ? p.nome : '—', etichetta: p ? 'il prossimo, ' + U.traGiorni(giorni(p)) : 'nessuna data', ico: '🎂' },
        { valore: String(righe.filter(function (r) { var d = giorni(r); return d !== null && d <= 31; }).length), etichetta: 'entro un mese', ico: '📆' },
        { valore: String(righe.length), etichetta: 'ricorrenze salvate', ico: '⭐' }
      ];
    },
    azioni: [
      { testo: '📥 Prendi i nomi dalla lista regali', fai: function (api) {
        var gia = {}; api.tutte().forEach(function (r) { gia[U.semplice(r.nome)] = 1; });
        var nomi = {}; Fam.raccolta('regali').tutte().forEach(function (r) { if (!r.eliminato && r.nome && !gia[U.semplice(r.nome)] && !/^fam\.?\s/i.test(r.nome)) nomi[r.nome] = 1; });
        var elenco = Object.keys(nomi);
        if (!elenco.length) { api.avviso('Nessun nome nuovo da prendere'); return; }
        api.avviso('Apri ogni nome e inserisci la data: ' + elenco.length + ' aggiunti');
        elenco.forEach(function (n) { api.nuova({ nome: n, tipo: 'Compleanno' }); });
      } }
    ],
    vuoto: 'Nessuna ricorrenza. Aggiungi compleanni, onomastici e anniversari: da «Altro» puoi partire dai nomi della lista regali.',
    novita: function (r) { return r.nome; },
    dopoAvvio: function () { Fam.raccolta('regali').sincronizza(); Fam.raccolta('liste').sincronizza(); },
    home: function (righe) {
      var s = righe.filter(function (r) { return giorni(r) !== null; }).sort(function (a, b) { return giorni(a) - giorni(b); });
      return s[0] ? s[0].nome + ' ' + U.traGiorni(giorni(s[0])) : 'Da compilare';
    }
  });
})();
