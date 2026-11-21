/* =========================================================================
   avvisi.mjs — gira ogni ora su GitHub Actions.
   1. collega le chat Telegram che hanno premuto «Avvia» col codice giusto;
   2. all'ora scelta (una volta al giorno) manda a ogni chat collegata il
      promemoria della famiglia: scadenze, compleanni, scuola, salute, casa,
      viaggi, spesa urgente, menù di stasera.
   Segreti: FAM_CHIAVE (la chiave del link) e TELEGRAM_TOKEN (il bot).
   ========================================================================= */
const CHIAVE = process.env.FAM_CHIAVE, TOKEN = process.env.TELEGRAM_TOKEN, FORZA = process.env.FORZA === '1';
const API = 'AIzaSyCB1Opg-CGCPTx4JDl7QNPYHMHVChYnHcw';
const BASE = `https://firestore.googleapis.com/v1/projects/residence-holiday-ef6e9/databases/(default)/documents/famiglia/${CHIAVE}`;
const SOLO_TESTO = process.env.SOLO_TESTO === '1';   // prova a secco: stampa il messaggio e basta
if (!CHIAVE || (!TOKEN && !SOLO_TESTO)) { console.log('Mancano i segreti FAM_CHIAVE o TELEGRAM_TOKEN: niente da fare.'); process.exit(0); }

/* ---------------- Firestore ---------------- */
const val = v => !v ? null : 'stringValue' in v ? v.stringValue : 'booleanValue' in v ? v.booleanValue
  : 'doubleValue' in v ? Number(v.doubleValue) : 'integerValue' in v ? Number(v.integerValue) : null;
