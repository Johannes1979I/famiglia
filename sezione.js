/* =========================================================================
   sezione.js — il motore comune delle sezioni a elenco (spesa, scadenze,
   compleanni, spese, scuola, salute, casa, viaggi).

   Ogni pagina chiama Sezione.avvia({ ...configurazione... }) e ottiene:
   riepilogo in cifre, ricerca, filtri, gruppi, schede con spunta, finestra
   di modifica, aggiunta rapida, cestino, stampa, avvisi delle modifiche
   dell'altra persona. I dati passano tutti da Fam.raccolta().

   Configurazione (tutto facoltativo tranne raccolta e campi):
     raccolta      nome della collezione
     titolo        testo della testata
     campi         [{ k, etichetta, tipo, opzioni, segnaposto, predefinito, aiuto }]
                   tipi: testo area data ora numero euro scelta persona spunta
                         telefono email link
     spunta        nome del campo booleano da spuntare sulla scheda
     titoloVoce(r) / sottoVoce(r) / badge(r) -> {testo, tipo: ok|attenzione|urgente|tenue}
     ordina(a,b)   gruppo(r) -> etichetta del gruppo   nascondi(r) -> true = non mostrare
     filtri        [{ id, testo, f(r) }]
     riepilogo(righe, api) -> [{ valore, etichetta, ico, cls }]
     rapida        { campo, segnaposto, suggerimenti(api), aggiungi(testo, api) }
     contesto      { raccolta, campo, etichetta, nuovo, campi, descr(c) } — es. i viaggi
     dopoSpunta(r, valore, api) -> true se ha già gestito lei la spunta
     azioni        [{ testo, fai(api) }] nel menù «Altro»
     nuovoTesto    testo del pulsante «nuovo»
     vuoto         frase quando l'elenco è vuoto
     novita(r)     testo breve per l'avviso «X ha aggiornato …»
   ========================================================================= */
