/* 💶 Spese familiari — chi ha pagato cosa, per categoria e per mese. */
(function () {
  'use strict';
  var U = Sezione.U;
  var CAT = { 'Spesa alimentare': '🛒', 'Casa e bollette': '🏠', 'Auto e trasporti': '🚗', 'Salute': '🩺', 'Scuola e figli': '🎒',
    'Vestiti': '👕', 'Svago e ristoranti': '🍕', 'Regali': '🎁', 'Viaggi': '✈️', 'Tasse': '🧾', 'Animali': '🐾', 'Altro': '📌' };
  function mese(iso) { return String(iso || '').slice(0, 7); }
  function meseOggi(delta) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + (delta || 0)); return d.getFullYear() + '-' + U.due(d.getMonth() + 1); }
  function nomeMese(m) { if (!m) return 'Senza data'; var p = m.split('-'); return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }); }
  function tot(righe) { return righe.reduce(function (s, r) { return s + (typeof r.importo === 'number' ? r.importo : 0); }, 0); }

  function resoconto(api) {
    var h = Fam.h, mesi = {};
    api.righe().forEach(function (r) { if (r.data) mesi[mese(r.data)] = 1; });
    var elenco = Object.keys(mesi).sort().reverse();
    if (!elenco.length) { api.avviso('Ancora nessuna spesa'); return; }
    var sel = h('select', { class: 'selettore-lista' }, elenco.map(function (m) { return h('option', { value: m, text: nomeMese(m) }); }));
    var box = h('div');
    function disegna() {
      Fam.svuota(box);
      var righe = api.righe().filter(function (r) { return mese(r.data) === sel.value; }), totale = tot(righe);
      box.appendChild(h('p', null, h('b', { text: 'Totale: ' + U.euro(totale) }), ' · ' + righe.length + ' spese'));
      var perCat = {};
      righe.forEach(function (r) { var c = r.categoria || 'Altro'; perCat[c] = (perCat[c] || 0) + (r.importo || 0); });
      Object.keys(perCat).sort(function (a, b) { return perCat[b] - perCat[a]; }).forEach(function (c) {
        box.appendChild(h('div', { style: 'margin:6px 0' },
          h('div', { style: 'display:flex;justify-content:space-between' }, h('span', { text: (CAT[c] || '📌') + ' ' + c }), h('b', { text: U.euro(perCat[c]) })),
          h('div', { class: 'barra' }, h('i', { style: 'width:' + Math.round(perCat[c] / (totale || 1) * 100) + '%' }))));
      });
      // chi ha pagato e conguaglio fra chi usa l'app (il conto comune non conta)
      var membri = Fam.membri(), pagato = {};
      membri.forEach(function (m) { pagato[m] = 0; });
      righe.forEach(function (r) { if (r.pagatoDa in pagato && !r.personale) pagato[r.pagatoDa] += r.importo || 0; });
      if (membri.length === 2) {
        var a = membri[0], b = membri[1], diff = (pagato[a] - pagato[b]) / 2;
        box.appendChild(h('h3', { style: 'margin:16px 0 4px;font-size:1rem', text: 'Chi ha pagato' }));
        box.appendChild(h('p', { text: a + ': ' + U.euro(pagato[a]) + ' · ' + b + ': ' + U.euro(pagato[b]) }));
        box.appendChild(h('p', { class: 'tenue', text: Math.abs(diff) < 1 ? 'Siete pari.' : 'Per fare a metà, ' + (diff > 0 ? b + ' deve ' + U.euro(diff) + ' a ' + a : a + ' deve ' + U.euro(-diff) + ' a ' + b) + ' (escluse le spese segnate «personali» e quelle dal conto comune).' }));
      }
    }
    sel.addEventListener('change', disegna);
    disegna();
    Fam.dialogo('Resoconto del mese', [sel, box], null, { largo: true });
  }
  function csv(api) {
    var cel = function (v) { return '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"'; };
    var righe = [['Data', 'Descrizione', 'Importo', 'Categoria', 'Pagato da', 'Metodo', 'Personale', 'Note']];
    api.righe().forEach(function (r) { righe.push([r.data, r.descrizione, U.num(r.importo), r.categoria, r.pagatoDa, r.metodo, r.personale ? 'sì' : '', r.note]); });
    var a = Fam.h('a', { href: URL.createObjectURL(new Blob(['﻿' + righe.map(function (r) { return r.map(cel).join(';'); }).join('\r\n')], { type: 'text/csv;charset=utf-8' })), download: 'spese-famiglia.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  Sezione.definisci('spese', {
    raccolta: 'spese',
    nuovoTesto: 'Nuova spesa',
    campi: [
      { k: 'descrizione', etichetta: 'Descrizione', obbligatorio: true, segnaposto: 'Es. Spesa Conad, bolletta luce' },
      { k: 'importo', etichetta: 'Importo', tipo: 'euro', obbligatorio: true, mezzo: true, segnaposto: '€' },
      { k: 'data', etichetta: 'Data', tipo: 'data', mezzo: true, predefinito: function () { return U.oggiISO(); } },
      { k: 'categoria', etichetta: 'Categoria', tipo: 'scelta', mezzo: true, predefinito: 'Spesa alimentare', opzioni: Object.keys(CAT).map(function (k) { return { valore: k, testo: CAT[k] + ' ' + k }; }) },
      { k: 'pagatoDa', etichetta: 'Pagato da', tipo: 'scelta', mezzo: true, predefinito: function () { return Fam.io(); }, opzioni: function () { return Fam.membri().concat(['Conto comune']); } },
      { k: 'metodo', etichetta: 'Come', tipo: 'scelta', mezzo: true, opzioni: ['Carta', 'Bancomat', 'Contanti', 'Bonifico', 'Addebito in conto', 'PayPal', 'Satispay'] },
      { k: 'personale', etichetta: 'Spesa personale (non da dividere)', tipo: 'spunta' },
      { k: 'note', etichetta: 'Note', segnaposto: 'Scontrino, garanzia…' }
    ],
    ordina: function (a, b) { return String(b.data || '').localeCompare(String(a.data || '')) || String(b.creatoIl || '').localeCompare(String(a.creatoIl || '')); },
    gruppo: function (r) { var m = mese(r.data); return nomeMese(m).replace(/^./, function (c) { return c.toUpperCase(); }); },
    titoloVoce: function (r) { return (CAT[r.categoria] || '📌') + ' ' + (r.descrizione || ''); },
    sottoVoce: function (r) { return [U.data(r.data), r.categoria, r.pagatoDa ? 'pagato da ' + r.pagatoDa : '', r.metodo, r.personale ? 'personale' : ''].filter(Boolean).join(' · '); },
    badge: function (r) { return { testo: U.euro(r.importo), tipo: '' }; },
    filtri: [
      { id: 'mese', testo: 'Questo mese', f: function (r) { return mese(r.data) === meseOggi(0); } },
      { id: 'scorso', testo: 'Mese scorso', f: function (r) { return mese(r.data) === meseOggi(-1); } },
      { id: 'anno', testo: 'Quest\'anno', f: function (r) { return String(r.data || '').slice(0, 4) === String(new Date().getFullYear()); } },
      { id: 'tutte', testo: 'Tutte', f: function () { return true; } }
    ],
    riepilogo: function (righe) {
      var q = righe.filter(function (r) { return mese(r.data) === meseOggi(0); }), s = righe.filter(function (r) { return mese(r.data) === meseOggi(-1); });
      var anno = righe.filter(function (r) { return String(r.data || '').slice(0, 4) === String(new Date().getFullYear()); });
      return [
        { valore: U.euro(tot(q)), etichetta: 'questo mese', ico: '📅', barra: tot(s) ? tot(q) / tot(s) : undefined },
        { valore: U.euro(tot(s)), etichetta: 'il mese scorso', ico: '🗓️' },
        { valore: U.euro(tot(anno)), etichetta: 'da gennaio', ico: '📈' }
      ];
    },
    azioni: [
      { testo: '📊 Resoconto del mese (categorie, chi ha pagato)', fai: resoconto },
      { testo: '📄 Scarica per Excel', fai: csv }
    ],
    vuoto: 'Nessuna spesa. Segnatele man mano: a fine mese vedete dove vanno i soldi e chi ha pagato cosa.',
    novita: function (r) { return r.descrizione + ' (' + U.euro(r.importo) + ')'; },
    home: function (righe) {
      var q = righe.filter(function (r) { return mese(r.data) === meseOggi(0); });
      return nomeMese(meseOggi(0)).replace(/ \d+$/, '').replace(/^./, function (c) { return c.toUpperCase(); }) + ': ' + U.euro(tot(q));
    }
  });
})();
