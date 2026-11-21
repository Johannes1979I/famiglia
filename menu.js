/* 🍝 Menù della settimana — pranzo e cena per ogni giorno, e gli
   ingredienti che con un tocco finiscono nella lista della spesa.
   Dati: menu/<AAAA-MM-GG> { pranzo, cena }   menu/sett-<lunedì> { ingredienti } */
(function () {
  'use strict';
  var h = Fam.h, svuota = Fam.svuota, U = Sezione.U;
  var GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  var PASTI = [['pranzo', '☀️ Pranzo'], ['cena', '🌙 Cena']];

  function lunedi(iso) { var d = U.aData(iso), w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return U.daData(d); }

  // la pagina del menù parte solo su menu.html; altrove (la home) serve solo lo stato
  if (document.body.getAttribute('data-pagina') === 'menu') Fam.avvio(function () {
    var M = Fam.raccolta('menu'), S = Fam.raccolta('spesa');
    var app = document.getElementById('app');
    var settimana = lunedi(U.oggiISO());
    var campi = {};          // id-giorno|pasto -> input
    Fam.pillolaStato(document.getElementById('pillola'));
    document.getElementById('indietro').href = 'index.html' + location.search + '#k=' + Fam.chiave;
    var chi = document.getElementById('chi');
    chi.addEventListener('click', function () { Fam.chiediChiSei(false, disegna); });

    var titolo = h('b', { class: 'titolo-settimana' });
    var nav = h('div', { class: 'barra-contesto' },
      h('button', { type: 'button', class: 'btn piccolo', 'aria-label': 'Settimana precedente', text: '‹', onclick: function () { cambia(-7); } }),
      titolo,
      h('button', { type: 'button', class: 'btn piccolo', 'aria-label': 'Settimana seguente', text: '›', onclick: function () { cambia(7); } }),
      h('button', { type: 'button', class: 'btn piccolo', text: 'Oggi', onclick: function () { settimana = lunedi(U.oggiISO()); costruisci(); } }),
      h('span', { style: 'flex:1' }),
      h('button', { type: 'button', class: 'btn piccolo', text: '📋 Copia la settimana prima', onclick: copiaPrecedente }),
      h('button', { type: 'button', class: 'btn piccolo', text: '🧹 Svuota', onclick: svuotaSettimana }));
    var griglia = h('div', { class: 'menu-griglia' });
    var dl = h('datalist', { id: 'dl-piatti' });
    var ingr = h('textarea', { rows: 4, placeholder: 'Uno per riga o separati da virgola: es. 500 g macinato, passata, parmigiano', 'aria-label': 'Ingredienti da comprare' });
    var stato = h('span', { class: 'tenue piccolo' });
    ingr.addEventListener('input', function () { M.imposta('sett-' + settimana, { ingredienti: ingr.value, inviati: false }, 'ingredienti'); });
    var box = h('section', { class: 'menu-ingredienti' },
      h('h3', { text: '🧾 Ingredienti da comprare per questa settimana' }), ingr,
      h('div', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px' },
        h('button', { type: 'button', class: 'btn primario', text: '🛒 Manda alla spesa', onclick: mandaAllaSpesa }), stato));
    app.appendChild(h('div', null, h('div', { class: 'banner', id: 'bannerCloud', hidden: true }, h('b', { text: 'Il salvataggio condiviso non è attivo in questo momento. ' }), 'Quello che scrivi resta su questo dispositivo.'),
      nav, griglia, dl, box));

    function cambia(n) { settimana = U.aggiungiGiorni(settimana, n); costruisci(); }

    function costruisci() {
      svuota(griglia); campi = {};
      var oggi = U.oggiISO();
      for (var i = 0; i < 7; i++) {
        var giorno = U.aggiungiGiorni(settimana, i);
        var card = h('div', { class: 'menu-giorno' + (giorno === oggi ? ' oggi' : '') },
          h('div', { class: 'menu-data' }, h('b', { text: GIORNI[i] }), h('span', { class: 'tenue', text: U.data(giorno) }), giorno === oggi ? h('span', { class: 'badge', text: 'oggi' }) : null));
        PASTI.forEach(function (p) {
          (function (giorno, p) {
            var inp = h('input', { type: 'text', list: 'dl-piatti', placeholder: '—', maxlength: 120, 'aria-label': p[1] + ' di ' + giorno });
            inp.addEventListener('input', function () { var c = {}; c[p[0]] = inp.value; M.imposta(giorno, c, p[0]); });
            campi[giorno + '|' + p[0]] = inp;
            card.appendChild(h('label', { class: 'menu-pasto' }, h('span', { text: p[1] }), inp));
          })(giorno, p);
        });
        griglia.appendChild(card);
      }
      disegna();
    }

    function disegna() {
      chi.textContent = '👤 ' + (Fam.io() || 'Chi sei?');
      var fine = U.aggiungiGiorni(settimana, 6);
      titolo.textContent = 'Settimana dal ' + U.data(settimana) + ' al ' + U.data(fine);
      var attivo = document.activeElement;
      Object.keys(campi).forEach(function (k) {
        var p = k.split('|'), r = M.prendi(p[0]), v = r && r[p[1]] || '';
        if (campi[k] !== attivo && campi[k].value !== v) campi[k].value = v;
      });
      var s = M.prendi('sett-' + settimana);
      if (ingr !== attivo) ingr.value = s && s.ingredienti || '';
      stato.textContent = s && s.inviati ? '✓ già mandati alla spesa' + (s.inviatiDa ? ' da ' + s.inviatiDa : '') : '';
      // suggerimenti: i piatti già scritti, i più frequenti per primi
      var conta = {};
      M.tutte().forEach(function (r) { PASTI.forEach(function (p) { var v = String(r[p[0]] || '').trim(); if (v) conta[v] = (conta[v] || 0) + 1; }); });
      svuota(dl);
      Object.keys(conta).sort(function (a, b) { return conta[b] - conta[a]; }).slice(0, 150).forEach(function (v) { dl.appendChild(h('option', { value: v })); });
    }

    function mandaAllaSpesa() {
      var voci = ingr.value.split(/\s*[,;\n]\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
      if (!voci.length) { Fam.avviso('Scrivi prima gli ingredienti'); ingr.focus(); return; }
      var nuove = 0, gia = 0;
      voci.forEach(function (v) { var e = Reparti.aggiungi(S, v); if (e) { if (e.gia) gia++; else nuove++; } });
      M.imposta('sett-' + settimana, { inviati: true, inviatiDa: Fam.io() }, 'inviati');
      S.sincronizza();
      Fam.avviso('🛒 ' + nuove + ' aggiunti alla spesa' + (gia ? ', ' + gia + ' c\'erano già' : ''));
      disegna();
    }
    function copiaPrecedente() {
      var prima = U.aggiungiGiorni(settimana, -7), n = 0;
      for (var i = 0; i < 7; i++) {
        var da = M.prendi(U.aggiungiGiorni(prima, i)), a = U.aggiungiGiorni(settimana, i);
        if (!da) continue;
        var c = {};
        PASTI.forEach(function (p) { if (da[p[0]]) c[p[0]] = da[p[0]]; });
        if (Object.keys(c).length) { M.imposta(a, c, 'copia'); n++; }
      }
      Fam.avviso(n ? 'Copiati ' + n + ' giorni dalla settimana prima' : 'La settimana prima è vuota');
      disegna();
    }
    function svuotaSettimana() {
      Fam.dialogo('Svuotare questa settimana?', h('p', { text: 'Cancella pranzi e cene dei sette giorni mostrati (per tutti e due).' }), [
        { testo: 'Annulla' },
        { testo: 'Svuota', pericolo: true, azione: function () {
          for (var i = 0; i < 7; i++) { var g = U.aggiungiGiorni(settimana, i); if (M.prendi(g)) M.imposta(g, { pranzo: null, cena: null }, 'svuota'); }
          disegna();
        } }
      ]);
    }

    M.su(function (tipo, dati) {
      if (tipo === 'remoto') disegna();
      if (tipo === 'novita') Fam.avviso('✎ ' + dati[0].modDa + ' ha aggiornato il menù', { durata: 6000 });
    });
    Fam.su(function (t) { if (t === 'io') disegna(); });
    costruisci();
    M.sincronizza(); S.sincronizza();
  });

  // stato per la home: cosa c'è stasera
  Sezione.definisci('menu', {
      raccolta: 'menu', campi: [],
      home: function () {
        var r = Fam.raccolta('menu').prendi(U.oggiISO());
        if (r && r.cena) return 'Stasera: ' + r.cena;
        if (r && r.pranzo) return 'Oggi a pranzo: ' + r.pranzo;
        return 'Oggi non c\'è ancora niente';
      }
  });
})();