(function (G) {
  'use strict';
  var h = Fam.h, svuota = Fam.svuota;

  /* ------------------------------------------------------- utilità date */
  var U = {
    oggiISO: function () { var d = new Date(); return d.getFullYear() + '-' + U.due(d.getMonth() + 1) + '-' + U.due(d.getDate()); },
    due: function (n) { return ('0' + n).slice(-2); },
    aData: function (iso) { return iso ? new Date(String(iso).slice(0, 10) + 'T00:00:00') : null; },
    daData: function (d) { return d.getFullYear() + '-' + U.due(d.getMonth() + 1) + '-' + U.due(d.getDate()); },
    giorniA: function (iso) {
      if (!iso) return null;
      var o = new Date(); o.setHours(0, 0, 0, 0);
      return Math.round((U.aData(iso) - o) / 864e5);
    },
    traGiorni: function (g) {
      if (g === null || g === undefined) return '';
      if (g === 0) return 'oggi'; if (g === 1) return 'domani'; if (g === -1) return 'ieri';
      return g > 0 ? 'tra ' + g + ' giorni' : (-g) + ' giorni fa';
    },
    data: function (iso, lunga) {
      var d = U.aData(iso); if (!d) return '';
      var o = { day: 'numeric', month: 'short' };
      if (lunga) o.weekday = 'short';
      if (d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric';
      return d.toLocaleDateString('it-IT', o);
    },
    aggiungiMesi: function (iso, m) {
      var d = U.aData(iso), g = d.getDate();
      d.setDate(1); d.setMonth(d.getMonth() + m);
      var ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(g, ultimo));
      return U.daData(d);
    },
    aggiungiGiorni: function (iso, n) { var d = U.aData(iso); d.setDate(d.getDate() + n); return U.daData(d); },
    euro: function (n) {
      return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0).replace(',00', '');
    },
    aNum: function (s) {
      s = String(s === null || s === undefined ? '' : s).replace(/[€\s]/g, '');
      if (!s) return null;
      if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
      else if (!/^-?\d+\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '');
      var n = parseFloat(s); return isFinite(n) ? n : null;
    },
    num: function (n) { return (n === null || n === undefined || n === '') ? '' : String(Math.round(n * 100) / 100).replace('.', ','); },
    semplice: function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); },
    piena: function (s) { return s !== null && s !== undefined && String(s).trim() !== ''; }
  };

  /* ------------------------------------------------------- campi */
  function opzioniDi(c, api) {
    var o = typeof c.opzioni === 'function' ? c.opzioni(api) : (c.opzioni || []);
    if (c.tipo === 'persona') o = Fam.persone().concat(c.conTutti ? ['Tutti'] : []);
    return o;
  }
  function creaInput(c, valore, api) {
    var el, t = c.tipo || 'testo';
    if (t === 'area') { el = h('textarea', { rows: c.righe || 3, placeholder: c.segnaposto || '' }); el.value = valore || ''; }
    else if (t === 'spunta') el = h('input', { type: 'checkbox', checked: !!valore });
    else if (t === 'scelta' || t === 'persona') {
      var ops = opzioniDi(c, api);
      if (c.libera) {
        var idl = 'dl-' + c.k + '-' + Math.random().toString(36).slice(2, 7);
        el = h('input', { type: 'text', list: idl, value: valore || '', placeholder: c.segnaposto || '' });
        el._lista = h('datalist', { id: idl }, ops.map(function (o) { return h('option', { value: typeof o === 'string' ? o : o.valore }); }));
      } else {
        el = h('select', null, h('option', { value: '', text: c.segnaposto || '—' }),
          ops.map(function (o) { return typeof o === 'string' ? h('option', { value: o, text: o }) : h('option', { value: o.valore, text: o.testo }); }));
        if (valore && !ops.some(function (o) { return (typeof o === 'string' ? o : o.valore) === valore; }))
          el.appendChild(h('option', { value: valore, text: valore }));
        el.value = valore || '';
      }
    }
    else {
      var tipiHtml = { data: 'date', ora: 'time', telefono: 'tel', email: 'email', link: 'url' };
      el = h('input', { type: tipiHtml[t] || 'text', value: (t === 'numero' || t === 'euro') ? U.num(valore) : (valore || ''), placeholder: c.segnaposto || '' });
      if (t === 'numero' || t === 'euro') el.setAttribute('inputmode', 'decimal');
    }
    return el;
  }
  function leggiInput(c, el) {
    var t = c.tipo || 'testo';
    if (t === 'spunta') return el.checked;
    if (t === 'numero' || t === 'euro') return U.aNum(el.value);
    var v = el.value.trim();
    return v === '' ? null : v;
  }

  /* ------------------------------------------------------- avvio */
  function avvia(cfg) {
    Fam.avvio(function () {
      var R = Fam.raccolta(cfg.raccolta);
      var C = cfg.contesto ? Fam.raccolta(cfg.contesto.raccolta) : null;
      var app = document.getElementById('app');
      var chiaveLS = 'fam_' + Fam.chiave.slice(0, 10) + '_' + cfg.raccolta + '_';
      var stato = { filtro: Fam.ls(chiaveLS + 'filtro') || (cfg.filtri && cfg.filtri[0] ? cfg.filtri[0].id : ''), cerca: '', contesto: Fam.ls(chiaveLS + 'contesto') || '' };
      var trattieni = {};

      Fam.pillolaStato(document.getElementById('pillola'));
      var indietro = document.getElementById('indietro');
      if (indietro) indietro.href = 'index.html' + location.search + '#k=' + Fam.chiave;
      var chi = document.getElementById('chi');
      chi.addEventListener('click', function () { Fam.chiediChiSei(false, disegna); });

      /* ---- api passata alle configurazioni ---- */
      var api = {
        R: R, C: C, U: U, h: h,
        tutte: function () { return R.tutte().filter(function (r) { return !r.eliminato; }); },
        righe: function () { return righe(); },
        imposta: function (id, campi, et) { trattieni[id] = true; var r = R.imposta(id, campi, et); disegna(); return r; },
        nuova: function (campi) {
          if (C) campi[cfg.contesto.campo] = campi[cfg.contesto.campo] || idContesto();
          var r = R.nuova(campi); trattieni[r.id] = true; disegna(); return r;
        },
        apri: function (id) { editor(id); },
        disegna: function () { disegna(); },
        contesto: function () { return contestoCorrente(); },
        avviso: Fam.avviso
      };

      /* ---- contesto (es. il viaggio scelto) ---- */
      function contesti() {
        return C ? C.tutte().filter(function (c) { return !c.eliminato; })
          .sort(function (a, b) { return String(b[cfg.contesto.ordina || 'creatoIl'] || '').localeCompare(String(a[cfg.contesto.ordina || 'creatoIl'] || '')); }) : [];
      }
      function contestoCorrente() {
        var tutti = contesti();
        return tutti.filter(function (c) { return c.id === stato.contesto; })[0] || tutti[0] || null;
      }
      function idContesto() { var c = contestoCorrente(); return c ? c.id : ''; }

      /* ---- righe visibili ---- */
      function righe() {
        var idc = idContesto();
        return R.tutte().filter(function (r) {
          return !r.eliminato && !(cfg.nascondi && cfg.nascondi(r)) && (!C || r[cfg.contesto.campo] === idc);
        }).sort(cfg.ordina || function (a, b) { return String(a.creatoIl || '').localeCompare(String(b.creatoIl || '')); });
      }
      function filtri() { return typeof cfg.filtri === 'function' ? cfg.filtri(api) : (cfg.filtri || []); }
      function filtro() { return filtri().filter(function (f) { return f.id === stato.filtro; })[0] || null; }
      function corrisponde(r) {
        if (!stato.cerca) return true;
        var q = U.semplice(stato.cerca);
        return cfg.campi.some(function (c) { return U.semplice(r[c.k]).indexOf(q) >= 0; });
      }
      function visibili() {
        var f = filtro();
        return righe().filter(function (r) { return trattieni[r.id] || ((!f || f.f(r, api)) && corrisponde(r)); });
      }

      /* ---- scheletro della pagina ---- */
      var banner = h('div', { class: 'banner', id: 'bannerCloud', hidden: true },
        h('b', { text: 'Il salvataggio condiviso non è attivo in questo momento. ' }), 'Quello che scrivi resta su questo dispositivo e parte appena il cloud risponde.');
      var riep = h('section', { class: 'riepilogo', 'aria-label': 'Riepilogo' });
      var barraContesto = h('div', { class: 'barra-contesto' });
      var cerca = h('input', { type: 'search', class: 'cerca', placeholder: 'Cerca…', 'aria-label': 'Cerca', oninput: function () { stato.cerca = this.value.trim(); trattieni = {}; disegna(); } });
      var chips = h('div', { class: 'filtri', role: 'group', 'aria-label': 'Filtri' });
      var tendina = h('div', { class: 'tendina', hidden: true });
      var btnAltro = h('button', { type: 'button', class: 'btn', text: 'Altro ▾', 'aria-haspopup': 'true', onclick: function (e) { e.stopPropagation(); tendina.hidden = !tendina.hidden; } });
      document.addEventListener('click', function () { tendina.hidden = true; });
      var azioni = (cfg.azioni || []).concat([
        { testo: '🗑️ Cestino', fai: cestino },
        { testo: '🖨️ Stampa', fai: stampa },
        { testo: '👥 Componenti della famiglia', fai: function () { Fam.gestisciPersone(disegna); } },
        { testo: '🔄 Aggiorna adesso', fai: function () { Fam.sincronizzaTutto(true).then(function () { Fam.avviso('Aggiornato'); }); } }
      ]);
      azioni.forEach(function (a) { tendina.appendChild(h('button', { type: 'button', text: a.testo, onclick: function () { tendina.hidden = true; a.fai(api); } })); });
      var btnNuovo = h('button', { type: 'button', class: 'btn primario', text: '＋ ' + (cfg.nuovoTesto || 'Aggiungi'), onclick: function () { editor(null); } });
      var strumenti = h('div', { class: 'strumenti' }, cerca, chips, h('div', { class: 'spinta' }, btnNuovo, h('div', { class: 'menu-pop' }, btnAltro, tendina)));

      var rapidaCampo = null, rapidaLista = null, rapida = null;
      if (cfg.rapida) {
        rapidaLista = h('datalist', { id: 'dl-rapida' });
        rapidaCampo = h('input', { type: 'text', list: 'dl-rapida', placeholder: cfg.rapida.segnaposto || 'Aggiungi…', 'aria-label': cfg.rapida.segnaposto || 'Aggiungi', maxlength: 120, autocomplete: 'off' });
        rapida = h('form', { class: 'rapida', onsubmit: function (e) {
          e.preventDefault();
          var t = rapidaCampo.value.trim(); if (!t) return;
          if (cfg.rapida.aggiungi) cfg.rapida.aggiungi(t, api);
          else { var c = {}; c[cfg.rapida.campo] = t; api.nuova(c); }
          rapidaCampo.value = ''; rapidaCampo.focus();
        } }, rapidaCampo, rapidaLista, h('button', { class: 'btn primario', text: 'Aggiungi' }));
      }
      var lista = h('div', { class: 'voci', 'aria-live': 'polite' });
      var piede = h('div', { class: 'piede-pagina' });
      app.appendChild(h('div', null, banner, barraContesto, riep, rapida, strumenti, lista, piede));

      /* ---- disegno ---- */
      function disegna() {
        chi.textContent = '👤 ' + (Fam.io() || 'Chi sei?');
        disegnaContesto();
        var tutte = righe(), vis = visibili();

        svuota(riep);
        (cfg.riepilogo ? cfg.riepilogo(tutte, api) : []).forEach(function (c) {
          var box = h('div', { class: 'cifra ' + (c.cls || '') }, c.ico ? h('i', { class: 'ico', 'aria-hidden': 'true', text: c.ico }) : null,
            h('b', { text: c.valore }), h('span', { text: c.etichetta }));
          if (c.barra !== undefined) box.appendChild(h('div', { class: 'barra' + (c.barra > 1 ? ' sopra' : '') }, h('i', { style: 'width:' + Math.min(100, Math.round(c.barra * 100)) + '%' })));
          riep.appendChild(box);
        });
        riep.hidden = !riep.firstChild;

        svuota(chips);
        filtri().forEach(function (f) {
          chips.appendChild(h('button', { type: 'button', class: 'chip', 'aria-pressed': String(stato.filtro === f.id), onclick: function () {
            stato.filtro = f.id; Fam.ls(chiaveLS + 'filtro', f.id); trattieni = {}; disegna();
          } }, f.testo, h('span', { class: 'n', text: tutte.filter(function (r) { return f.f(r, api); }).length })));
        });

        if (rapidaLista && cfg.rapida.suggerimenti) {
          svuota(rapidaLista);
          cfg.rapida.suggerimenti(api).slice(0, 200).forEach(function (s) { rapidaLista.appendChild(h('option', { value: s })); });
        }

        svuota(lista);
        if (C && !contestoCorrente()) {
          lista.appendChild(h('div', { class: 'vuoto' }, h('p', { text: cfg.contesto.vuoto || 'Crea il primo per cominciare.' }),
            h('button', { type: 'button', class: 'btn primario', text: '＋ ' + cfg.contesto.nuovo, onclick: function () { editorContesto(null); } })));
          btnNuovo.disabled = true; if (rapida) rapida.hidden = true;
          return;
        }
        btnNuovo.disabled = false; if (rapida) rapida.hidden = false;
        if (!vis.length) {
          lista.appendChild(h('div', { class: 'vuoto', text: !tutte.length ? (cfg.vuoto || 'Ancora niente qui: aggiungi la prima voce.') : stato.cerca ? 'Nessun risultato per «' + stato.cerca + '».' : 'Niente in «' + (filtro() ? filtro().testo : '') + '».' }));
        }
        var gruppoPrec = null, contenitore = lista;
        vis.forEach(function (r) {
          if (cfg.gruppo) {
            var g = cfg.gruppo(r, api) || '';
            if (g !== gruppoPrec) {
              gruppoPrec = g;
              contenitore = h('div', { class: 'gruppo' });
              lista.appendChild(h('h3', { class: 'gruppo-titolo', text: g }));
              lista.appendChild(contenitore);
            }
          }
          contenitore.appendChild(voce(r));
        });

        var ultima = tutte.slice().sort(function (a, b) { return String(b.modIl || '').localeCompare(String(a.modIl || '')); })[0];
        piede.textContent = ultima && ultima.modIl ? 'Ultima modifica: ' + (ultima.modDa || '?') + ', ' + Fam.quando(ultima.modIl) : '';
      }

      function voce(r) {
        var b = cfg.badge ? cfg.badge(r, api) : null;
        var spunta = null;
        if (cfg.spunta) {
          spunta = h('input', { type: 'checkbox', checked: !!r[cfg.spunta], 'aria-label': 'Segna ' + (cfg.titoloVoce ? cfg.titoloVoce(r, api) : ''), onclick: function (e) { e.stopPropagation(); },
            onchange: function () {
              var v = spunta.checked;
              if (cfg.dopoSpunta && cfg.dopoSpunta(r, v, api)) return;
              var c = {}; c[cfg.spunta] = v; api.imposta(r.id, c, cfg.spunta);
            } });
        }
        var sotto = cfg.sottoVoce ? cfg.sottoVoce(r, api) : '';
        var el = h('div', { class: 'voce' + (cfg.spunta && r[cfg.spunta] ? ' fatta' : '') + (b && b.tipo ? ' st-' + b.tipo : ''), 'data-id': r.id },
          spunta ? h('label', { class: 'voce-spunta' }, spunta) : null,
          h('button', { type: 'button', class: 'voce-corpo', onclick: function () { editor(r.id); } },
            h('span', { class: 'voce-titolo', text: cfg.titoloVoce ? cfg.titoloVoce(r, api) : (r[cfg.campi[0].k] || '') }),
            sotto ? h('span', { class: 'voce-sotto', text: sotto }) : null,
            r.modDa && r.modDa !== Fam.io() && Date.now() - new Date(r.modIl).getTime() < 3 * 864e5 ? h('span', { class: 'voce-mod', text: '✎ ' + r.modDa + ', ' + Fam.quando(r.modIl) }) : null),
          b && b.testo ? h('span', { class: 'badge ' + (b.tipo || ''), text: b.testo }) : null,
          cfg.extraVoce ? cfg.extraVoce(r, api) : null
        );
        return el;
      }

      /* ---- finestra di modifica ---- */
      function editor(id) {
        var r = id ? R.prendi(id) : null;
        var inputs = {};
        var corpo = cfg.campi.filter(function (c) { return !c.soloLettura; }).map(function (c) {
          var v = r ? r[c.k] : (typeof c.predefinito === 'function' ? c.predefinito(api) : c.predefinito);
          var el = inputs[c.k] = creaInput(c, v, api);
          if (c.tipo === 'spunta') return h('label', { class: 'campo campo-spunta' }, el, h('span', { text: c.etichetta }));
          return h('label', { class: 'campo' + (c.mezzo ? ' mezzo' : '') }, h('span', { text: c.etichetta }), el, el._lista || null,
            c.aiuto ? h('small', { class: 'tenue', text: c.aiuto }) : null);
        });
        var info = r && r.modDa ? h('p', { class: 'tenue piccolo', text: (r.creatoDa ? 'Aggiunto da ' + r.creatoDa + ', ' + Fam.quando(r.creatoIl) + ' · ' : '') + 'ultima modifica di ' + r.modDa + ', ' + Fam.quando(r.modIl) }) : null;
        var extra = r && cfg.extraEditor ? cfg.extraEditor(r, api) : null;
        var pulsanti = [];
        if (r) pulsanti.push({ testo: 'Elimina', pericolo: true, azione: function () {
          api.imposta(r.id, { eliminato: true }, 'eliminato');
          Fam.avviso('Spostato nel cestino (si recupera da «Altro»)');
        } });
        pulsanti.push({ testo: 'Annulla' });
        pulsanti.push({ testo: r ? 'Salva' : 'Aggiungi', primario: true, azione: function () {
          var campi = {}, manca = null;
          cfg.campi.forEach(function (c) {
            if (c.soloLettura || !inputs[c.k]) return;
            var v = leggiInput(c, inputs[c.k]);
            if (c.obbligatorio && (v === null || v === '')) manca = manca || c;
            if (!r || JSON.stringify(r[c.k] === undefined ? null : r[c.k]) !== JSON.stringify(v)) campi[c.k] = v;
          });
          if (manca) { Fam.avviso('Manca: ' + manca.etichetta, { tipo: 'ko' }); inputs[manca.k].focus(); return false; }
          if (cfg.primaDiSalvare) cfg.primaDiSalvare(campi, r, api);
          if (r) { if (Object.keys(campi).length) api.imposta(r.id, campi, Object.keys(campi)[0]); }
          else api.nuova(campi);
        } });
        var d = Fam.dialogo(r ? (cfg.titoloVoce ? cfg.titoloVoce(r, api) : 'Modifica') : (cfg.nuovoTesto || 'Nuovo'),
          [h('div', { class: 'griglia-campi' }, corpo), extra, info], pulsanti, { largo: cfg.campi.length > 6 });
        var primo = d.querySelector('input:not([type=checkbox]),textarea,select');
        if (primo && !r) setTimeout(function () { primo.focus(); }, 50);
        d.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
            e.preventDefault(); d.querySelector('.dlg-piede .btn.primario').click();
          }
        });
      }

      /* ---- contesto: barra e finestra ---- */
      function disegnaContesto() {
        if (!C) { barraContesto.hidden = true; return; }
        svuota(barraContesto);
        var cc = contestoCorrente(), tutti = contesti();
        if (tutti.length) {
          var sel = h('select', { class: 'selettore-lista', 'aria-label': cfg.contesto.etichetta, onchange: function () {
            stato.contesto = sel.value; Fam.ls(chiaveLS + 'contesto', sel.value); trattieni = {}; disegna();
          } }, tutti.map(function (c) { return h('option', { value: c.id, text: c.titolo || '?' }); }));
          sel.value = cc ? cc.id : '';
          barraContesto.appendChild(sel);
          if (cc && cfg.contesto.descr) barraContesto.appendChild(h('span', { class: 'tenue', text: cfg.contesto.descr(cc, api) }));
          barraContesto.appendChild(h('button', { type: 'button', class: 'btn piccolo', text: '✏️ Modifica', onclick: function () { editorContesto(cc.id); } }));
        }
        barraContesto.appendChild(h('button', { type: 'button', class: 'btn piccolo', text: '＋ ' + cfg.contesto.nuovo, onclick: function () { editorContesto(null); } }));
      }
      function editorContesto(id) {
        var c = id ? C.prendi(id) : null, inputs = {};
        var corpo = cfg.contesto.campi.map(function (f) {
          var el = inputs[f.k] = creaInput(f, c ? c[f.k] : f.predefinito, api);
          return h('label', { class: 'campo' + (f.mezzo ? ' mezzo' : '') }, h('span', { text: f.etichetta }), el);
        });
        var pulsanti = [];
        if (c) pulsanti.push({ testo: 'Elimina', pericolo: true, azione: function () { C.imposta(c.id, { eliminato: true }, 'eliminato'); stato.contesto = ''; disegna(); } });
        pulsanti.push({ testo: 'Annulla' });
        pulsanti.push({ testo: c ? 'Salva' : 'Crea', primario: true, azione: function () {
          var campi = {};
          cfg.contesto.campi.forEach(function (f) { campi[f.k] = leggiInput(f, inputs[f.k]); });
          if (!campi.titolo) { Fam.avviso('Dagli un nome', { tipo: 'ko' }); return false; }
          if (c) C.imposta(c.id, campi, 'titolo');
          else {
            var n = C.nuova(campi); stato.contesto = n.id; Fam.ls(chiaveLS + 'contesto', n.id);
            if (cfg.contesto.dopoCreazione) cfg.contesto.dopoCreazione(n, api);
          }
          disegna();
        } });
        Fam.dialogo(c ? 'Modifica ' + cfg.contesto.etichetta.toLowerCase() : cfg.contesto.nuovo, h('div', { class: 'griglia-campi' }, corpo), pulsanti);
      }

      /* ---- cestino e stampa ---- */
      function cestino() {
        var box = h('div');
        function riempi() {
          svuota(box);
          var via = R.tutte().filter(function (r) { return r.eliminato; })
            .sort(function (a, b) { return String(b.modIl || '').localeCompare(String(a.modIl || '')); });
          if (!via.length) { box.appendChild(h('p', { class: 'tenue', text: 'Il cestino è vuoto.' })); return; }
          via.forEach(function (r) {
            box.appendChild(h('div', { class: 'riga-persona' },
              h('span', { text: cfg.titoloVoce ? cfg.titoloVoce(r, api) : r[cfg.campi[0].k] }),
              h('button', { type: 'button', class: 'btn piccolo', text: 'Ripristina', onclick: function () { api.imposta(r.id, { eliminato: false }, 'eliminato'); riempi(); } })));
          });
        }
        riempi();
        Fam.dialogo('Cestino', box);
      }
      function stampa() {
        var box = document.getElementById('stampa') || document.body.appendChild(h('div', { id: 'stampa' }));
        svuota(box);
        box.appendChild(h('h1', { text: document.title + (C && contestoCorrente() ? ' · ' + contestoCorrente().titolo : '') }));
        box.appendChild(h('p', { text: 'Stampato il ' + new Date().toLocaleDateString('it-IT') }));
        var vis = visibili(), gp = null;
        var ul = h('ul');
        vis.forEach(function (r) {
          if (cfg.gruppo) { var g = cfg.gruppo(r, api); if (g !== gp) { gp = g; box.appendChild(ul = h('ul')); ul.before(h('h2', { text: g })); } }
          ul.appendChild(h('li', null, cfg.spunta ? (r[cfg.spunta] ? '☑ ' : '☐ ') : '', h('b', { text: cfg.titoloVoce ? cfg.titoloVoce(r, api) : '' }),
            cfg.sottoVoce && cfg.sottoVoce(r, api) ? ' — ' + cfg.sottoVoce(r, api) : ''));
        });
        if (!cfg.gruppo) box.appendChild(ul);
        window.print();
      }

      /* ---- eventi ---- */
      R.su(function (tipo, dati) {
        if (tipo === 'remoto' || tipo === 'locale') disegna();
        if (tipo === 'novita') {
          var chi2 = dati[0].modDa, nomi = dati.slice(0, 3).map(function (r) { return cfg.novita ? cfg.novita(r) : (cfg.titoloVoce ? cfg.titoloVoce(r, api) : ''); }).join(', ');
          Fam.avviso('✎ ' + chi2 + ' ha aggiornato: ' + nomi + (dati.length > 3 ? ' e altri ' + (dati.length - 3) : ''), { durata: 7000 });
        }
      });
      if (C) C.su(function (t) { if (t === 'remoto') disegna(); });
      Fam.raccolta('persone').su(function (t) { if (t === 'remoto') disegna(); });
      Fam.su(function (t) { if (t === 'io') disegna(); });

      disegna();
      var prime = [R.sincronizza(), Fam.raccolta('persone').sincronizza()];
      if (C) prime.push(C.sincronizza());
      Promise.all(prime).then(function () { if (cfg.dopoAvvio) cfg.dopoAvvio(api); disegna(); });
    });
  }

  /* Ogni file di sezione si registra qui; la pagina parte da sola leggendo
     <body data-sezione="…">, e la home usa le stesse definizioni per
     scrivere sotto ogni riquadro lo stato del momento (funzione home()). */
  var definite = {};
  function definisci(id, cfg) { cfg.id = id; definite[id] = cfg; }
  function righeAttive(cfg) {
    return Fam.raccolta(cfg.raccolta).tutte().filter(function (r) { return !r.eliminato && !(cfg.nascondi && cfg.nascondi(r)); });
  }
  document.addEventListener('DOMContentLoaded', function () {
    var id = document.body.getAttribute('data-sezione');
    if (id && definite[id]) avvia(definite[id]);
  });

  G.Sezione = { avvia: avvia, U: U, definisci: definisci, definite: definite, righeAttive: righeAttive };
})(window);
