/* =========================================================================
   reparti.js — reparti del supermercato e aggiunta «intelligente» alla
   spesa. Lo usano la Spesa e il Menù («manda gli ingredienti alla spesa»).
   ========================================================================= */
(function (G) {
  'use strict';
  var REPARTI = [
    { nome: 'Frutta e verdura', ico: '🥦', parole: 'mel pera pere banan aranc limon mandarin clementin kiwi uva frag pesc albicocc ananas frutt verdur insalat lattug rucol pomodor zucchin melanzan peperon patat cipoll agli carot sedan finocc spinac bietol broccol cavol cavolfior carciof fungh zucca prezzemol basilic rosmarin salvia avocado cetriol radicch fagiolin piselli fresch' },
    { nome: 'Pane e forno', ico: '🥖', parole: 'pane panin pancarr pizz focacc grissin crackers fette biscottat taralli piadin' },
    { nome: 'Latte, uova e formaggi', ico: '🧀', parole: 'latte yogurt burro panna uova uovo formagg mozzarell parmigian grana ricott stracchin pecorin scamorz provol gorgonzol mascarpon philadelph emmental fontin' },
    { nome: 'Carne e pesce', ico: '🥩', parole: 'carne pollo tacchin manzo vitell maial salsicc macinat hamburger bistecc fettin cotolett arrost spiedin pesce salmon tonno fresco merluzz orata spigol gamber cozz vongol calamar seppi polp alici' },
    { nome: 'Salumi', ico: '🥓', parole: 'prosciutt salam mortadell bresaol speck pancett wurstel coppa' },
    { nome: 'Pasta, riso e dispensa', ico: '🍝', parole: 'pasta spaghett penne fusill rigaton linguin tagliatell lasagn gnocch riso farina zucchero sale olio aceto passata pelati sugo tonno scatola legumi ceci fagioli lenticchie mais cereali muesli fett biscott marmellat nutella miele caffe te tè camomill orzo cacao lievito pangrattato brodo dado spezie pepe' },
    { nome: 'Surgelati', ico: '🧊', parole: 'surgelat gelat bastoncin minestron congelat ghiacci' },
    { nome: 'Bevande', ico: '🥤', parole: 'acqua vino birra succ coca aranciata bibit spremut tè freddo the freddo prosecco spumante' },
    { nome: 'Casa e pulizia', ico: '🧽', parole: 'detersiv ammorbident candeggin sgrassat spugn carta igienic scottex tovagliol sacchett sacchi pellicol alluminio piatti bicchier lavastovigl pastigli anticalcare scop panno lampadin pile batteri' },
    { nome: 'Igiene e persona', ico: '🧴', parole: 'shampoo balsam bagnoschiuma sapone dentifric spazzolin deodorant rasoi assorbent pannolin salviett cotone cerott crema' },
    { nome: 'Bambini', ico: '🧸', parole: 'omogeneizzat merend succhi pannolini' },
    { nome: 'Animali', ico: '🐾', parole: 'croccant crocchett lettiera cane gatto scatolett' },
    { nome: 'Farmacia', ico: '💊', parole: 'tachipirin aspirin moment farmac sciropp antibiotic vitamin integrat termometr' },
    { nome: 'Altro', ico: '🛍️', parole: '' }
  ];
  function semplice(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function indovina(cosa) {
    var t = semplice(cosa);
    for (var i = 0; i < REPARTI.length; i++) {
      var p = REPARTI[i].parole.split(' ');
      for (var j = 0; j < p.length; j++) {
        if (p[j] && (t.indexOf(p[j]) === 0 || t.indexOf(' ' + p[j]) >= 0)) return REPARTI[i].nome;
      }
    }
    return 'Altro';
  }
  function icona(nome) {
    var r = REPARTI.filter(function (x) { return x.nome === nome; })[0];
    return r ? r.ico : '🛍️';
  }
  function indice(nome) {
    for (var i = 0; i < REPARTI.length; i++) if (REPARTI[i].nome === nome) return i;
    return REPARTI.length;
  }
  /* «2 kg patate», «latte x2», «pane» -> { cosa, quanto } */
  function separa(testo) {
    var t = String(testo || '').trim().replace(/\s+/g, ' ');
    var m = /^(\d+(?:[.,]\d+)?\s*(?:kg|g|gr|hg|l|lt|ml|pz|pezzi|conf|confezioni|bottiglie|scatole|vasetti|pacchi|pacchetti)?)\s+(.+)$/i.exec(t);
    if (m) return { quanto: m[1], cosa: m[2] };
    m = /^(.+?)\s*[x×]\s*(\d+)$/i.exec(t);
    if (m) return { quanto: m[2], cosa: m[1] };
    return { quanto: null, cosa: t };
  }
  function maiuscola(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* Aggiunge alla raccolta «spesa». Se la cosa c'è già (anche fra quelle
     prese e tolte in passato) riusa quella riga: la lista resta pulita e i
     suggerimenti imparano cosa comprate più spesso. */
  function aggiungi(R, testo, extra) {
    var p = separa(testo);
    if (!p.cosa) return null;
    var cosa = maiuscola(p.cosa), chiave = semplice(cosa);
    var esistente = R.tutte().filter(function (r) { return semplice(r.cosa) === chiave; })
      .sort(function (a, b) { return (a.eliminato ? 1 : 0) - (b.eliminato ? 1 : 0); })[0];
    var campi = { preso: false, archiviato: false, eliminato: false };
    if (p.quanto) campi.quanto = p.quanto;
    if (extra) Object.keys(extra).forEach(function (k) { campi[k] = extra[k]; });
    if (esistente) {
      var giaInLista = !esistente.preso && !esistente.archiviato && !esistente.eliminato;
      campi.usi = (esistente.usi || 1) + (giaInLista ? 0 : 1);
      R.imposta(esistente.id, campi, giaInLista ? 'quanto' : 'nuova');
      return { riga: esistente, gia: giaInLista };
    }
    campi.cosa = cosa; campi.reparto = indovina(cosa); campi.usi = 1;
    return { riga: R.nuova(campi), gia: false };
  }

  G.Reparti = { elenco: REPARTI, indovina: indovina, icona: icona, indice: indice, aggiungi: aggiungi, separa: separa };
})(window);