const daDoc = d => { const o = { id: d.name.split('/').pop() }; for (const [k, v] of Object.entries(d.fields || {})) o[k] = val(v); return o; };
const aVal = v => typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { doubleValue: v } : v == null ? { nullValue: null } : { stringValue: String(v) };
async function elenca(col) {
  const out = []; let tok = '';
  do {
    const r = await fetch(`${BASE}/${col}?key=${API}&pageSize=300${tok ? '&pageToken=' + tok : ''}`);
    const d = await r.json(); if (!r.ok) throw new Error(col + ': ' + JSON.stringify(d.error));
    (d.documents || []).forEach(x => out.push(daDoc(x))); tok = d.nextPageToken || '';
  } while (tok);
  return out.filter(r => !r.eliminato);
}
async function salva(percorso, campi) {
  const q = Object.keys(campi).map(k => 'updateMask.fieldPaths=' + k).join('&');
  const fields = Object.fromEntries(Object.entries(campi).map(([k, v]) => [k, aVal(v)]));
  const r = await fetch(`${BASE}${percorso ? '/' + percorso : ''}?key=${API}&${q}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error('salvataggio ' + percorso + ': ' + r.status);
}

/* ---------------- Telegram ---------------- */
const tg = async (metodo, corpo) => (await fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}) })).json();
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------------- date (ora italiana) ---------------- */
const parti = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(new Date());
const P = Object.fromEntries(parti.map(p => [p.type, p.value]));
const OGGI = `${P.year}-${P.month}-${P.day}`, ORA = Number(P.hour) % 24;
const giorno0 = iso => new Date(String(iso).slice(0, 10) + 'T00:00:00Z');
const giorniA = iso => iso ? Math.round((giorno0(iso) - giorno0(OGGI)) / 864e5) : null;
const piuMesi = (iso, m) => { const d = giorno0(iso), g = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + m); d.setUTCDate(Math.min(g, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate())); return d.toISOString().slice(0, 10); };
const quando = g => g === 0 ? 'oggi' : g === 1 ? 'domani' : g < 0 ? `${-g} giorni fa` : `tra ${g} giorni`;
const dataIt = iso => giorno0(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const lunedi = new Date(giorno0(OGGI)).getUTCDay() === 1;

function prossimoCompleanno(iso) {
  const d = giorno0(iso), anno = Number(OGGI.slice(0, 4));
  const il = a => { const u = new Date(Date.UTC(a, d.getUTCMonth() + 1, 0)).getUTCDate(); return new Date(Date.UTC(a, d.getUTCMonth(), Math.min(d.getUTCDate(), u))); };
  let p = il(anno); if (p < giorno0(OGGI)) p = il(anno + 1);
  return p.toISOString().slice(0, 10);
}

/* ---------------- il messaggio ---------------- */
async function componi(sezioni) {
  const blocchi = [];
  const usa = s => !sezioni || sezioni[s] !== false;
  const blocco = (titolo, righe) => { if (righe.length) blocchi.push(`<b>${titolo}</b>\n` + righe.join('\n')); };

  if (usa('scadenze')) {
    const r = (await elenca('scadenze')).filter(x => !x.fatto && x.data).map(x => ({ ...x, g: giorniA(x.data), pre: x.preavviso ?? 15 }))
      .filter(x => x.g < 0 ? lunedi || x.g === -1 : x.g === 0 || x.g === 1 || x.g === x.pre || (x.g <= x.pre && lunedi)).sort((a, b) => a.g - b.g);
    blocco('📅 Scadenze', r.map(x => `${x.g < 0 ? '⚠️' : '•'} ${esc(x.titolo)} — ${x.g < 0 ? 'scaduta ' + quando(x.g) : quando(x.g) + ' (' + dataIt(x.data) + ')'}${typeof x.importo === 'number' ? ' · € ' + x.importo.toFixed(2).replace('.', ',') : ''}`));
  }
  if (usa('compleanni')) {
    const r = (await elenca('compleanni')).filter(x => x.data).map(x => { const p = prossimoCompleanno(x.data); return { ...x, p, g: giorniA(p), pre: x.preavviso ?? 7 }; })
      .filter(x => x.g === 0 || x.g === 1 || x.g === x.pre).sort((a, b) => a.g - b.g);
    blocco('🎂 Compleanni e ricorrenze', r.map(x => {
      const anni = !x.annoIgnoto ? Number(x.p.slice(0, 4)) - Number(String(x.data).slice(0, 4)) : 0;
      return `${x.g === 0 ? '🎉' : '•'} ${esc(x.tipo || 'Compleanno')} di ${esc(x.nome)} ${quando(x.g)}${anni > 0 ? ` (${x.tipo === 'Anniversario' ? anni + '°' : anni + ' anni'})` : ''}`;
    }));
  }
  if (usa('scuola')) {
    const r = (await elenca('scuola')).filter(x => !x.fatto && x.data && [0, 1].includes(giorniA(x.data)))
      .sort((a, b) => String(a.data + (a.ora || '')).localeCompare(String(b.data + (b.ora || ''))));
    blocco('🎒 Scuola e attività', r.map(x => `• ${quando(giorniA(x.data))}${x.ora ? ' alle ' + x.ora : ''}: ${esc(x.titolo)}${x.per ? ' (' + esc(x.per) + ')' : ''}${x.portare ? '\n   🎒 ' + esc(x.portare) : ''}`));
  }
  if (usa('salute')) {
    const tutte = (await elenca('salute')).filter(x => !x.fatto);
    const r = tutte.filter(x => x.data && [0, 1].includes(giorniA(x.data)));
    const daPren = lunedi ? tutte.filter(x => !x.data).length : 0;
    blocco('🩺 Salute', r.map(x => `• ${quando(giorniA(x.data))}${x.ora ? ' alle ' + x.ora : ''}: ${esc(x.titolo)}${x.per ? ' — ' + esc(x.per) : ''}${x.dove ? ' (' + esc(x.dove) + ')' : ''}`)
      .concat(daPren ? [`📞 ${daPren} da prenotare`] : []));
  }
  if (usa('casa')) {
    const r = (await elenca('casa')).map(x => ({ ...x, p: x.prossimaManuale || (x.ultima && x.ogniMesi ? piuMesi(x.ultima, Math.round(x.ogniMesi)) : null) }))
      .filter(x => x.p).map(x => ({ ...x, g: giorniA(x.p) })).filter(x => x.g === 0 || x.g === 7 || (x.g < 0 && lunedi)).sort((a, b) => a.g - b.g);
    blocco('🔧 Manutenzioni', r.map(x => `${x.g < 0 ? '⚠️' : '•'} ${esc(x.cosa)} — ${x.g < 0 ? 'in ritardo' : quando(x.g)}${x.ditta ? ' (' + esc(x.ditta) + ')' : ''}`));
  }
  if (usa('viaggi')) {
    const viaggi = (await elenca('viaggi')).filter(v => v.dal && [1, 3, 7].includes(giorniA(v.dal)));
    if (viaggi.length) {
      const valigia = await elenca('valigia');
      blocco('✈️ Viaggi', viaggi.map(v => { const m = valigia.filter(x => x.viaggio === v.id && !x.preso).length; return `• ${esc(v.titolo)}: si parte ${quando(giorniA(v.dal))}${m ? ` — in valigia mancano ${m} cose` : ' — valigia pronta ✅'}`; }));
    }
  }
  if (usa('spesa')) {
    const urg = (await elenca('spesa')).filter(x => !x.archiviato && !x.preso && x.urgente);
    blocco('🛒 Spesa urgente', urg.map(x => `• ${esc(x.cosa)}${x.quanto ? ' (' + esc(x.quanto) + ')' : ''}`));
  }
  if (usa('menu')) {
    const m = (await elenca('menu')).find(x => x.id === OGGI);
    if (m && (m.pranzo || m.cena)) blocco('🍝 Oggi in tavola', [m.pranzo ? '☀️ ' + esc(m.pranzo) : '', m.cena ? '🌙 ' + esc(m.cena) : ''].filter(Boolean));
  }
  return blocchi;
}

if (SOLO_TESTO) { console.log((await componi(null)).join('\n\n') || '(niente da segnalare oggi)'); process.exit(0); }

/* ---------------- giro ---------------- */
let cfg = {};
try { const r = await fetch(`${BASE}/impostazioni/avvisi?key=${API}`); if (r.ok) cfg = daDoc(await r.json()); } catch (e) { console.log('impostazioni non lette', e.message); }
let chat = []; try { chat = JSON.parse(cfg.chat || '[]'); } catch { chat = []; }
let sezioni = null; try { sezioni = cfg.sezioni ? JSON.parse(cfg.sezioni) : null; } catch { sezioni = null; }
const aggiorna = {};

// 1. nuovi collegamenti: «/start <codice>»
if (cfg.codice) {
  const up = await tg('getUpdates', { timeout: 0, allowed_updates: ['message'] });
  for (const u of up.result || []) {
    const m = u.message; if (!m || !m.text) continue;
    // vale il link dell'app («/start <codice>») ma anche il codice scritto a mano
    const testo = m.text.trim().replace(/^\/start\s*/, '').trim();
    const giaDentro = chat.some(c => c.id === m.chat.id);
    if (testo === cfg.codice && !giaDentro) {
      chat.push({ id: m.chat.id, nome: m.chat.first_name || m.chat.title || 'Telegram' });
      aggiorna.chat = JSON.stringify(chat);
      await tg('sendMessage', { chat_id: m.chat.id, text: `✅ Collegato alla famiglia! Ogni giorno alle ${cfg.ora ?? 7} ti mando qui i promemoria (scadenze, compleanni, scuola, salute…).` });
      console.log('collegata una nuova chat');
    } else if (giaDentro) {
      await tg('sendMessage', { chat_id: m.chat.id, text: 'Sei già collegato 👍 I promemoria si cambiano dall\'app, sezione 🔔 Avvisi.' });
    } else {
      await tg('sendMessage', { chat_id: m.chat.id, text: 'Ciao! Per collegarti usa il pulsante «📲 Collegami su Telegram» nell\'app della famiglia (sezione 🔔 Avvisi), oppure scrivi qui il codice che trovi lì.' });
      console.log('messaggio senza codice: risposto con le istruzioni');
    }
  }
  if (up.result && up.result.length) await tg('getUpdates', { offset: up.result[up.result.length - 1].update_id + 1, timeout: 0 });
}

// 2. il promemoria del giorno
const oraScelta = Number(cfg.ora ?? 7);
const tocca = FORZA || cfg.prova || (cfg.attivo !== false && ORA === oraScelta && cfg.ultimoInvio !== OGGI);
if (tocca && chat.length) {
  const blocchi = await componi(sezioni);
  const titolo = `<b>🏡 Famiglia · ${giorno0(OGGI).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</b>`;
  if (blocchi.length || cfg.prova || FORZA) {
    const testo = titolo + '\n\n' + (blocchi.length ? blocchi.join('\n\n') : 'Niente in programma per oggi e domani. 🙂') + (cfg.prova ? '\n\n<i>(messaggio di prova)</i>' : '');
    for (const c of chat) { const r = await tg('sendMessage', { chat_id: c.id, text: testo, parse_mode: 'HTML', disable_web_page_preview: true }); if (!r.ok) console.log('invio non riuscito a una chat:', r.description); }
    aggiorna.ultimoEsito = `inviato a ${chat.length} ${chat.length === 1 ? 'persona' : 'persone'} (${blocchi.length} sezioni)`;
  } else aggiorna.ultimoEsito = 'niente da segnalare oggi';
  if (!FORZA && !cfg.prova) aggiorna.ultimoInvio = OGGI;
  if (cfg.prova) aggiorna.prova = false;
}
aggiorna.ultimoGiro = new Date().toISOString();
await salva('impostazioni/avvisi', aggiorna);
await salva('', { v_impostazioni: new Date().toISOString() });
console.log('giro fatto alle', ORA, 'ora italiana', tocca ? '(con invio)' : '');
