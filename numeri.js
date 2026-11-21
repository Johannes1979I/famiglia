/* 📇 Numeri utili — medico, idraulico, scuola, emergenze. Un tocco e chiami. */
(function () {
  'use strict';
  var RUOLI = ['Emergenze', 'Medico di famiglia', 'Pediatra', 'Farmacia', 'Dentista', 'Scuola', 'Idraulico', 'Elettricista', 'Caldaista', 'Condizionatori',
    'Meccanico', 'Gommista', 'Carrozzeria', 'Amministratore condominio', 'Veterinario', 'Assicurazione', 'Banca', 'Babysitter', 'Altro'];
  function tel(n) { return String(n || '').replace(/[^\d+]/g, ''); }

  Sezione.definisci('numeri', {
    raccolta: 'numeri',
    nuovoTesto: 'Nuovo numero',
    campi: [
      { k: 'nome', etichetta: 'Nome', obbligatorio: true, segnaposto: 'Es. Dott. Rossi, Idraulico Mario' },
      { k: 'ruolo', etichetta: 'Ruolo', tipo: 'scelta', libera: true, mezzo: true, opzioni: RUOLI },
      { k: 'telefono', etichetta: 'Telefono', tipo: 'telefono', mezzo: true },
      { k: 'telefono2', etichetta: 'Altro telefono', tipo: 'telefono', mezzo: true },
      { k: 'email', etichetta: 'Email', tipo: 'email', mezzo: true },
      { k: 'indirizzo', etichetta: 'Indirizzo' },
      { k: 'orari', etichetta: 'Orari', segnaposto: 'Es. lun-ven 9-12' },
      { k: 'note', etichetta: 'Note', tipo: 'area', righe: 2 }
    ],
    ordina: function (a, b) {
      var ia = RUOLI.indexOf(a.ruolo), ib = RUOLI.indexOf(b.ruolo);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || String(a.ruolo || '').localeCompare(String(b.ruolo || '')) || String(a.nome).localeCompare(String(b.nome), 'it');
    },
    gruppo: function (r) { return r.ruolo || 'Altro'; },
    titoloVoce: function (r) { return r.nome || ''; },
    sottoVoce: function (r) { return [r.telefono, r.orari, r.indirizzo].filter(Boolean).join(' · '); },
    extraVoce: function (r) {
      var h = Fam.h, stop = function (e) { e.stopPropagation(); };
      return h('span', { style: 'display:flex;gap:6px' },
        r.telefono ? h('a', { class: 'azione-voce', href: 'tel:' + tel(r.telefono), onclick: stop, text: '📞 Chiama' }) : null,
        r.email ? h('a', { class: 'azione-voce', href: 'mailto:' + r.email, onclick: stop, title: 'Scrivi', text: '✉️' }) : null,
        r.indirizzo ? h('a', { class: 'azione-voce', href: 'https://maps.google.com/?q=' + encodeURIComponent(r.indirizzo), target: '_blank', rel: 'noopener', onclick: stop, title: 'Mappa', text: '📍' }) : null);
    },
    azioni: [
      { testo: '🚨 Aggiungi i numeri di emergenza', fai: function (api) {
        var gia = {}; api.tutte().forEach(function (r) { gia[r.telefono] = 1; });
        [['Numero unico di emergenza', '112'], ['Guardia medica', '116117'], ['Soccorso stradale ACI', '803116'], ['Antiveleni (Roma, Gemelli)', '06 3054343']]
          .forEach(function (x) { if (!gia[x[1]]) api.nuova({ nome: x[0], ruolo: 'Emergenze', telefono: x[1] }); });
        api.avviso('Numeri di emergenza aggiunti');
      } },
      { testo: '🔧 Manutenzioni di casa', fai: function () { location.href = 'casa.html' + location.search + '#k=' + Fam.chiave; } }
    ],
    vuoto: 'Nessun numero. Da «Altro» aggiungi quelli di emergenza, poi medico, pediatra, idraulico…',
    novita: function (r) { return r.nome; },
    home: function (righe) { return righe.length ? righe.length + ' numeri' : 'Da compilare'; }
  });
})();
