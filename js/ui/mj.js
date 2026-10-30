// Panneau du maître du jeu (sur son téléphone) : terrain, énigmes, pilotage de la nuit, chasse, démo.
import {
  html, useState, useEffect, useMemo, useSource, useNow, Countdown, Icon, Ex, Av, Btn, Pill, Sheet, Stepper, Toasts, Status,
  keepAwake, fmt, fmtShort, hm, mins, plural, ORD, SYM_ICON, Safe,
} from './kit.js';
import { GameMap } from './map.js';
import { useGps } from './gps.js';
import { unlockAudio } from './sound.js';
import { SYMBOLS } from '../data.js';

const STATUS = { monstre: 'Monstre', exorcise: 'Exorcisé', sauve: 'Sauvé' };

export function MjApp({ client, extraTab }) {
  useSource(client);
  const v = client.mj;
  const pub = client.pub;
  const [tab, setTab] = useState('nuit');
  const clock = () => client.now();
  useEffect(() => {
    const wake = () => { unlockAudio(); keepAwake(); };
    document.addEventListener('pointerdown', wake, { once: true });
  }, []);
  const N = v && v.nuit;
  const outside = N && (N.st === 'alerte' || N.st === 'refuge');
  const sim = !!client.local;
  const gps = useGps({ active: !!outside, simulated: sim, start: N && N.center, send: (p) => client.send({ g: 'nuit', a: 'gps', ...p }) });

  if (!v || !pub) {
    return html`<div class="screen"><div class="grow"></div><p class="lead center muted">${client.status === 'ok' ? 'En attente de l’écran TV… Vérifie que la page de la TV est ouverte.' : 'Connexion au relais…'}</p><div class="grow"></div>
      <${Status} status=${client.status} hostAlive=${client.hostAlive()} /></div>`;
  }
  const send = (g, a, x) => client.send({ g, a, ...(x || {}) });
  const sos = v.alerts.filter((a) => a.kind === 'sos' && clock() - a.t < 15 * 60000);
  const tabs = [['terrain', 'Terrain'], ['enigmes', 'Énigmes'], ['nuit', 'Nuit'], ['chasse', 'Chasse']];
  if (v.demo) tabs.push(['demo', 'Démo']);
  let body;
  if (tab === 'terrain') body = html`<${Terrain} v=${v} send=${send} gps=${gps} />`;
  else if (tab === 'enigmes') body = html`<${Enigmes} v=${v} send=${send} />`;
  else if (tab === 'chasse') body = html`<${Chasse} v=${v} pub=${pub} send=${send} clock=${clock} gps=${gps} sim=${sim} />`;
  else if (tab === 'demo') body = html`<${Demo} v=${v} send=${send} />`;
  else body = html`<${Nuit} v=${v} pub=${pub} send=${send} clock=${clock} />`;
  return html`<div class="screen">
      <p class="eyebrow">Maître du jeu${v.demo ? ' · démo' : ''}</p>
      <${Ex} size=${40} depth=${5}>${{ terrain: 'Préparation', enigmes: 'Les énigmes', nuit: N.st === 'idle' ? 'La nuit' : 'Pilotage', chasse: 'La chasse', demo: 'Mode démo' }[tab]}</${Ex}>
      <nav class="mjtabs" style="margin-top:14px">${tabs.map(([k, l]) => html`<button class=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}>${l}</button>`)}</nav>
      ${sos.map((a) => html`<div class="sos" key=${a.id}><b>${a.text}</b><div class="small">${hm(a.t)}${a.data && a.data.where && a.data.where.lat ? html` · <a class="ok" target="_blank" href=${`https://maps.google.com/?q=${a.data.where.lat},${a.data.where.lng}`}>voir sur un plan</a>` : ''}</div></div>`)}
      <${Safe}>${body}</${Safe}>
    </div>
    <${Toasts} alerts=${v.alerts.filter((a) => a.kind !== 'info')} storeKey=${'hw.mjtoast.' + (client.room || 'demo')} />
    <${Status} status=${client.status} hostAlive=${client.hostAlive()} />
    <div class="grain"></div>`;
}

// ===================== terrain =====================

function Terrain({ v, send, gps }) {
  const N = v.nuit;
  const C = N.cfg;
  const [mode, setMode] = useState(N.center ? 'refuge' : 'center');
  const idle = N.st === 'idle';
  const cfg = (k, val) => send('nuit', 'cfg', { ...C, [k]: val });
  const tap = (p) => send('nuit', mode === 'center' ? 'center' : 'refugePt', p);
  const here = () => {
    if (gps.pos) return tap(gps.pos);
    navigator.geolocation && navigator.geolocation.getCurrentPosition((p) => tap({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { enableHighAccuracy: true, timeout: 15000 });
  };
  const at = C.clueAt.join(', ').replace(/, (\d+)$/, ' et $1');
  return html`
    <div class="seg" style="margin-bottom:8px">
      <button class=${mode === 'center' ? 'on' : ''} onClick=${() => setMode('center')}>Placer la maison</button>
      <button class=${mode === 'refuge' ? 'on' : ''} onClick=${() => setMode('refuge')}>Placer le refuge</button>
    </div>
    <div style="position:relative;height:42dvh">
      <div class="mapbox" style="position:absolute;inset:0">
        <${GameMap} center=${N.center} radius=${C.radius} refuge=${N.refugePt} onTap=${tap} />
        <span class="pill maptag"><${Icon} n="map-pin" s=${14} />Touche la carte pour placer ${mode === 'center' ? 'la maison' : 'le refuge'}</span>
      </div>
    </div>
    <div style="margin:8px 0 16px"><${Btn} kind="ghost" small icon="locate-fixed" onClick=${here}>Utiliser ma position ici</${Btn}></div>
    <div class="orow"><${Icon} n="house" /><span class="olbl">Point de départ<small>La maison, centre du périmètre</small></span>${N.center ? html`<span class="ok"><${Icon} n="check" /></span>` : html`<span class="tag grey">à placer</span>`}</div>
    <div class="orow"><${Icon} n="map" /><span class="olbl">Périmètre<small>Rayon autour de la maison</small></span>
      <${Stepper} value=${C.radius} step=${100} min=${200} max=${3000} onChange=${(x) => cfg('radius', x)} show=${(x) => (x >= 1000 ? (x / 1000).toString().replace('.', ',') + ' km' : x + ' m')} /></div>
    <div class="orow"><${Icon} n="flag" /><span class="olbl">Le refuge<small>Point de rassemblement, invisible pour les joueurs</small></span>${N.refugePt ? html`<span class="ok"><${Icon} n="check" /></span>` : html`<span class="tag grey">à placer</span>`}</div>
    <div class="orow"><${Icon} n="hourglass" /><span class="olbl">Évasion</span><${Stepper} value=${C.evasion} step=${5} min=${5} max=${90} onChange=${(x) => cfg('evasion', x)} show=${(x) => x + ' min'} /></div>
    <div class="orow"><${Icon} n="siren" /><span class="olbl">Alerte générale</span><${Stepper} value=${C.alerte} step=${5} min=${5} max=${90} onChange=${(x) => cfg('alerte', x)} show=${(x) => x + ' min'} /></div>
    <div class="orow"><${Icon} n="flag" /><span class="olbl">Refuge<small>Indices à ${at} min de la fin</small></span><${Stepper} value=${C.refuge} step=${5} min=${5} max=${60} onChange=${(x) => cfg('refuge', x)} show=${(x) => x + ' min'} /></div>
    <div class="orow"><${Icon} n="radio" /><span class="olbl">Signalement<small>Position de chaque monstre aux chasseurs</small></span><${Stepper} value=${C.every} step=${1} min=${1} max=${20} onChange=${(x) => cfg('every', x)} show=${(x) => x + ' min'} /></div>
    ${!idle ? html`<p class="sub">Les durées modifiées s’appliquent aux prochains actes.</p>` : null}`;
}

// ===================== énigmes =====================

function Enigmes({ v, send }) {
  const N = v.nuit;
  const E = N.escape;
  const idle = N.st === 'idle';
  const [edit, setEdit] = useState(null);
  const [ult, setUlt] = useState(E.ultimate);
  const [code, setCode] = useState(E.code);
  const [order, setOrder] = useState(E.order);
  const [pick, setPick] = useState(null);
  const [clues, setClues] = useState(N.clues);
  const [print, setPrint] = useState(false);
  useEffect(() => { setUlt(E.ultimate); setCode(E.code); setOrder(E.order); }, [JSON.stringify(E)]);
  useEffect(() => setClues(N.clues), [JSON.stringify(N.clues)]);
  const digit = (sym) => code[order.indexOf(sym)] || '?';
  const save = (patch) => send('nuit', 'escape', { escape: { ...E, ultimate: ult, code, order, ...patch } });
  const dirty = ult !== E.ultimate || code !== E.code || order.join() !== E.order.join();
  const swap = (i) => {
    if (pick == null) return setPick(i);
    const o = order.slice();
    [o[pick], o[i]] = [o[i], o[pick]];
    setOrder(o);
    setPick(null);
  };
  if (print) return html`<${PrintCards} E=${E} close=${() => setPrint(false)} />`;
  return html`
    <p class="label">Les 4 énigmes, cachées dans la maison</p>
    ${E.enigmas.map((e, i) => html`<button class="erow" key=${i} onClick=${() => setEdit(i)}>
      <span class="n">${e.num}</span>
      <span class="t">${e.room || 'Pièce ?'} : ${e.q.slice(0, 60)}${e.q.length > 60 ? '…' : ''}<small>Réponse : ${e.answers[0] || '?'}${N.solved[e.num] ? ' · résolue' : N.found[e.num] ? ' · trouvée' : ''}</small></span>
      <span class="d"><${Icon} n=${SYM_ICON[e.sym]} s=${16} />${digit(e.sym)}</span>
    </button>`)}
    <p class="label" style="margin-top:18px">L’ultime énigme</p>
    <textarea class="inp" rows="4" disabled=${!idle} value=${ult} onInput=${(e) => setUlt(e.target.value)}></textarea>
    <p class="label" style="margin-top:12px">Ordre des symboles dans le code ${idle ? html`<span class="muted">(touche deux symboles pour les échanger)</span>` : ''}</p>
    <div class="dg">${order.map((s, i) => html`<div key=${s} style=${pick === i ? 'border-color:var(--orange)' : ''} onClick=${() => idle && swap(i)}><${Icon} n=${SYM_ICON[s]} s=${18} /><b>${code[i] || '?'}</b></div>`)}</div>
    <div class="orow" style="margin-top:8px"><${Icon} n="lock" /><span class="olbl">Code du cadenas<small>Les 4 chiffres de ton vrai cadenas</small></span>
      <input class="inp" style="width:110px;height:40px;text-align:center;font:400 22px Gloock;color:var(--orange)" inputmode="numeric" maxlength="4" disabled=${!idle} value=${code} onInput=${(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} /></div>
    ${idle && dirty ? html`<div style="margin-top:8px"><${Btn} disabled=${code.length !== 4} onClick=${() => save({})}>Enregistrer le cadenas</${Btn}></div>` : null}
    <div style="margin-top:8px"><${Btn} kind="ghost" icon="printer" onClick=${() => setPrint(true)}>Imprimer les cartes numérotées</${Btn}></div>
    <p class="label" style="margin-top:22px">Les 5 indices du refuge</p>
    <p class="sub" style="margin:-4px 0 10px">Ils restent sur l’écran TV et n’apparaissent jamais dans le code du site.</p>
    ${clues.map((c, i) => html`<label class="field" key=${i} style="margin-bottom:8px"><span class="label">Indice ${i + 1}, à ${N.cfg.clueAt[i]} min de la fin</span>
      <textarea class="inp" rows="2" value=${c} onInput=${(e) => { const x = clues.slice(); x[i] = e.target.value; setClues(x); }}></textarea></label>`)}
    ${clues.join('\n') !== N.clues.join('\n') ? html`<${Btn} onClick=${() => send('nuit', 'clues', { clues })}>Enregistrer les indices</${Btn}>` : null}
    ${edit != null ? html`<${EditEnigma} e=${E.enigmas[edit]} i=${edit} idle=${idle} close=${() => setEdit(null)}
      save=${(x) => { const en = E.enigmas.slice(); en[edit] = x; save({ enigmas: en }); setEdit(null); }} />` : null}`;
}

function EditEnigma({ e, i, idle, close, save }) {
  const [f, setF] = useState({ ...e, answers: e.answers.join(', ') });
  const set = (k) => (ev) => setF({ ...f, [k]: ev.target.value });
  return html`<${Sheet} onClose=${close}>
    <${Ex} size=${32} depth=${4} tag="h2">${ORD[i]} énigme</${Ex}>
    <div class="two" style="margin-top:14px">
      <label class="field"><span class="label">Numéro de la carte</span><input class="inp" inputmode="numeric" value=${f.num} onInput=${set('num')} /></label>
      <label class="field"><span class="label">Pièce</span><input class="inp" value=${f.room} onInput=${set('room')} /></label>
    </div>
    <p class="label" style="margin-top:12px">Symbole révélé</p>
    <div class="seg">${Object.keys(SYMBOLS).map((s) => html`<button class=${f.sym === s ? 'on' : ''} onClick=${() => setF({ ...f, sym: s })}><${Icon} n=${SYM_ICON[s]} s=${16} /></button>`)}</div>
    <label class="field" style="margin-top:12px"><span class="label">Énigme</span><textarea class="inp" rows="5" value=${f.q} onInput=${set('q')}></textarea></label>
    <label class="field" style="margin-top:12px"><span class="label">Réponses acceptées, séparées par des virgules</span><input class="inp" value=${f.answers} onInput=${set('answers')} /></label>
    <label class="field" style="margin-top:12px"><span class="label">Coup de pouce</span><input class="inp" value=${f.hint} onInput=${set('hint')} /></label>
    <div class="stack" style="margin-top:16px">
      ${idle ? html`<${Btn} onClick=${() => save({ ...f, answers: f.answers.split(',').map((x) => x.trim()).filter(Boolean) })}>Enregistrer</${Btn}>` : html`<p class="sub">La partie est lancée : les énigmes ne se modifient plus.</p>`}
      <button class="link" onClick=${close}>Fermer</button>
    </div>
  </${Sheet}>`;
}

function PrintCards({ E, close }) {
  return html`<div class="noprint stack" style="margin-bottom:12px">
      <${Btn} icon="printer" onClick=${() => window.print()}>Imprimer</${Btn}>
      <button class="link" onClick=${close}>Retour</button>
    </div>
    <div class="print">${E.enigmas.map((e) => html`<div class="pcard"><b>${e.num}</b><span>Tape ce numéro dans l’appli</span></div>`)}</div>`;
}

// ===================== nuit : avant et pendant =====================

function Nuit({ v, pub, send, clock }) {
  const N = v.nuit;
  if (N.st === 'idle') return html`<${Lobby} v=${v} pub=${pub} send=${send} />`;
  if (N.st === 'fin') return html`<${Fin} v=${v} pub=${pub} send=${send} />`;
  return html`<${Pilot} v=${v} pub=${pub} send=${send} clock=${clock} />`;
}

function Lobby({ v, send }) {
  const N = v.nuit;
  const ps = v.players;
  const [sel, setSel] = useState(null);
  const [mjEdit, setMjEdit] = useState(false);
  const [first, setFirst] = useState(v.mj.first);
  const [last, setLast] = useState(v.mj.last);
  const pairs = ps.filter((p) => p.bound).length / 2;
  const unbound = ps.filter((p) => !p.bound);
  const ready = ps.filter((p) => p.monster && p.av).length;
  const warn = [];
  if (!N.center) warn.push('Place la maison dans l’onglet Terrain.');
  if (!N.refugePt) warn.push('Place le refuge dans l’onglet Terrain.');
  if (unbound.length) warn.push(`${plural(unbound.length, 'joueur')} sans binôme.`);
  if (N.escape.code === '3618') warn.push('Le code du cadenas est celui d’exemple : mets le tien dans Énigmes.');
  if (N.clues[0].startsWith('Indice 1 :')) warn.push('Écris les indices du refuge dans Énigmes.');
  const tapP = (id) => {
    if (!sel) return setSel(id);
    if (sel === id) return setSel(null);
    send('core', 'pair', { a: sel, b: id });
    setSel(null);
  };
  return html`
    <div class="stats" style="margin-bottom:12px">
      <div class="stat"><b>${ps.length}</b><span>joueurs</span></div>
      <div class="stat"><b>${ready}</b><span>fiches prêtes</span></div>
      <div class="stat"><b>${pairs}</b><span>binômes scellés</span></div>
    </div>
    <div class="stack">
      <${Btn} kind="ghost" icon="tv" onClick=${() => send('core', 'screen', { screen: v.screen === 'intro' ? 'lobby' : 'intro' })}>${v.screen === 'intro' ? 'Revenir à l’accueil sur la TV' : 'Lancer l’intro sur la TV'}</${Btn}>
      <${Btn} icon="play" confirm="Lancer la nuit maintenant ?" onClick=${() => send('nuit', 'start')}>Lancer la partie</${Btn}>
    </div>
    ${warn.length ? html`<div class="alert" style="margin-top:10px">${warn.map((w) => html`<div>${w}</div>`)}</div>` : null}
    <div class="topbar" style="margin:20px 0 8px"><span>Les joueurs ${sel ? '· touche son binôme' : ''}</span>
      ${unbound.length > 1 ? html`<button class="link" style="width:auto;padding:0" onClick=${() => send('core', 'autopair')}>Former les binômes restants</button>` : null}</div>
    ${ps.map((p) => {
      const mate = ps.find((x) => x.id === p.bound);
      return html`<div class="frow ${sel === p.id ? 'on' : ''}" key=${p.id} onClick=${() => tapP(p.id)}>
        <${Av} src=${p.av} size=${34} />
        <span class="fname"><b>${p.name} ${p.last || ''}</b><span>${p.monster ? p.monster.name : 'Fiche en cours'}${mate ? ` · avec ${mate.name}` : ''}</span></span>
        <span class="dot ${p.on ? 'on' : ''}"></span>
        ${p.bound ? html`<button class="tag grey" onClick=${(e) => { e.stopPropagation(); send('core', 'unbind', { pid: p.id }); }}>délier</button>` : null}
        <span onClick=${(e) => e.stopPropagation()}><${Btn} kind="ghost" small confirm="Retirer ?" onClick=${() => send('core', 'kick', { pid: p.id })}><${Icon} n="x" s=${14} /></${Btn}></span>
      </div>`;
    })}
    ${!ps.length ? html`<p class="small muted">Personne pour l’instant. Les joueurs scannent le QR code affiché sur la TV.</p>` : null}
    <div class="orow" style="margin-top:18px" onClick=${() => setMjEdit(!mjEdit)}><${Icon} n="crosshair" /><span class="olbl">${v.mj.first} ${v.mj.last}<small>Le chasseur, c’est toi</small></span><${Icon} n="chevrons-right" /></div>
    ${mjEdit ? html`<div class="two" style="margin-top:8px"><input class="inp" value=${first} onInput=${(e) => setFirst(e.target.value)} /><input class="inp" value=${last} onInput=${(e) => setLast(e.target.value)} /></div>
      <div style="margin-top:8px"><${Btn} small onClick=${() => { send('core', 'mjName', { first, last }); setMjEdit(false); }}>Enregistrer</${Btn}></div>` : null}`;
}

function Pilot({ v, pub, send, clock }) {
  const N = v.nuit;
  const acts = [['evasion', 'Acte 1', 'Évasion'], ['alerte', 'Acte 2', 'Alerte'], ['refuge', 'Acte 3', 'Refuge']];
  const idx = acts.findIndex((a) => a[0] === N.st);
  const found = Object.keys(N.found).length;
  const solved = Object.keys(N.solved).length;
  const hints = Object.values(N.hints).filter((h) => !h.free).length;
  const next = { evasion: ['Passer à l’alerte générale', 'Ouvrir le cadenas pour tout le monde ?'], alerte: ['Passer au refuge', 'Finir l’alerte maintenant ?'], refuge: ['Terminer la nuit', 'Faire partir le dernier portail ?'] }[N.st];
  const names = Object.fromEntries(v.players.map((p) => [p.id, p]));
  const [who, setWho] = useState(null);
  return html`
    <div class="phase">${acts.map(([k, a, l], i) => html`<div class=${i < idx ? 'done' : i === idx ? 'cur' : ''}>${a}<b>${l}</b></div>`)}</div>
    <div class="big tnum" style="margin:16px 0 4px;font-size:96px"><${Countdown} to=${N.endsAt} clock=${clock} /></div>
    ${N.paused ? html`<p class="ok">En pause</p>` : null}
    ${N.st === 'evasion' ? html`
      <div class="stats" style="margin:12px 0"><div class="stat"><b>${found}</b><span>énigmes trouvées</span></div><div class="stat"><b>${solved}</b><span>résolues</span></div><div class="stat"><b>${hints}</b><span>coup${hints > 1 ? 's' : ''} de pouce</span></div></div>`
    : html`
      <div class="stats" style="margin:12px 0"><div class="stat"><b>${N.count.monstres}</b><span>monstres libres</span></div><div class="stat"><b>${N.count.exorcises}</b><span>exorcisés</span></div><div class="stat"><b>${N.count.sauves}</b><span>sauvés</span></div></div>
      <p class="small muted">${N.huntAt > clock() ? html`Tu peux sortir dans <${Countdown} to=${N.huntAt} clock=${clock} short />.` : html`Prochain signalement dans <${Countdown} to=${N.nextSight} clock=${clock} short />.`}</p>`}
    <div class="btns" style="margin-top:10px">
      <${Btn} kind="dark" onClick=${() => send('nuit', 'addTime', { min: 5 })}>+5 min</${Btn}>
      <${Btn} kind="dark" onClick=${() => send('nuit', 'addTime', { min: -5 })}>−5 min</${Btn}>
      <${Btn} kind="dark" icon=${N.paused ? 'play' : 'pause'} onClick=${() => send('nuit', N.paused ? 'resume' : 'pause')}>${N.paused ? 'Reprendre' : 'Pause'}</${Btn}>
    </div>
    <div class="stack" style="margin-top:6px">
      ${N.st === 'evasion' ? html`<${Btn} kind="dark" icon="sparkles" onClick=${() => send('nuit', 'hint')}>Donner un coup de pouce sur la TV</${Btn}>` : null}
      <${Btn} kind="dark" confirm=${next[1]} onClick=${() => send('nuit', 'next')}>${next[0]}</${Btn}>
    </div>
    ${N.st !== 'evasion' ? html`<p class="label" style="margin-top:18px">Les monstres</p>
      ${v.players.map((p) => {
        const st = N.status[p.id];
        const out = N.out[p.id];
        return html`<div class="frow ${who === p.id ? 'on' : ''}" key=${p.id} onClick=${() => setWho(who === p.id ? null : p.id)}>
          <${Av} src=${p.av} size=${30} />
          <span class="fname"><b>${p.name} ${p.last || ''}</b><span>${p.monster ? p.monster.name : ''} · ${STATUS[st] || '?'}${out ? ' · hors zone' : ''}${N.powers[p.id] && N.powers[p.id].used ? ' · pouvoir utilisé' : ''}</span></span>
          <span class="dot ${p.on ? 'on' : ''}"></span>
        </div>
        ${who === p.id ? html`<div class="btns" style="margin:4px 0 8px">
          ${st === 'monstre' ? html`<${Btn} small kind="red" confirm="Exorciser ?" onClick=${() => send('nuit', 'exorcise', { pid: p.id, by: 'mj' })}>Exorciser</${Btn}>` : null}
          ${st === 'monstre' && N.st === 'refuge' ? html`<${Btn} small kind="ghost" confirm="Sauver ?" onClick=${() => send('nuit', 'save', { pid: p.id })}>Le sauver</${Btn}>` : null}
          ${st !== 'monstre' ? html`<${Btn} small kind="ghost" confirm="Le ramener ?" onClick=${() => send('nuit', 'revive', { pid: p.id })}>Redevenir monstre</${Btn}>` : null}
        </div>` : null}`;
      })}` : null}
    <p class="label" style="margin-top:18px">Journal</p>
    <ul class="feed">${N.feed.slice().reverse().map((f) => html`<li key=${f.id}><span>${hm(f.t)}</span>${f.text}</li>`)}</ul>`;
}

function Fin({ v, pub, send }) {
  const R = v.nuit.results || { saved: [], exo: [], lost: [], hunters: {} };
  return html`
    <div class="stats" style="margin-bottom:14px">
      <div class="stat"><b>${R.saved.length}</b><span>sauvés</span></div>
      <div class="stat"><b>${R.exo.length}</b><span>exorcisés</span></div>
      <div class="stat"><b>${R.hunters.mj || 0}</b><span>captures pour toi</span></div>
    </div>
    <p class="lead">La nuit est terminée. Kebab time.</p>
    <div class="stack" style="margin-top:16px">
      <${Btn} kind="ghost" confirm="Effacer les scores et revenir à l’accueil ?" onClick=${() => send('nuit', 'reset')}>Préparer une nouvelle partie</${Btn}>
    </div>`;
}

// ===================== chasse =====================

function Chasse({ v, pub, send, clock, gps, sim }) {
  const N = v.nuit;
  const [view, setView] = useState('chasseur');
  useNow(5000);
  const names = Object.fromEntries(v.players.map((p) => [p.id, p]));
  const now = clock();
  if (N.st === 'idle' || N.st === 'evasion') {
    return html`<p class="lead muted">La chasse commence quand les monstres sortent de la maison. Ta position sera envoyée aux autres chasseurs, et tu verras ici chaque signalement.</p>
      ${N.st === 'evasion' ? html`<p class="small" style="margin-top:12px">Évasion en cours : fin dans <${Countdown} to=${N.endsAt} clock=${clock} short />.</p>` : null}`;
  }
  const monsterMarks = view === 'arbitre'
    ? Object.entries(N.pos).filter(([id]) => N.status[id] === 'monstre').map(([id, p]) => ({ id, lat: p.lat, lng: p.lng, av: names[id] && names[id].av, kind: 'monstre', label: `${names[id] ? names[id].name : '?'}${N.out[id] ? ', hors zone' : ''}`, dim: now - p.t > 60000 }))
    : (N.sights || []).map((s) => {
      const m = Math.floor((now - s.t) / 60000);
      return { id: s.id, lat: s.lat, lng: s.lng, av: names[s.pid] && names[s.pid].av, kind: 'monstre', label: `${names[s.pid] ? names[s.pid].name : '?'}${s.kind === 'horszone' ? ', hors zone' : m >= 1 ? `, il y a ${m} min` : ''}` };
    });
  const hunterMarks = Object.entries(N.hpos || {}).filter(([id]) => id !== 'mj').map(([id, p]) => ({ id, lat: p.lat, lng: p.lng, av: names[id] && names[id].av, kind: 'chasseur', label: names[id] && names[id].name }));
  const blind = view === 'chasseur' && N.blindUntil > now;
  return html`
    <div class="head" style="margin-bottom:10px"><span class="small muted">${N.st === 'refuge' ? 'Avant le dernier départ' : 'Avant la fin de l’alerte'}</span>
      <div class="timer"><span class="t" style="font-size:44px"><${Countdown} to=${N.endsAt} clock=${clock} /></span></div></div>
    <div style="position:relative;height:50dvh">
      <div class="mapbox" style="position:absolute;inset:0">
        <${GameMap} center=${N.center} radius=${N.cfg.radius} refuge=${view === 'arbitre' ? N.refugePt : null} me=${gps.pos} marks=${[...monsterMarks, ...hunterMarks]} blind=${blind} onTap=${sim ? (p) => gps.moveTo(p) : null} />
        <span class="pill maptag"><${Icon} n="radio" s=${14} />${N.huntAt > now ? `Tu sors dans ${fmtShort(N.huntAt - now)}` : `Signalement dans ${fmtShort(N.nextSight - now)}`}</span>
      </div>
    </div>
    <div class="seg" style="margin-top:8px">
      <button class=${view === 'chasseur' ? 'on' : ''} onClick=${() => setView('chasseur')}>Vue chasseur</button>
      <button class=${view === 'arbitre' ? 'on' : ''} onClick=${() => setView('arbitre')}>Vue arbitre</button>
    </div>
    <p class="sub">${view === 'arbitre' ? 'Positions réelles de tous les monstres, en direct. Ne la montre à personne.' : 'Ce que voient tous les chasseurs : le dernier signalement.'}${sim ? ' Démo : touche la carte pour te déplacer.' : ''}</p>
    ${gps.err ? html`<div class="alert" style="margin-top:8px">${gps.err}</div>` : null}
    <p class="label" style="margin-top:16px">Exorcismes</p>
    ${(N.mine || []).length ? N.mine.slice().sort((a, b) => b.at - a.at).map((x) => html`<div class="frow" key=${x.id}>
      <${Av} src=${names[x.id] && names[x.id].av} size=${30} />
      <span class="fname"><b>${names[x.id] ? `${names[x.id].name} ${names[x.id].last || ''}` : '?'}</b><span>par ${x.by === 'mj' ? 'toi' : names[x.by] ? names[x.by].name : '?'}</span></span>
      <span class="ok" style="font-family:Gloock;font-size:18px">en ${mins(x.after)} min</span>
    </div>`) : html`<p class="small muted">Aucun pour l’instant. Le monstre attrapé le déclare lui-même en glissant le bouton rouge de son téléphone.</p>`}`;
}

// ===================== démo =====================

function Demo({ v, send }) {
  const n = v.players.filter((p) => p.id.startsWith('bot-')).length;
  const idle = v.nuit.st === 'idle';
  // place la maison sur ta position et le refuge à environ 600 m
  const here = () => navigator.geolocation && navigator.geolocation.getCurrentPosition((p) => {
    const c = { lat: p.coords.latitude, lng: p.coords.longitude };
    send('nuit', 'center', c);
    send('nuit', 'refugePt', { lat: c.lat + 0.004, lng: c.lng + 0.0045 });
  }, () => alert('Position indisponible : place la zone à la main dans l’onglet Terrain.'), { enableHighAccuracy: true, timeout: 15000 });
  return html`
    <p class="lead muted" style="margin-bottom:16px">Teste toute la partie seul, avant la soirée. Rien n’est enregistré dans la vraie partie.</p>
    <div class="orow"><${Icon} n="ghost" /><span class="olbl">Monstres virtuels<small>Ils jouent tout seuls : énigmes, fuite, exorcismes</small></span>
      <${Stepper} value=${n} min=${0} max=${12} onChange=${(x) => idle && send('demo', 'count', { n: x })} /></div>
    <div class="orow"><${Icon} n="timer" /><span class="olbl">Vitesse<small>${v.speed > 1 ? `80 min de partie en ${Math.round(80 / v.speed)} min` : 'Temps réel'}</small></span></div>
    <div class="seg" style="margin-top:5px">${[1, 5, 10, 20].map((x) => html`<button class=${v.speed === x ? 'on' : ''} onClick=${() => send('demo', 'speed', { s: x })}>×${x}</button>`)}</div>
    ${!idle ? html`<p class="sub">Le nombre de monstres virtuels se règle avant le lancement.</p>` : null}
    <div class="row" style="margin-top:10px"><${Icon} n="smartphone" s=${16} /><span class="small">Pour jouer un monstre toi-même, passe sur l’onglet Joueur tout en haut. Tes déplacements se font en touchant la carte.</span></div>
    <div class="stack" style="margin-top:16px">
      ${idle ? html`<${Btn} kind="ghost" icon="locate-fixed" onClick=${here}>Placer la zone autour de moi</${Btn}>` : null}
      <${Btn} kind="ghost" confirm="Recommencer la partie de démo ?" onClick=${() => send('demo', 'reset')}>Recommencer la partie</${Btn}>
    </div>
    ${idle && !v.nuit.center ? html`<p class="sub">Ou place la maison et le refuge à la main dans l’onglet Terrain.</p>` : null}`;
}
