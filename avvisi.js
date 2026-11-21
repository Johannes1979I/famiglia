/* 🔔 Avvisi su Telegram — collegamento e impostazioni.
   Il lavoro vero lo fa ogni ora .github/avvisi.mjs su GitHub Actions;
   qui si sceglie cosa ricevere e a che ora, e ci si collega al bot.
   Documento: impostazioni/avvisi { bot, codice, ora, attivo, sezioni(JSON),
   chat(JSON), prova, ultimoGiro, ultimoInvio, ultimoEsito } */
(function () {
  'use strict';
  var h = Fam.h, svuota = Fam.svuota;
  var SEZIONI = [['scadenze', '📅 Scadenze'], ['compleanni', '🎂 Compleanni e ricorrenze'], ['scuola', '🎒 Scuola e attività'], ['salute', '🩺 Salute'],
    ['casa', '🔧 Manutenzioni'], ['viaggi', '✈️ Viaggi'], ['spesa', '🛒 Spesa urgente'], ['menu', '🍝 Menù del giorno']];
  function json(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }

  Sezione.definisci('avvisi', {
    raccolta: 'impostazioni', campi: [],
    home: function () {
      var a = Fam.raccolta('impostazioni').prendi('avvisi'), c = a ? json(a.chat, []) : [];
      if (!a || !a.bot) return 'Da attivare';
      return c.length ? 'Telegram: ' + c.map(function (x) { return x.nome; }).join(', ') : 'Nessuno collegato';
    }
  });

  if (document.body.getAttribute('data-pagina') !== 'avvisi') return;
  Fam.avvio(function () {
    var I = Fam.raccolta('impostazioni'), app = document.getElementById('app');
    Fam.pillolaStato(document.getElementById('pillola'));
    document.getElementById('indietro').href = 'index.html' + location.search + '#k=' + Fam.chiave;
    var chi = document.getElementById('chi');
    chi.addEventListener('click', function () { Fam.chiediChiSei(false, disegna); });
    var corpo = h('div');
    app.appendChild(corpo);

    function a() { return I.prendi('avvisi') || {}; }
    function imposta(campi) { I.imposta('avvisi', campi, Object.keys(campi)[0]); disegna(); }
    function assicuraCodice() {
      if (a().codice) return;
      var b = new Uint8Array(8); crypto.getRandomValues(b);
      imposta({ codice: Array.prototype.map.call(b, function (x) { return 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]; }).join(''), ora: 7, attivo: true });
    }

    function disegna() {
      chi.textContent = '👤 ' + (Fam.io() || 'Chi sei?');
      svuota(corpo);
      var s = a(), chat = json(s.chat, []), sez = json(s.sezioni, {});
      corpo.appendChild(h('div', { class: 'banner', id: 'bannerCloud', hidden: true }, 'Il salvataggio condiviso non è attivo in questo momento.'));
      corpo.appendChild(h('section', { class: 'scheda' },
        h('h2', { text: '🔔 Il promemoria di ogni mattina' }),
        h('p', { text: 'Ogni giorno, all\'ora che scegliete, arriva su Telegram un messaggio con quello che conta: scadenze vicine, compleanni, impegni di scuola, visite, manutenzioni, partenze, spesa urgente e cosa si mangia. Se non c\'è niente, non arriva niente.' })));

      // collegamento
      var col = h('section', { class: 'scheda' }, h('h3', { text: '📲 Chi lo riceve' }));
      if (!s.bot) {
        col.appendChild(h('p', { class: 'avviso-box', text: 'Il bot di Telegram della famiglia non è ancora configurato. Appena è pronto qui compare il pulsante per collegarvi.' }));
      } else {
        if (chat.length) chat.forEach(function (c) {
          col.appendChild(h('div', { class: 'riga-persona' }, h('span', { text: '✅ ' + c.nome }),
            h('button', { type: 'button', class: 'btn piccolo', text: 'Scollega', onclick: function () {
              imposta({ chat: JSON.stringify(json(a().chat, []).filter(function (x) { return x.id !== c.id; })) });
            } })));
        });
        else col.appendChild(h('p', { class: 'tenue', text: 'Ancora nessuno collegato.' }));
        col.appendChild(h('p', { style: 'margin-top:12px', text: 'Per collegarti: apri il link dal telefono, Telegram si apre sul bot, premi «Avvia». Entro un\'ora ti arriva il messaggio di conferma. Lo fa ognuno dal proprio telefono.' }));
        col.appendChild(h('a', { class: 'btn primario', href: 'https://t.me/' + s.bot + '?start=' + s.codice, target: '_blank', rel: 'noopener', text: '📲 Collegami su Telegram' }));
      }
      corpo.appendChild(col);

      // impostazioni
      var ora = h('select', { onchange: function () { imposta({ ora: Number(ora.value) }); } });
      for (var o = 6; o <= 22; o++) ora.appendChild(h('option', { value: String(o), text: o + ':00' }));
      ora.value = String(s.ora === undefined || s.ora === null ? 7 : s.ora);
      var attivo = h('input', { type: 'checkbox', checked: s.attivo !== false, onchange: function () { imposta({ attivo: attivo.checked }); } });
      var imp = h('section', { class: 'scheda' }, h('h3', { text: '⚙️ Cosa e quando' }),
        h('label', { class: 'campo campo-spunta' }, attivo, h('span', { text: 'Promemoria attivo' })),
        h('label', { class: 'campo', style: 'max-width:200px' }, h('span', { text: 'Ora di invio (ora italiana)' }), ora),
        h('p', { class: 'tenue piccolo', text: 'Sezioni da includere:' }));
      SEZIONI.forEach(function (x) {
        var c = h('input', { type: 'checkbox', checked: sez[x[0]] !== false, onchange: function () {
          var n = json(a().sezioni, {}); n[x[0]] = c.checked; imposta({ sezioni: JSON.stringify(n) });
        } });
        imp.appendChild(h('label', { class: 'campo campo-spunta' }, c, h('span', { text: x[1] })));
      });
      corpo.appendChild(imp);

      // stato
      var st = h('section', { class: 'scheda' }, h('h3', { text: '🛰️ Ultimi giri' }),
        h('p', { text: s.ultimoGiro ? 'Ultimo controllo: ' + Fam.quando(s.ultimoGiro) : 'Il controllo automatico non è ancora passato.' }),
        s.ultimoEsito ? h('p', { class: 'tenue', text: 'Ultimo promemoria: ' + s.ultimoEsito + (s.ultimoInvio ? ' (' + s.ultimoInvio.split('-').reverse().join('/') + ')' : '') }) : null,
        s.bot && chat.length ? h('button', { type: 'button', class: 'btn', text: s.prova ? '⏳ Prova in arrivo entro un\'ora' : '🧪 Mandami una prova', disabled: !!s.prova, onclick: function () {
          imposta({ prova: true }); Fam.avviso('Il messaggio di prova arriva al prossimo giro, entro un\'ora');
        } }) : null);
      corpo.appendChild(st);
    }

    I.su(function (t) { if (t === 'remoto') disegna(); });
    Fam.su(function (t) { if (t === 'io') disegna(); });
    disegna();
    I.sincronizza().then(function () { assicuraCodice(); disegna(); });
  });
})();
