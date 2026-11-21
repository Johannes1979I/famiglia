/* =========================================================================
   regali.js — la lista dei regali (Natale, compleanni, ogni occasione).

   Dati su Firestore, sotto famiglia/<chiave>/:
     liste/<id>   { titolo, data }                       — es. «Natale 2026»
     regali/<id>  { lista, nome, ordine, fatto, idee, regalo, dafare,
                    budget, speso, chi, incartato, link, note, nascostoA,
                    eliminato, creatoDa, creatoIl, modDa, modIl, modCampo }
   ========================================================================= */
(function () {
  'use strict';
  var h = Fam.h, svuota = Fam.svuota;
  var EUR = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  var ETICHETTE = {
    fatto: 'Fatto', nome: 'Nome', idee: 'Proposte', regalo: 'Regalo scelto', dafare: 'Da fare',
    budget: 'Budget', speso: 'Speso', chi: 'A cura di', incartato: 'Incartato', link: 'Link',
    note: 'Note', nascostoA: 'Nascondi a', ordine: 'Ordine', eliminato: 'Cestino', nuova: 'Aggiunta'
  };
  var FILTRI = [
    { id: 'tutti', testo: 'Tutti', f: function () { return true; } },
    { id: 'dafare', testo: 'Da fare', f: function (r) { return !r.fatto; } },
    { id: 'fatti', testo: 'Fatti', f: function (r) { return !!r.fatto; } },
    { id: 'senzaidea', testo: 'Senza idea', f: function (r) { return !r.fatto && !piena(r.idee) && !piena(r.regalo); } },
    { id: 'incartare', testo: 'Da incartare', f: function (r) { return !!r.fatto && !r.incartato; } },
    { id: 'miei', testo: 'A cura mia', f: function (r) { return r.chi === Fam.io() || r.chi === 'Insieme'; } }
  ];

  function piena(s) { return s !== null && s !== undefined && String(s).trim() !== ''; }
  function semplice(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function aNum(s) {
    s = String(s === null || s === undefined ? '' : s).replace(/[€\s]/g, '');
    if (!s) return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (!/^\d+\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }
  function fmtNum(n) { return (n === null || n === undefined || n === '') ? '' : String(Math.round(n * 100) / 100).replace('.', ','); }
  function euro(n) { return EUR.format(n).replace(',00', ''); }
  /* Tutti i link scritti nelle proposte, nel regalo scelto, nel «da fare»,
     nelle note e nel campo link: diventano pulsanti cliccabili sotto la riga. */
  var RE_LINK = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
  function linkDi(r) {
    var visti = {}, out = [];
    ['idee', 'regalo', 'dafare', 'note', 'link'].forEach(function (k) {
      var t = String(r[k] || '');
      if (k === 'link' && t && !RE_LINK.test(t)) t = 'https://' + t;
      RE_LINK.lastIndex = 0;
      (t.match(RE_LINK) || []).forEach(function (u) {
        u = u.replace(/[).,;:!?»]+$/, '');
        var url = /^https?:\/\//i.test(u) ? u : 'https://' + u;
        try { var nome = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return; }
        if (visti[url]) return; visti[url] = 1;
        var stessi = out.filter(function (x) { return x.nome.indexOf(nome) === 0; }).length;
        out.push({ url: url, nome: stessi ? nome + ' (' + (stessi + 1) + ')' : nome });
      });
    });
    return out;
  }
  function attesa(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  Fam.avvio(function (info, p) {
    var R = Fam.raccolta('regali'), L = Fam.raccolta('liste');
    var $ = function (id) { return document.getElementById(id); };
    var contenitore = $('righe');
    var nodi = {};              // id -> { el, campi, segni }
    var trattieni = {};         // righe appena toccate: restano visibili anche se escono dal filtro
    var firmaMembri = '';
    var stato = {
      filtro: Fam.ls('fam_filtro') || 'tutti',
      cerca: '',
      lista: Fam.ls('fam_lista_' + Fam.chiave.slice(0, 10)) || ''
    };

    Fam.pillolaStato($('pillola'));
    $('indietro').href = 'index.html' + location.search + '#k=' + Fam.chiave;

    /* -------------------------------------------------- liste */
    function liste() {
      return L.tutte().filter(function (l) { return !l.eliminato && l.titolo; })
        .sort(function (a, b) { return String(b.data || b.creatoIl || '').localeCompare(String(a.data || a.creatoIl || '')); });
    }
    function listaCorrente() {
      var tutte = liste();
      return tutte.filter(function (l) { return l.id === stato.lista; })[0] || tutte[0] || null;
    }
    function idLista() { var l = listaCorrente(); return l ? l.id : ''; }
    function assicuraLista() {
      if (liste().length) return;
      var ora = new Date(), anno = ora.getFullYear() - (ora.getMonth() === 0 ? 1 : 0);
      L.imposta('natale-' + anno, { titolo: 'Natale ' + anno, data: anno + '-12-25' }, 'nuova');
    }
    function scegliLista(id) {
      stato.lista = id;
      Fam.ls('fam_lista_' + Fam.chiave.slice(0, 10), id);
      Object.keys(nodi).forEach(function (k) { nodi[k].el.remove(); delete nodi[k]; });
      trattieni = {};
      disegna();
    }

    /* -------------------------------------------------- righe */
    function righeLista(anche) {
      var id = idLista(), me = Fam.io();
      return R.tutte().filter(function (r) {
        return r.lista === id && (anche || !r.eliminato) && !(r.nascostoA && r.nascostoA === me);
      }).sort(function (a, b) { return (a.ordine || 0) - (b.ordine || 0) || String(a.nome || '').localeCompare(String(b.nome || '')); });
    }
    function filtro() { return FILTRI.filter(function (f) { return f.id === stato.filtro; })[0] || FILTRI[0]; }
    function corrisponde(r) {
      if (!stato.cerca) return true;
      var q = semplice(stato.cerca);
      return ['nome', 'idee', 'regalo', 'dafare', 'note', 'chi'].some(function (k) { return semplice(r[k]).indexOf(q) >= 0; });
    }
    function visibili() {
      var f = filtro().f;
      return righeLista().filter(function (r) { return trattieni[r.id] || (f(r) && corrisponde(r)); });
    }
    function cambia(id, k, v) {
      trattieni[id] = true;
      var campi = {}; campi[k] = v;
      R.imposta(id, campi, k);
    }

    function opzioniChi(sel) {
      var m = Fam.membri(), val = sel.value;
      svuota(sel);
      sel.appendChild(h('option', { value: '', text: '— chi?' }));
      m.forEach(function (n) { sel.appendChild(h('option', { value: n, text: n })); });
      sel.appendChild(h('option', { value: 'Insieme', text: 'Insieme' }));
      sel.value = val;
    }
    function adatta(ta) {
      if (!ta.offsetParent) return;
      ta.style.height = 'auto';
      ta.style.height = (ta.scrollHeight + 2) + 'px';
    }

    function creaRiga(id) {
      var c = {};
      var testo = function (k, tag, ph, etichetta, cls) {
        var el = h(tag, { class: cls || '', placeholder: ph, 'aria-label': ETICHETTE[k] + ' — ' + ph, rows: tag === 'textarea' ? 1 : null, type: tag === 'input' ? 'text' : null, maxlength: 2000 });
        el.addEventListener('input', function () {
          if (tag === 'textarea') adatta(el);
          cambia(id, k, (k === 'budget' || k === 'speso') ? aNum(el.value) : el.value);
        });
        if (k === 'budget' || k === 'speso') {
          el.setAttribute('inputmode', 'decimal');
          el.addEventListener('blur', function () { var r = R.prendi(id); if (r) el.value = fmtNum(r[k]); });
        }
        c[k] = el;
        return h('div', { class: 'c-' + k, 'data-etichetta': etichetta || null }, el);
      };
      c.fatto = h('input', { type: 'checkbox', 'aria-label': 'Regalo fatto', onchange: function () {
        cambia(id, 'fatto', c.fatto.checked);
        var r = R.prendi(id);
        if (c.fatto.checked) Fam.avviso((document.body.classList.contains('tema-natale') ? '🎁 ' : '✓ ') + 'Regalo fatto per ' + (r && r.nome || '') + '. Bravi!');
      } });
      c.chi = h('select', { 'aria-label': 'A cura di', onchange: function () { cambia(id, 'chi', c.chi.value); c.chi.classList.toggle('scelto', !!c.chi.value); } });
      opzioniChi(c.chi);
      c.incartato = h('button', { type: 'button', title: 'Incartato', 'aria-label': 'Incartato', text: '🎀', onclick: function () {
        var r = R.prendi(id);
        cambia(id, 'incartato', !(r && r.incartato));
      } });
      var segni = h('div', { class: 'segni' });
      var el = h('div', { class: 'riga', 'data-id': id },
        h('div', { class: 'c-fatto' }, c.fatto),
        testo('nome', 'input', 'Nome', null, 'testo nome'),
        testo('idee', 'textarea', 'Idee, proposte… (anche link)', 'Proposte / idee'),
        testo('regalo', 'textarea', 'Cosa gli regaliamo', 'Regalo scelto'),
        testo('dafare', 'textarea', 'Es. ordinare, ritirare…', 'Da fare'),
        testo('budget', 'input', 'Budget €', 'Budget', 'testo num'),
        testo('speso', 'input', 'Speso €', 'Speso', 'testo num'),
        h('div', { class: 'c-chi', 'data-etichetta': 'A cura di' }, c.chi),
        h('div', { class: 'c-fiocco' }, c.incartato),
        h('div', { class: 'c-menu' }, h('button', { type: 'button', title: 'Dettagli: link, note, nascondi, sposta, elimina', 'aria-label': 'Dettagli', text: '⋯', onclick: function () { dettagli(id); } })),
        segni
      );
      return { el: el, campi: c, segni: segni };
    }

    function aggiornaRiga(n, r) {
      var c = n.campi, attivo = document.activeElement;
      ['nome', 'idee', 'regalo', 'dafare'].forEach(function (k) {
        if (c[k] !== attivo && c[k].value !== (r[k] || '')) c[k].value = r[k] || '';
      });
      ['budget', 'speso'].forEach(function (k) {
        if (c[k] !== attivo && aNum(c[k].value) !== (r[k] === undefined ? null : r[k])) c[k].value = fmtNum(r[k]);
      });
      c.fatto.checked = !!r.fatto;
      if (c.chi !== attivo) { c.chi.value = r.chi || ''; c.chi.classList.toggle('scelto', !!r.chi); }
      c.incartato.setAttribute('aria-pressed', String(!!r.incartato));
      n.el.classList.toggle('fatto', !!r.fatto);
      svuota(n.segni);
      if (r.nascostoA) n.segni.appendChild(h('span', { class: 'nasc', text: '🙈 nascosto a ' + r.nascostoA }));
      linkDi(r).forEach(function (l) {
        n.segni.appendChild(h('a', { class: 'link-proposta', href: l.url, target: '_blank', rel: 'noopener noreferrer', title: l.url, text: '🔗 ' + l.nome }));
      });
      if (piena(r.note)) n.segni.appendChild(h('span', { text: '📝 ' + String(r.note).slice(0, 80) + (String(r.note).length > 80 ? '…' : '') }));
      if (r.modDa && r.modDa !== Fam.io()) n.segni.appendChild(h('span', { text: '✎ ' + r.modDa + ', ' + Fam.quando(r.modIl) }));
    }

    /* -------------------------------------------------- disegno */
    function disegna() {
      var lista = listaCorrente();
      var tutte = righeLista(), vis = visibili(), idVis = {};
      var firma = Fam.membri().join('|');
      var membriCambiati = firma !== firmaMembri; firmaMembri = firma;

      // titolo e selettore delle liste
      var natale = lista && /natale/i.test(lista.titolo);
      svuota($('titolo')).appendChild(document.createTextNode(natale ? '🎄 ' : '🎁 '));
      $('titolo').appendChild(h('span', { class: 'pre', text: lista ? 'Regali · ' : 'Regali' }));
      if (lista) $('titolo').appendChild(document.createTextNode(lista.titolo));
      document.body.classList.toggle('tema-natale', !!natale);
      document.querySelector('meta[name=theme-color]').content = natale ? '#8f1820' : '#2f5d73';
      $('nuovoNome').placeholder = natale ? '🎅 Aggiungi una persona alla lista…' : 'Aggiungi una persona…';
      document.title = lista ? 'Regali · ' + lista.titolo : 'Regali';
      var sel = $('lista'), ll = liste();
      sel.hidden = ll.length < 2;
      if (!sel.hidden) {
        svuota(sel);
        ll.forEach(function (l) { sel.appendChild(h('option', { value: l.id, text: l.titolo })); });
        sel.value = idLista();
      }
      $('chi').textContent = '👤 ' + (Fam.io() || 'Chi sei?');

      // righe
      vis.forEach(function (r, i) {
        idVis[r.id] = true;
        var n = nodi[r.id] || (nodi[r.id] = creaRiga(r.id));
        if (membriCambiati) opzioniChi(n.campi.chi);
        aggiornaRiga(n, r);
        if (contenitore.children[i] !== n.el) contenitore.insertBefore(n.el, contenitore.children[i] || null);
        n.el.hidden = false;
      });
      Object.keys(nodi).forEach(function (id) {
        if (!idVis[id]) {
          var r = R.prendi(id);
          if (!r || r.lista !== idLista() || r.eliminato || r.nascostoA === Fam.io()) { nodi[id].el.remove(); delete nodi[id]; }
          else nodi[id].el.hidden = true;
        }
      });
      vis.forEach(function (r) {
        var c = nodi[r.id].campi;
        ['idee', 'regalo', 'dafare'].forEach(function (k) { adatta(c[k]); });
      });

      var vuoto = $('vuoto');
      vuoto.hidden = vis.length > 0;
      vuoto.textContent = !tutte.length ? (natale ? '☃️ ' : '') + 'La lista è vuota: aggiungi la prima persona qui sotto.'
        : stato.cerca ? 'Nessun risultato per «' + stato.cerca + '».'
        : 'Nessuno in «' + filtro().testo + '».';

      disegnaFiltri(tutte);
      disegnaRiepilogo(tutte, lista);

      var ultima = tutte.slice().sort(function (a, b) { return String(b.modIl || '').localeCompare(String(a.modIl || '')); })[0];
      $('ultimaMod').textContent = ultima && ultima.modIl ? 'Ultima modifica: ' + (ultima.modDa || '?') + ', ' + Fam.quando(ultima.modIl) + ' (' + (ultima.nome || '') + ')' : '';
    }

    function disegnaFiltri(tutte) {
      var box = $('filtri');
      svuota(box);
      FILTRI.forEach(function (f) {
        var n = tutte.filter(f.f).length;
        box.appendChild(h('button', {
          type: 'button', class: 'chip', 'aria-pressed': String(stato.filtro === f.id),
          onclick: function () { stato.filtro = f.id; Fam.ls('fam_filtro', f.id); trattieni = {}; disegna(); }
        }, f.testo, h('span', { class: 'n', text: n })));
      });
    }

    function cifra(cls, valore, etichetta, barra, ico) {
      var c = h('div', { class: 'cifra ' + (cls || '') }, ico ? h('i', { class: 'ico', 'aria-hidden': 'true', text: ico }) : null, h('b', { text: valore }), h('span', { text: etichetta }));
      if (barra) {
        var b = h('div', { class: 'barra' + (barra.sopra ? ' sopra' : '') }, h('i', { style: 'width:' + Math.min(100, Math.round(barra.p * 100)) + '%' }));
        c.appendChild(b);
      }
      return c;
    }
    function disegnaRiepilogo(tutte, lista) {
      var box = svuota($('riepilogo'));
      var n = tutte.length, fatti = tutte.filter(function (r) { return r.fatto; }).length;
      var senza = tutte.filter(FILTRI[3].f).length;
      var budget = 0, speso = 0, conBudget = 0;
      tutte.forEach(function (r) {
        if (typeof r.budget === 'number') { budget += r.budget; conBudget++; }
        if (typeof r.speso === 'number') speso += r.speso;
      });
      var nat = lista && /natale/i.test(lista.titolo);
      var I = nat ? ['🎁', '📜', '💡', '💰', '🧾', '🎄'] : ['✅', '📝', '💡', '💰', '🧾', '📅'];
      box.appendChild(cifra('fatti', fatti + ' / ' + n, 'regali fatti', { p: n ? fatti / n : 0 }, I[0]));
      box.appendChild(cifra('manca', String(n - fatti), 'ancora da fare', null, I[1]));
      box.appendChild(cifra('', String(senza), 'senza un\'idea', null, I[2]));
      box.appendChild(cifra('', budget ? euro(budget) : '—', conBudget ? 'budget (' + conBudget + (conBudget === 1 ? ' persona)' : ' persone)') : 'budget: scrivilo nelle righe', null, I[3]));
      box.appendChild(cifra('', euro(speso), budget ? (speso > budget ? 'speso · oltre di ' + euro(speso - budget) : 'speso · restano ' + euro(budget - speso)) : 'speso finora',
        budget ? { p: speso / budget, sopra: speso > budget } : null, I[4]));
      if (lista && lista.data) {
        var oggi = new Date(); oggi.setHours(0, 0, 0, 0);
        var g = Math.round((new Date(lista.data + 'T00:00:00') - oggi) / 86400000);
        box.appendChild(cifra('', g > 1 ? String(g) : g === 1 ? 'Domani' : g === 0 ? 'Oggi!' : '—',
          g > 1 ? 'giorni a ' + (nat ? 'Natale' : lista.titolo) : g < 0 ? 'data passata' : (nat ? 'è Natale' : lista.titolo), null, I[5]));
      }
    }

    /* -------------------------------------------------- dettagli di una riga */
    function dettagli(id) {
      var r = R.prendi(id); if (!r) return;
      var salva = function (k) { return function (e) { cambia(id, k, e.target.value); disegna(); }; };
      var nome = h('input', { type: 'text', value: r.nome || '', maxlength: 60, oninput: salva('nome') });
      var link = h('input', { type: 'url', value: r.link || '', placeholder: 'https://… (negozio, Amazon, foto)', oninput: salva('link') });
      var note = h('textarea', { rows: 4, placeholder: 'Taglia, colore, dove l\'abbiamo nascosto, scontrino…', oninput: salva('note') });
      note.value = r.note || '';
      var nasc = h('select', { onchange: salva('nascostoA') },
        h('option', { value: '', text: 'Visibile a tutti' }),
        Fam.membri().map(function (m) { return h('option', { value: m, text: 'Nascondi a ' + m + (m === Fam.io() ? ' (sei tu)' : '') }); }));
      nasc.value = r.nascostoA || '';
      var sposta = function (dir) {
        var tutte = righeLista(), i = tutte.map(function (x) { return x.id; }).indexOf(id), j = i + dir;
        if (j < 0 || j >= tutte.length) return;
        // rinumera tutto per evitare ordini doppi, poi scambia
        tutte.forEach(function (x, k) { if (x.ordine !== k + 1) R.imposta(x.id, { ordine: k + 1 }, 'ordine'); });
        R.imposta(tutte[i].id, { ordine: j + 1 }, 'ordine');
        R.imposta(tutte[j].id, { ordine: i + 1 }, 'ordine');
        disegna();
      };
      var info = [];
      if (r.creatoDa) info.push('Aggiunto da ' + r.creatoDa + ', ' + Fam.quando(r.creatoIl));
      if (r.modDa) info.push('Ultima modifica di ' + r.modDa + ', ' + Fam.quando(r.modIl) + (r.modCampo ? ' (' + (ETICHETTE[r.modCampo] || r.modCampo) + ')' : ''));
      Fam.dialogo('Dettagli · ' + (r.nome || ''), [
        h('label', { class: 'campo' }, h('span', { text: 'Nome' }), nome),
        h('label', { class: 'campo' }, h('span', { text: 'Link (dove comprarlo)' }), link),
        h('label', { class: 'campo' }, h('span', { text: 'Note' }), note),
        h('label', { class: 'campo' }, h('span', { text: 'Riservatezza' }), nasc,
          h('span', { class: 'tenue piccolo', style: 'margin-top:4px', text: 'Utile se la persona della lista usa anche lei l\'app: la riga sparisce dal suo telefono. È discrezione, non una cassaforte.' })),
        h('div', { class: 'campo' }, h('span', { text: 'Posizione nella lista' }),
          h('div', { class: 'scelte', style: 'margin:0' },
            h('button', { type: 'button', class: 'btn piccolo', text: '↑ Sposta su', onclick: function () { sposta(-1); } }),
            h('button', { type: 'button', class: 'btn piccolo', text: '↓ Sposta giù', onclick: function () { sposta(1); } }))),
        h('p', { class: 'tenue piccolo', text: info.join(' · ') })
      ], [
        { testo: 'Sposta nel cestino', pericolo: true, azione: function () { cambia(id, 'eliminato', true); delete trattieni[id]; disegna(); Fam.avviso((r.nome || 'Riga') + ' è nel cestino (si può ripristinare da «Altro»).'); } },
        { testo: 'Fatto', primario: true }
      ], { allaChiusura: disegna });
    }

    /* -------------------------------------------------- azioni del menù */
    var AZIONI = {
      modifiche: function () {
        var tutte = righeLista(true).filter(function (r) { return r.modIl; })
          .sort(function (a, b) { return String(b.modIl).localeCompare(String(a.modIl)); }).slice(0, 30);
        Fam.dialogo('Ultime modifiche', tutte.length ? h('ul', { class: 'elenco-mod', style: 'padding-left:18px;margin:0' },
          tutte.map(function (r) {
            return h('li', { style: 'margin-bottom:6px' }, h('b', { text: r.modDa || '?' }), ' · ' + Fam.quando(r.modIl) + ' — ',
              (r.nome || '?') + ': ' + (r.eliminato ? 'messo nel cestino' : (ETICHETTE[r.modCampo] || r.modCampo || 'modifica')));
          })) : h('p', { class: 'tenue', text: 'Ancora nessuna modifica.' }), null, { largo: true });
      },
      stampa: function () {
        var box = svuota($('stampa')), lista = listaCorrente(), vis = visibili();
        box.appendChild(h('h1', { text: 'Regali · ' + (lista ? lista.titolo : '') }));
        box.appendChild(h('p', { text: 'Stampato il ' + new Date().toLocaleDateString('it-IT') + ' · ' + filtro().testo + ' · ' + vis.length + ' persone' }));
        var t = h('table', null, h('thead', null, h('tr', null, ['✓', 'Nome', 'Proposte / idee', 'Regalo scelto', 'Da fare', 'Budget', 'Speso', 'A cura di', '🎀', 'Note'].map(function (x) { return h('th', { text: x }); }))));
        var tb = h('tbody');
        vis.forEach(function (r) {
          tb.appendChild(h('tr', null,
            h('td', { text: r.fatto ? '✓' : '' }), h('td', null, h('b', { text: r.nome || '' })),
            h('td', { text: r.idee || '' }), h('td', { text: r.regalo || '' }), h('td', { text: r.dafare || '' }),
            h('td', { class: 'n', text: typeof r.budget === 'number' ? euro(r.budget) : '' }),
            h('td', { class: 'n', text: typeof r.speso === 'number' ? euro(r.speso) : '' }),
            h('td', { text: r.chi || '' }), h('td', { text: r.incartato ? '🎀' : '' }), h('td', { text: r.note || '' })));
        });
        t.appendChild(tb);
        box.appendChild(t);
        window.print();
      },
      csv: function () {
        var lista = listaCorrente(), cel = function (v) { return '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"'; };
        var righe = [['Fatto', 'Nome', 'Proposte / idee', 'Regalo scelto', 'Da fare', 'Budget', 'Speso', 'A cura di', 'Incartato', 'Link', 'Note', 'Ultima modifica']];
        visibili().forEach(function (r) {
          righe.push([r.fatto ? 'sì' : 'no', r.nome, r.idee, r.regalo, r.dafare, fmtNum(r.budget), fmtNum(r.speso), r.chi,
            r.incartato ? 'sì' : 'no', r.link, r.note, r.modDa ? r.modDa + ' ' + Fam.quando(r.modIl) : '']);
        });
        var testo = '﻿' + righe.map(function (r) { return r.map(cel).join(';'); }).join('\r\n');
        var a = h('a', { href: URL.createObjectURL(new Blob([testo], { type: 'text/csv;charset=utf-8' })),
          download: 'regali-' + semplice(lista ? lista.titolo : 'lista').replace(/[^a-z0-9]+/g, '-') + '.csv' });
        document.body.appendChild(a); a.click(); a.remove();
      },
      ordina: function () {
        Fam.dialogo('Ordinare dalla A alla Z?', h('p', { text: 'Cambia l\'ordine della lista per tutti e due. L\'ordine attuale si perde.' }), [
          { testo: 'Annulla' },
          { testo: 'Ordina', primario: true, azione: function () {
            righeLista().slice().sort(function (a, b) { return String(a.nome || '').localeCompare(String(b.nome || ''), 'it'); })
              .forEach(function (r, i) { R.imposta(r.id, { ordine: i + 1 }, 'ordine'); });
            disegna();
          } }
        ]);
      },
      nuovaLista: function () {
        var corr = listaCorrente();
        var titolo = h('input', { type: 'text', placeholder: 'Es. Natale 2027, Compleanno di Iacopo', maxlength: 60 });
        var data = h('input', { type: 'date' });
        var copia = h('input', { type: 'checkbox', checked: true });
        titolo.addEventListener('input', function () {
          var m = /natale\s+(\d{4})/i.exec(titolo.value);
          if (m && !data.value) data.value = m[1] + '-12-25';
        });
        Fam.dialogo('Nuova lista', [
          h('label', { class: 'campo' }, h('span', { text: 'Nome della lista' }), titolo),
          h('label', { class: 'campo' }, h('span', { text: 'Data dell\'occasione (per il conto alla rovescia)' }), data),
          corr ? h('label', { class: 'campo', style: 'display:flex;gap:8px;align-items:center' }, copia, h('span', { style: 'margin:0;font-size:.95rem;color:inherit', text: 'Copia i nomi da «' + corr.titolo + '» (senza regali e spunte)' })) : null
        ], [
          { testo: 'Annulla' },
          { testo: 'Crea', primario: true, azione: function () {
            var t = titolo.value.trim(); if (!t) { titolo.focus(); return false; }
            var nuovo = Fam.nuovoId();
            L.imposta(nuovo, { titolo: t, data: data.value || null }, 'nuova');
            if (corr && copia.checked) righeLista().forEach(function (r, i) {
              R.nuova({ lista: nuovo, nome: r.nome, ordine: i + 1, fatto: false });
            });
            scegliLista(nuovo);
            Fam.avviso('Lista «' + t + '» creata. Le altre restano nel menù in alto.');
          } }
        ]);
      },
      rinominaLista: function () {
        var l = listaCorrente(); if (!l) return;
        var titolo = h('input', { type: 'text', value: l.titolo, maxlength: 60 });
        var data = h('input', { type: 'date', value: l.data || '' });
        Fam.dialogo('Rinomina la lista', [
          h('label', { class: 'campo' }, h('span', { text: 'Nome' }), titolo),
          h('label', { class: 'campo' }, h('span', { text: 'Data' }), data)
        ], [
          { testo: 'Annulla' },
          { testo: 'Salva', primario: true, azione: function () {
            if (!titolo.value.trim()) return false;
            L.imposta(l.id, { titolo: titolo.value.trim(), data: data.value || null }, 'titolo');
            disegna();
          } }
        ]);
      },
      cestino: function () {
        var box = h('div');
        var d;
        function riempi() {
          svuota(box);
          var via = righeLista(true).filter(function (r) { return r.eliminato; });
          if (!via.length) { box.appendChild(h('p', { class: 'tenue', text: 'Il cestino è vuoto.' })); return; }
          via.forEach(function (r) {
            box.appendChild(h('div', { style: 'display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--bordo)' },
              h('span', { style: 'flex:1', text: (r.nome || '?') + (r.regalo ? ' — ' + r.regalo : '') }),
              h('button', { type: 'button', class: 'btn piccolo', text: 'Ripristina', onclick: function () { cambia(r.id, 'eliminato', false); riempi(); disegna(); } })));
          });
        }
        riempi();
        d = Fam.dialogo('Cestino · ' + ((listaCorrente() || {}).titolo || ''), box);
      },
      aggiorna: function () { Fam.sincronizzaTutto(true).then(function () { Fam.avviso('Lista aggiornata'); }); }
    };

    /* -------------------------------------------------- collegamenti */
    $('cerca').addEventListener('input', function () { stato.cerca = this.value.trim(); trattieni = {}; disegna(); });
    $('lista').addEventListener('change', function () { scegliLista(this.value); });
    $('chi').addEventListener('click', function () { Fam.chiediChiSei(false, disegna); });
    $('btnInvita').addEventListener('click', Fam.invita);
    var tendina = $('tendina'), btnAltro = $('btnAltro');
    btnAltro.addEventListener('click', function (e) {
      e.stopPropagation();
      tendina.hidden = !tendina.hidden;
      btnAltro.setAttribute('aria-expanded', String(!tendina.hidden));
    });
    document.addEventListener('click', function () { tendina.hidden = true; btnAltro.setAttribute('aria-expanded', 'false'); });
    tendina.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-az]');
      if (b && AZIONI[b.dataset.az]) AZIONI[b.dataset.az]();
    });
    $('formAggiungi').addEventListener('submit', function (e) {
      e.preventDefault();
      var campo = $('nuovoNome'), nome = campo.value.trim();
      if (!nome) return;
      assicuraLista();
      var max = righeLista(true).reduce(function (m, r) { return Math.max(m, r.ordine || 0); }, 0);
      var r = R.nuova({ lista: idLista(), nome: nome, ordine: max + 1, fatto: false });
      trattieni[r.id] = true;
      campo.value = '';
      disegna();
      Fam.avviso(nome + ' aggiunto alla lista');
    });
    window.addEventListener('resize', function () {
      Object.keys(nodi).forEach(function (id) { ['idee', 'regalo', 'dafare'].forEach(function (k) { adatta(nodi[id].campi[k]); }); });
    });

    R.su(function (tipo, dati) {
      if (tipo === 'remoto') disegna();
      else if (tipo === 'locale') disegna();
      else if (tipo === 'novita') {
        var mie = dati.filter(function (r) { return r.lista === idLista(); });
        if (!mie.length) return;
        var chi = mie[0].modDa;
        var nomi = mie.slice(0, 3).map(function (r) { return r.nome + (r.modCampo ? ' (' + (ETICHETTE[r.modCampo] || r.modCampo).toLowerCase() + ')' : ''); }).join(', ');
        Fam.avviso('✎ ' + chi + ' ha aggiornato ' + nomi + (mie.length > 3 ? ' e altri ' + (mie.length - 3) : ''), { durata: 7000 });
        mie.forEach(function (r) {
          var n = nodi[r.id]; if (!n) return;
          n.el.classList.remove('lampo'); void n.el.offsetWidth; n.el.classList.add('lampo');
        });
      }
    });
    L.su(function (tipo) { if (tipo === 'remoto') disegna(); });
    Fam.raccolta('membri').su(function (tipo) { if (tipo === 'remoto') disegna(); });
    Fam.su(function (tipo) { if (tipo === 'io') disegna(); });

    /* -------------------------------------------------- avvio */
    disegna();   // subito dalla copia sul dispositivo
    Promise.race([Promise.all([L.sincronizza(), R.sincronizza()]), attesa(4000)]).then(function () {
      assicuraLista();
      // Link di prima configurazione: #k=…&semina=Nome1|Nome2|…
      if (p.semina) {
        var id = idLista();
        var gia = R.tutte().some(function (r) { return r.lista === id; });
        if (!gia) p.semina.split('|').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (n, i) {
          R.imposta(id + '-s' + ('0' + (i + 1)).slice(-2), { lista: id, nome: n, ordine: i + 1, fatto: false }, 'nuova');
        });
        Fam.scriviHash();
      }
      disegna();
    });
  });
})();
