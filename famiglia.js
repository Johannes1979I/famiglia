/* =========================================================================
   famiglia.js — il cuore condiviso dell'app di famiglia.

   Ogni sezione (oggi i regali, domani spesa, scadenze, compleanni…) usa
   questo file per tre cose:
     1. sapere QUALE famiglia: una chiave lunga e casuale che sta nel link
        d'invito (#k=…). Chi non ha la chiave non vede niente, e l'elenco
        delle famiglie non è leggibile da nessuno;
     2. sapere CHI sta usando questo dispositivo (per «modificato da…»);
     3. salvare e leggere i dati su Firestore, con una copia sul dispositivo
        che permette di lavorare anche senza rete: le modifiche partono
        appena la rete torna.

   Niente SDK, niente CDN: solo chiamate REST con fetch.
   Mai innerHTML con dati: tutto passa da textContent (funzione h()).
   ========================================================================= */
(function (G) {
  'use strict';

  var CFG = {
    apiKey: 'AIzaSyCB1Opg-CGCPTx4JDl7QNPYHMHVChYnHcw',
    projectId: 'residence-holiday-ef6e9'
  };
  var BASE = 'https://firestore.googleapis.com/v1/projects/' + CFG.projectId +
             '/databases/(default)/documents';

  var PROVA = /[?&]prova=1/.test(location.search);   // banco di prova: server finto
  var K = null;                                       // chiave della famiglia

  /* ------------------------------------------------------------ utilità */
  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { return null; }
  }
  function lsJson(k, def) { try { var s = ls(k); return s ? JSON.parse(s) : def; } catch (e) { return def; } }

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'value' || k === 'checked' || k === 'selected') el[k] = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) aggiungi(el, arguments[i]);
    return el;
  }
  function aggiungi(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { aggiungi(el, x); }); return; }
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  function svuota(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  function nuovaChiave() {
    var b = new Uint8Array(24);
    crypto.getRandomValues(b);
    return btoa(String.fromCharCode.apply(null, b))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function nuovoId() {
    var b = new Uint8Array(6); crypto.getRandomValues(b);
    return Date.now().toString(36) + Array.prototype.map.call(b, function (x) {
      return ('0' + x.toString(16)).slice(-2);
    }).join('');
  }

  /* --------------------------------------------- chiave della famiglia */
  function parametriHash() {
    var o = {};
    location.hash.replace(/^#/, '').split('&').forEach(function (p) {
      var i = p.indexOf('=');
      if (i > 0) o[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1));
    });
    return o;
  }
  function chiaveValida(k) { return typeof k === 'string' && /^[A-Za-z0-9_-]{32,}$/.test(k); }
  function chiaveDaTesto(t) {
    var m = /[#&]k=([A-Za-z0-9_-]{32,})/.exec(t || '') || /^\s*([A-Za-z0-9_-]{32,})\s*$/.exec(t || '');
    return m ? m[1] : null;
  }
  /* Teniamo la chiave anche nell'indirizzo: così un segnalibro o l'icona
     «Aggiungi a Home» (che su iPhone ha una memoria sua) la portano con sé. */
  function scriviHash(extra) {
    var s = '#k=' + K + (extra || '');
    if (location.hash !== s) history.replaceState(null, '', location.pathname + location.search + s);
  }
  function impostaChiave(k) {
    K = k;
    ls('fam_chiave', k);
    scriviHash();
  }
  function linkInvito(pagina) {
    var dir = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
    return dir + (pagina || 'regali.html') + '#k=' + K;
  }

  /* ------------------------------------------------------- chi sono io */
  function lsIo() { return 'fam_io_' + (K || '').slice(0, 10); }
  function io() {
    var m = /[?&]io=([^&]+)/.exec(location.search);       // solo per le prove
    if (m) return decodeURIComponent(m[1]);
    return ls(lsIo()) || '';
  }
  function impostaIo(nome) { ls(lsIo(), nome); emettiGlobale('io'); }

  /* --------------------------------------- conversione dei valori Firestore */
  function aValore(v) {
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number' && isFinite(v)) return { doubleValue: v };
    if (v === null || v === undefined || v === '') return { nullValue: null };
    return { stringValue: String(v) };
  }
  function daValore(v) {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('doubleValue' in v) return Number(v.doubleValue);
    if ('integerValue' in v) return Number(v.integerValue);
    return null;
  }
  function daDoc(doc) {
    var o = { id: doc.name.split('/').pop(), _agg: doc.updateTime || '' };
    var f = doc.fields || {};
    Object.keys(f).forEach(function (k) { o[k] = daValore(f[k]); });
    return o;
  }

  /* ----------------------------------------------------- REST Firestore */
  function errore(msg, status) {
    var e = new Error(msg); e.status = status;
    e.permessi = status === 403 || status === 401;
    return e;
  }
  function chiama(metodo, percorso, query, corpo) {
    if (PROVA) return Finto.chiama(metodo, percorso, query, corpo);
    var url = BASE + '/famiglia/' + K + (percorso ? '/' + percorso : '') +
              '?key=' + CFG.apiKey + (query || '');
    var opz = { method: metodo, cache: 'no-store' };
    if (corpo) { opz.headers = { 'Content-Type': 'application/json' }; opz.body = JSON.stringify(corpo); }
    return fetch(url, opz).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw errore((d.error && d.error.message) || ('HTTP ' + r.status), r.status);
        return d;
      });
    });
  }
  function elenca(collezione) {
    var tutti = [];
    function pagina(tok) {
      return chiama('GET', collezione, '&pageSize=300' + (tok ? '&pageToken=' + encodeURIComponent(tok) : ''))
        .then(function (d) {
          (d.documents || []).forEach(function (doc) { tutti.push(daDoc(doc)); });
          return d.nextPageToken ? pagina(d.nextPageToken) : tutti;
        });
    }
    return pagina();
  }
  function salva(percorso, campi) {
    var q = '', fields = {};
    Object.keys(campi).forEach(function (k) {
      q += '&updateMask.fieldPaths=' + encodeURIComponent(k);
      fields[k] = aValore(campi[k]);
    });
    return chiama('PATCH', percorso, q, { fields: fields });
  }

  /* Il documento della famiglia (famiglia/<chiave>) tiene, per ogni
     raccolta, l'ora dell'ultima scrittura (v_regali, v_spesa…). Prima di
     rileggere una raccolta intera si legge solo lui: 1 lettura invece di
     decine, così la quota gratuita di Firestore basta e avanza. */
  var infoPromessa = null, infoQuando = 0;
  function leggiInfo() {
    if (infoPromessa && Date.now() - infoQuando < 2500) return infoPromessa;
    infoQuando = Date.now();
    infoPromessa = chiama('GET', '', '').then(daDoc, function (e) {
      if (e && e.status === 404) return {};
      throw e;
    });
    return infoPromessa;
  }
  function segnaVersione(nome) {
    var c = {}; c['v_' + nome] = new Date().toISOString();
    infoPromessa = null;
    return salva('', c);
  }

  /* Server finto per il banco di prova (?prova=1): sta nel localStorage,
     così due schede aperte si comportano come due telefoni. */
  var Finto = {
    db: function () { return lsJson('fam_finto_server', {}); },
    chiama: function (metodo, percorso, query, corpo) {
      return new Promise(function (ok, ko) {
        setTimeout(function () {
          if (ls('fam_finto_spento') === '1') return ko(new TypeError('Failed to fetch'));
          if (ls('fam_finto_negato') === '1') return ko(errore('Missing or insufficient permissions.', 403));
          var db = Finto.db(), pre = K + (percorso ? '/' + percorso : '');
          if (metodo === 'GET' && db[pre]) return ok(db[pre]);
          if (metodo === 'GET' && !percorso) return ko(errore('not found', 404));
          if (metodo === 'GET') {
            var docs = Object.keys(db).filter(function (p) {
              return p.indexOf(pre + '/') === 0 && p.slice(pre.length + 1).indexOf('/') < 0;
            }).map(function (p) { return db[p]; });
            return ok({ documents: docs });
          }
          var d = db[pre] || { name: 'x/' + pre, fields: {} };
          Object.keys(corpo.fields).forEach(function (k) { d.fields[k] = corpo.fields[k]; });
          d.updateTime = new Date().toISOString();
          db[pre] = d;
          ls('fam_finto_server', JSON.stringify(db));
          ok(d);
        }, 120);
      });
    }
  };

  /* ---------------------------------------------------------- eventi */
  var ascoltatoriGlobali = [];
  function suGlobale(fn) { ascoltatoriGlobali.push(fn); }
  function emettiGlobale(tipo, dati) { ascoltatoriGlobali.forEach(function (fn) { fn(tipo, dati); }); }

  /* =====================================================================
     Raccolta: una collezione (es. «regali») tenuta in sincronia.
     - ogni modifica si salva subito sul dispositivo e parte verso il cloud
       dopo un attimo, SOLO con i campi toccati: se tu cambi le idee e tua
       moglie spunta «fatto» sulla stessa riga, non vi pestate i piedi;
     - ogni 15 secondi (e quando si torna sull'app) si rilegge dal cloud;
     - i cambi fatti dall'altra persona arrivano come «novità».
     ===================================================================== */
  var raccolte = {};
  function Raccolta(nome) {
    this.nome = nome;
    this.chiaveLS = 'fam_' + K.slice(0, 10) + '_' + nome + (PROVA ? '_' + io() : '');   // in prova ogni «persona» ha la sua copia
    var c = lsJson(this.chiaveLS, {});
    this.righe = c.righe || {};
    this.sporchi = c.sporchi || {};
    this.ultimaVista = c.ultimaVista || '';
    this.versione = c.versione || '';
    this.sincronizzata = false;     // almeno una lettura dal cloud riuscita
    this.ascoltatori = [];
    this._timer = null;
    this._inCorso = null;
  }
  Raccolta.prototype.su = function (fn) { this.ascoltatori.push(fn); };
  Raccolta.prototype._emetti = function (tipo, dati) {
    var self = this;
    this.ascoltatori.forEach(function (fn) { fn(tipo, dati, self); });
  };
  Raccolta.prototype._registra = function () {
    ls(this.chiaveLS, JSON.stringify({ righe: this.righe, sporchi: this.sporchi, ultimaVista: this.ultimaVista, versione: this.versione }));
  };
  Raccolta.prototype.tutte = function () {
    var r = this.righe;
    return Object.keys(r).map(function (id) { return r[id]; });
  };
  Raccolta.prototype.prendi = function (id) { return this.righe[id] || null; };
  Raccolta.prototype.inAttesa = function () { return Object.keys(this.sporchi).length; };

  Raccolta.prototype.imposta = function (id, campi, etichetta) {
    var r = this.righe[id] || (this.righe[id] = { id: id });
    var s = this.sporchi[id] || (this.sporchi[id] = {});
    var meta = { modDa: io(), modIl: new Date().toISOString(), modCampo: etichetta || Object.keys(campi)[0] || '' };
    if (!r.creatoIl) { meta.creatoIl = meta.modIl; meta.creatoDa = meta.modDa; }
    Object.keys(campi).concat(Object.keys(meta)).forEach(function (k) {
      r[k] = (k in campi) ? campi[k] : meta[k];
      s[k] = true;
    });
    this._registra();
    this._emetti('locale', r);
    emettiGlobale('stato');
    this._programma(700);
    return r;
  };
  Raccolta.prototype.nuova = function (campi, id) {
    return this.imposta(id || nuovoId(), campi, 'nuova');
  };

  Raccolta.prototype._programma = function (ms) {
    var self = this;
    clearTimeout(this._timer);
    this._timer = setTimeout(function () { self.sincronizza(); }, ms);
  };

  Raccolta.prototype._spingi = function () {
    var self = this;
    var ids = Object.keys(this.sporchi);
    if (!ids.length) return Promise.resolve();
    return ids.reduce(function (p, id) {
      return p.then(function () {
        var s = self.sporchi[id], r = self.righe[id];
        if (!s || !r) return;
        var inviati = {};
        Object.keys(s).forEach(function (k) { inviati[k] = r[k] === undefined ? null : r[k]; });
        return salva(self.nome + '/' + id, inviati).then(function (doc) {
          var s2 = self.sporchi[id];
          if (s2) Object.keys(inviati).forEach(function (k) {
            // se nel frattempo l'hai cambiato ancora, resta da mandare
            if (JSON.stringify(self.righe[id][k]) === JSON.stringify(inviati[k])) delete s2[k];
          });
          if (s2 && !Object.keys(s2).length) delete self.sporchi[id];
          if (doc && doc.updateTime) self.righe[id]._agg = doc.updateTime;
          self._registra();
        });
      });
    }, Promise.resolve()).then(function () { return segnaVersione(self.nome); });
  };

  Raccolta.prototype.sincronizza = function (forza) {
    var self = this, versione = '';
    if (this._inCorso) { this._ancora = true; return this._inCorso; }
    clearTimeout(this._timer);
    this.stato = 'salvo';
    emettiGlobale('stato');
    this._inCorso = this._spingi().then(function () {
      return leggiInfo();
    }).then(function (info) {
      versione = info['v_' + self.nome] || '';
      if (!forza && self.sincronizzata && versione === self.versione) return null;   // niente di nuovo
      return elenca(self.nome);
    }).then(function (remoti) {
      if (remoti === null) { self.stato = 'ok'; self.errore = null; return; }
      self.versione = versione;
      var visti = {}, novita = [], soglia = self.ultimaVista, massimo = soglia, cambiato = false;
      remoti.forEach(function (rr) {
        visti[rr.id] = true;
        var loc = self.righe[rr.id], s = self.sporchi[rr.id] || {};
        if (!loc) { self.righe[rr.id] = rr; cambiato = true; }
        else Object.keys(rr).forEach(function (k) {
          if (s[k]) return;
          if (JSON.stringify(loc[k]) !== JSON.stringify(rr[k])) { loc[k] = rr[k]; if (k !== '_agg') cambiato = true; }
        });
        if (rr._agg && rr._agg > massimo) massimo = rr._agg;
        if (soglia && rr._agg > soglia && rr.modDa && rr.modDa !== io()) novita.push(self.righe[rr.id]);
      });
      Object.keys(self.righe).forEach(function (id) {
        if (!visti[id] && !self.sporchi[id]) { delete self.righe[id]; cambiato = true; }
      });
      self.ultimaVista = massimo || new Date().toISOString();
      self.sincronizzata = true;
      self.stato = 'ok';
      self.errore = null;
      self._registra();
      if (cambiato) self._emetti('remoto');
      if (novita.length) self._emetti('novita', novita);
    }).catch(function (e) {
      self.stato = e && e.permessi ? 'permessi' : (e instanceof TypeError ? 'offline' : 'errore');
      self.errore = e;
      if (G.console) console.warn('[famiglia] ' + self.nome + ':', e && e.message);
    }).then(function () {
      self._inCorso = null;
      emettiGlobale('stato');
      self._emetti('fine');
      if (self._ancora) { self._ancora = false; self._programma(50); }
    });
    return this._inCorso;
  };

  function raccolta(nome) {
    return raccolte[nome] || (raccolte[nome] = new Raccolta(nome));
  }
  function sincronizzaTutto(forza) {
    return Promise.all(Object.keys(raccolte).map(function (n) { return raccolte[n].sincronizza(forza === true); }));
  }
  function statoGenerale() {
    var st = 'ok', attesa = 0, n;
    for (n in raccolte) {
      var r = raccolte[n]; attesa += r.inAttesa();
      if (r.stato === 'permessi') st = 'permessi';
      else if (r.stato === 'offline' && st !== 'permessi') st = 'offline';
      else if (r.stato === 'errore' && st === 'ok') st = 'errore';
      else if (r.stato === 'salvo' && st === 'ok') st = 'salvo';
    }
    return { stato: st, attesa: attesa };
  }

  var giroAvviato = false;
  function avviaGiro() {
    if (giroAvviato) return; giroAvviato = true;
    setInterval(function () { if (!document.hidden) sincronizzaTutto(); }, 20000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) sincronizzaTutto(); });
    G.addEventListener('focus', sincronizzaTutto);
    G.addEventListener('online', sincronizzaTutto);
  }

  /* ------------------------------------------------------- membri */
  function membri() {
    return raccolta('membri').tutte().filter(function (m) { return !m.eliminato && m.nome; })
      .sort(function (a, b) { return (a.creatoIl || '').localeCompare(b.creatoIl || ''); })
      .map(function (m) { return m.nome; });
  }
  function aggiungiMembro(nome) {
    nome = String(nome || '').trim();
    if (!nome) return;
    var id = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || nuovoId();
    if (!raccolta('membri').prendi(id)) raccolta('membri').imposta(id, { nome: nome });
  }

  /* Persone della famiglia: chi usa l'app (membri) più chi non la usa
     (i figli, i nonni…), che si aggiungono da «Componenti della famiglia». */
  function persone() {
    var visti = {}, out = [];
    membri().concat(raccolta('persone').tutte().filter(function (p) { return !p.eliminato && p.nome; })
      .sort(function (a, b) { return (a.creatoIl || '').localeCompare(b.creatoIl || ''); })
      .map(function (p) { return p.nome; }))
      .forEach(function (n) { if (!visti[n]) { visti[n] = 1; out.push(n); } });
    return out;
  }
  function gestisciPersone(poi) {
    var P = raccolta('persone'), box = h('div');
    function disegna() {
      svuota(box);
      membri().forEach(function (n) {
        box.appendChild(h('div', { class: 'riga-persona' }, h('span', { text: '👤 ' + n }), h('span', { class: 'tenue piccolo', text: 'usa l\'app' })));
      });
      P.tutte().filter(function (p) { return !p.eliminato && p.nome; }).forEach(function (p) {
        box.appendChild(h('div', { class: 'riga-persona' }, h('span', { text: '🧒 ' + p.nome }),
          h('button', { type: 'button', class: 'btn piccolo', text: 'Togli', onclick: function () { P.imposta(p.id, { eliminato: true }, 'eliminato'); disegna(); } })));
      });
    }
    var campo = h('input', { type: 'text', placeholder: 'Nome (es. un figlio, un nonno)', maxlength: 40 });
    disegna();
    dialogo('Componenti della famiglia', [
      h('p', { class: 'tenue', text: 'Compaiono nelle scelte «per chi» di salute, scuola, viaggi e spese. Chi usa l\'app si aggiunge da solo al primo accesso.' }),
      box,
      h('form', { class: 'riga-form', style: 'margin-top:12px', onsubmit: function (e) {
        e.preventDefault(); var n = campo.value.trim(); if (!n) return;
        if (persone().indexOf(n) < 0) P.nuova({ nome: n });
        campo.value = ''; disegna();
      } }, campo, h('button', { class: 'btn primario', text: 'Aggiungi' }))
    ], null, { allaChiusura: poi });
  }

  /* ------------------------------------------------------- interfaccia */
  function dialogo(titolo, contenuto, pulsanti, opz) {
    opz = opz || {};
    var d = h('dialog', { class: 'dlg' + (opz.largo ? ' largo' : '') });
    var chiudi = function () { d.close(); };
    var piede = h('div', { class: 'dlg-piede' });
    (pulsanti || [{ testo: 'Chiudi' }]).forEach(function (p) {
      piede.appendChild(h('button', {
        type: 'button', class: 'btn' + (p.primario ? ' primario' : '') + (p.pericolo ? ' pericolo' : ''),
        text: p.testo,
        onclick: function () { if (!p.azione || p.azione(d) !== false) chiudi(); }
      }));
    });
    d.appendChild(h('div', { class: 'dlg-testa' },
      h('h2', { text: titolo }),
      opz.senzaX ? null : h('button', { type: 'button', class: 'x', 'aria-label': 'Chiudi', text: '×', onclick: chiudi })));
    d.appendChild(h('div', { class: 'dlg-corpo' }, contenuto));
    d.appendChild(piede);
    if (opz.senzaX) d.addEventListener('cancel', function (e) { e.preventDefault(); });
    d.addEventListener('close', function () { if (opz.allaChiusura) opz.allaChiusura(); d.remove(); });
    document.body.appendChild(d);
    d.showModal();
    return d;
  }

  function avviso(testo, opz) {
    opz = opz || {};
    var box = document.getElementById('avvisi') || document.body.appendChild(h('div', { id: 'avvisi', 'aria-live': 'polite' }));
    var t = h('div', { class: 'avviso' + (opz.tipo ? ' ' + opz.tipo : '') }, testo);
    box.appendChild(t);
    setTimeout(function () { t.classList.add('via'); setTimeout(function () { t.remove(); }, 400); }, opz.durata || 4500);
  }

  function quando(iso) {
    if (!iso) return '';
    var d = new Date(iso), ora = new Date();
    var hh = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === ora.toDateString()) return 'oggi alle ' + hh;
    var ieri = new Date(ora); ieri.setDate(ora.getDate() - 1);
    if (d.toDateString() === ieri.toDateString()) return 'ieri alle ' + hh;
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + ' alle ' + hh;
  }

  /* Pillola dello stato di salvataggio, in alto a destra */
  function pillolaStato(el) {
    function aggiorna() {
      var s = statoGenerale(), testo, cls;
      if (s.stato === 'permessi') { testo = 'Cloud non attivo'; cls = 'ko'; }
      else if (s.stato === 'offline') { testo = 'Senza rete' + (s.attesa ? ' · ' + s.attesa + ' da inviare' : ''); cls = 'attesa'; }
      else if (s.stato === 'errore') { testo = 'Errore, riprovo'; cls = 'ko'; }
      else if (s.stato === 'salvo' || s.attesa) { testo = 'Salvataggio…'; cls = 'attesa'; }
      else { testo = 'Salvato'; cls = 'ok'; }
      el.className = 'pillola ' + cls;
      el.textContent = testo;
      el.title = s.stato === 'permessi'
        ? 'Firebase rifiuta la scrittura: manca la regola per «famiglia». Le modifiche restano su questo dispositivo.'
        : 'Ogni modifica si salva da sola e arriva anche sugli altri dispositivi.';
      var banner = document.getElementById('bannerCloud');
      if (banner) banner.hidden = s.stato !== 'permessi';
    }
    suGlobale(function (t) { if (t === 'stato') aggiorna(); });
    el.addEventListener('click', function () { sincronizzaTutto(); });
    aggiorna();
  }

  /* Finestra «Chi sei?» */
  function chiediChiSei(obbligatorio, poi) {
    var elenco = h('div', { class: 'scelte' });
    var d;
    function disegna() {
      svuota(elenco);
      membri().forEach(function (n) {
        elenco.appendChild(h('button', {
          type: 'button', class: 'btn scelta' + (n === io() ? ' primario' : ''), text: n,
          onclick: function () { impostaIo(n); d.close(); if (poi) poi(); }
        }));
      });
      if (!membri().length) elenco.appendChild(h('p', { class: 'tenue', text: 'Ancora nessun nome: scrivi il tuo qui sotto.' }));
    }
    var campo = h('input', { type: 'text', placeholder: 'Il tuo nome', autocomplete: 'given-name', maxlength: 40 });
    var form = h('form', { class: 'riga-form', onsubmit: function (e) {
      e.preventDefault();
      var n = campo.value.trim(); if (!n) return;
      aggiungiMembro(n); impostaIo(n); d.close(); if (poi) poi();
    } }, campo, h('button', { class: 'btn primario', text: 'Sono io' }));
    d = dialogo('Chi sei?', [
      h('p', { text: 'Serve per sapere chi ha fatto cosa. Lo chiede una volta sola per dispositivo.' }),
      elenco,
      h('p', { class: 'tenue piccolo', text: 'Non ci sei? Scrivi il tuo nome:' }),
      form
    ], obbligatorio ? [] : [{ testo: 'Annulla' }], { senzaX: obbligatorio });
    disegna();
    raccolta('membri').su(function (t) { if (t === 'remoto' && d.open) disegna(); });
  }

  /* Finestra «Invita» con link, WhatsApp e codice QR */
  function invita() {
    var link = linkInvito();
    var qr = h('div', { class: 'qr' });
    try {
      // QR.svg produce una stringa SVG generata da noi (solo il link): niente dati esterni.
      var svg = new DOMParser().parseFromString(G.QR.svg(link, { ecc: 'M', margin: 2 }), 'image/svg+xml').documentElement;
      qr.appendChild(document.importNode(svg, true));
    } catch (e) { qr.appendChild(h('p', { class: 'tenue', text: 'Codice QR non disponibile' })); }
    var campo = h('input', { type: 'text', readonly: true, value: link, onclick: function () { this.select(); } });
    var testo = 'Ecco la nostra lista dei regali di Natale: aprila da qui e salvala tra i preferiti (o «Aggiungi a Home»). ' + link;
    dialogo('Invita in famiglia', [
      h('p', { text: 'Manda questo link solo a chi deve vedere e modificare la lista: chi ce l\'ha entra senza password.' }),
      h('div', { class: 'invito' }, qr, h('div', { class: 'invito-azioni' },
        campo,
        h('button', { type: 'button', class: 'btn primario', text: 'Copia il link', onclick: function () {
          (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () {
            avviso('Link copiato');
          }, function () { campo.select(); document.execCommand('copy'); avviso('Link copiato'); });
        } }),
        h('a', { class: 'btn', href: 'https://wa.me/?text=' + encodeURIComponent(testo), target: '_blank', rel: 'noopener', text: 'Manda su WhatsApp' }),
        navigator.share ? h('button', { type: 'button', class: 'btn', text: 'Condividi…', onclick: function () {
          navigator.share({ title: 'Regali di Natale', text: testo }).catch(function () {});
        } }) : null,
        h('p', { class: 'tenue piccolo', text: 'Dal telefono: inquadra il codice con la fotocamera.' })
      ))
    ], null, { largo: true });
  }

  /* Prima apertura senza chiave: crea la famiglia o incolla un invito */
  function primaApertura(poi) {
    var tuo = h('input', { type: 'text', placeholder: 'Il tuo nome', maxlength: 40, autocomplete: 'given-name' });
    var incolla = h('input', { type: 'text', placeholder: 'Incolla qui il link che hai ricevuto' });
    var d = dialogo('Benvenuto', [
      h('p', { text: 'Hai ricevuto un link d\'invito? Incollalo qui:' }),
      h('form', { class: 'riga-form', onsubmit: function (e) {
        e.preventDefault();
        var k = chiaveDaTesto(incolla.value);
        if (!k) { avviso('Questo non sembra un link d\'invito valido', { tipo: 'ko' }); return; }
        impostaChiave(k); d.close(); poi();
      } }, incolla, h('button', { class: 'btn primario', text: 'Entra' })),
      h('hr'),
      h('p', { text: 'Oppure crea uno spazio nuovo per la tua famiglia:' }),
      h('form', { class: 'riga-form', onsubmit: function (e) {
        e.preventDefault();
        var n = tuo.value.trim(); if (!n) { tuo.focus(); return; }
        impostaChiave(nuovaChiave());
        aggiungiMembro(n); impostaIo(n);
        d.close(); poi({ nuova: true });
      } }, tuo, h('button', { class: 'btn', text: 'Crea' }))
    ], [], { senzaX: true });
  }

  /* Avvio comune a tutte le pagine */
  function avvio(poi) {
    var p = parametriHash();
    if (PROVA && !chiaveValida(p.k)) p.k = 'PROVA_PROVA_PROVA_PROVA_PROVA_PROVA';
    var k = chiaveValida(p.k) ? p.k : ls('fam_chiave');
    function pronto(info) {
      raccolta('membri');
      // link di prima configurazione: #k=…&membri=Nome1|Nome2
      if (p.membri) p.membri.split('|').forEach(aggiungiMembro);
      avviaGiro();
      var primo = raccolta('membri').sincronizza();
      var vai = function () { poi(info || {}, p); };
      if (!io()) {
        // aspettiamo i nomi dal cloud (al massimo 2,5 s) per proporre i bottoni
        Promise.race([primo, new Promise(function (r) { setTimeout(r, 2500); })]).then(function () {
          if (!io()) chiediChiSei(true, vai); else vai();
        });
      } else vai();
    }
    if (chiaveValida(k)) { impostaChiave(k); pronto(); }
    else primaApertura(pronto);
  }

  G.Fam = {
    h: h, svuota: svuota, ls: ls, lsJson: lsJson,
    avvio: avvio, raccolta: raccolta, sincronizzaTutto: sincronizzaTutto, statoGenerale: statoGenerale,
    io: io, impostaIo: impostaIo, membri: membri, aggiungiMembro: aggiungiMembro,
    persone: persone, gestisciPersone: gestisciPersone,
    chiediChiSei: chiediChiSei, invita: invita, dialogo: dialogo, avviso: avviso, quando: quando,
    pillolaStato: pillolaStato, su: suGlobale, scriviHash: scriviHash, linkInvito: linkInvito,
    nuovoId: nuovoId, prova: PROVA,
    get chiave() { return K; }
  };
})(window);
