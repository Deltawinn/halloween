// Panneau du maître du jeu (sur son téléphone) : terrain, énigmes, pilotage de la nuit, chasse, démo.
import {
  html, useState, useEffect, useMemo, useSource, useNow, Countdown, Icon, Ex, Av, Btn, Pill, Sheet, Stepper, Toasts, Status,
  keepAwake, fmt, fmtShort, hm, mins, plural, ORD, SYM_ICON, Safe,
} from './kit.js';
import { GameMap } from './map.js';
import { useGps } from './gps.js';
import { unlockAudio } from './sound.js';
import { SYMBOLS, MAP_STYLES, ENIGMA_POOL } from '../data.js';

const STATUS = { monstre: 'Monstre', exorcise: 'Exorcisé', sauve: 'Sauvé' };

const ACT_TAB = { idle: 'prep', evasion: 'a1', alerte: 'a2', refuge: 'a3', fin: 'a3' };

export function MjApp({ client }) {
  useSource(client);
  const v = client.mj;
  const pub = client.pub;
  const N = v && v.nuit;
  const [tab, setTab] = useState(() => (N ? ACT_TAB[N.st] : 'prep'));
  // en pause, les chronos se figent
  const clock = () => (client.mj && client.mj.nuit && client.mj.nuit.pausedAt) || client.now();
  useEffect(() => {
    const wake = () => { unlockAudio(); keepAwake(); };
    document.addEventListener('pointerdown', wake, { once: true });
  }, []);
  // on suit l'acte en cours
  useEffect(() => { if (N) setTab(ACT_TAB[N.st] || 'prep'); }, [N && N.st]);
  const outside = N && (N.st === 'alerte' || N.st === 'refuge');
  const sim = !!client.local;
  const gps = useGps({ active: !!outside, simulated: sim, start: N && N.center, send: (p) => client.send({ g: 'nuit', a: 'gps', ...p }) });

  if (!v || !pub) {
    return html`<div class="screen"><div class="grow"></div><p class="lead center muted">${client.status === 'ok' ? 'En attente de l’écran TV… Vérifie que la page de la TV est ouverte.' : 'Connexion au relais…'}</p><div class="grow"></div>
      <${Status} status=${client.status} hostAlive=${client.hostAlive()} /></div>`;
  }
  const send = (g, a, x) => client.send({ g, a, ...(x || {}) });
  const sos = v.alerts.filter((a) => a.kind === 'sos' && clock() - a.t < 15 * 60000);
  const tabs = [['prep', 'Préparation'], ['a1', 'Acte 1'], ['a2', 'Acte 2'], ['a3', 'Acte 3']];
  if (v.demo) tabs.push(['demo', 'Démo']);
  const titles = { prep: 'Préparation', a1: 'L’Évasion', a2: 'L’Alerte', a3: 'Le Refuge', demo: 'Mode démo' };
  const P = { v, pub, send, clock, gps, sim };
  let body;
  if (tab === 'prep') body = html`<${Prep} ...${P} />`;
  else if (tab === 'a1') body = html`<${Act1} ...${P} />`;
  else if (tab === 'a2') body = html`<${Act2} ...${P} />`;
  else if (tab === 'a3') body = html`<${Act3} ...${P} />`;
  else body = html`<${Demo} v=${v} send=${send} />`;
  return html`<div class="screen">
      <p class="eyebrow">Maître du jeu${v.demo ? ' · démo' : ''}</p>
      <${Ex} size=${40} depth=${5}>${titles[tab]}</${Ex}>
      <nav class="mjtabs" style="margin-top:14px">${tabs.map(([k, l]) => html`<button class="${tab === k ? 'on' : ''} ${ACT_TAB[N.st] === k && k !== 'prep' ? 'live' : ''}" onClick=${() => setTab(k)}>${l}</button>`)}</nav>
      ${sos.map((a) => html`<div class="sos" key=${a.id}><b>${a.text}</b><div class="small">${hm(a.t)}${a.data && a.data.where && a.data.where.lat ? html` · <a class="ok" target="_blank" href=${`https://maps.google.com/?q=${a.data.where.lat},${a.data.where.lng}`}>voir sur un plan</a>` : ''}</div></div>`)}
      <${Safe}>${body}</${Safe}>
    </div>
    <${Toasts} alerts=${v.alerts.filter((a) => a.kind !== 'info')} storeKey=${'hw.mjtoast.' + (client.room || 'demo')} />
    <${Status} status=${client.status} hostAlive=${client.hostAlive()} />
    <div class="grain"></div>`;
}

function Section({ title, sub, open: start = false, children }) {
  const [open, setOpen] = useState(start);
  return html`<div class="section">
    <button class="section-h" onClick=${() => setOpen(!open)}><span>${title}${sub ? html`<small>${sub}</small>` : null}</span><${Icon} n=${open ? 'minus' : 'plus'} s=${18} /></button>
    ${open ? html`<div class="section-b">${children}</div>` : null}
  </div>`;
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
        <${GameMap} center=${N.center} radius=${C.radius} refuge=${N.refugePt} onTap=${tap} mapStyle=${C.mapStyle} />
        <span class="pill maptag"><${Icon} n="map-pin" s=${14} />Touche la carte pour placer ${mode === 'center' ? 'la maison' : 'le refuge'}</span>
      </div>
    </div>
    <div style="margin:8px 0 10px"><${Btn} kind="ghost" small icon="locate-fixed" onClick=${here}>Utiliser ma position ici</${Btn}></div>
    <p class="label">Style de la carte, pour tout le monde</p>
    <div class="seg" style="margin-bottom:16px;flex-wrap:wrap">${Object.entries(MAP_STYLES).map(([k, l]) => html`<button class=${(C.mapStyle || 'nuit') === k ? 'on' : ''} onClick=${() => cfg('mapStyle', k)}>${l}</button>`)}</div>
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

const SYM_LIST = ['skull', 'moon', 'eye', 'flame'];

function Enigmes({ v, send }) {
  const N = v.nuit;
  const X = N.escape;
  const idle = N.st === 'idle';
  const [code, setCode] = useState(X.code);
  const [order, setOrder] = useState(X.order);
  const [ult, setUlt] = useState(X.ultimate);
  const [cards, setCards] = useState(X.cards);
  const [count, setCount] = useState(X.count || 5);
  const [pick, setPick] = useState(null);
  const [clues, setClues] = useState(N.clues);
  const [print, setPrint] = useState(false);
  const [pool, setPool] = useState(false);
  useEffect(() => { setCode(X.code); setOrder(X.order); setUlt(X.ultimate); setCards(X.cards); setCount(X.count || 5); }, [JSON.stringify([X.code, X.order, X.ultimate, X.cards, X.count])]);
  useEffect(() => setClues(N.clues), [JSON.stringify(N.clues)]);
  const dirty = code !== X.code || order.join() !== X.order.join() || ult !== X.ultimate || JSON.stringify(cards) !== JSON.stringify(X.cards) || count !== (X.count || 5);
  const save = () => send('nuit', 'escape', { escape: { code, order, ultimate: ult, cards, count } });
  const swap = (i) => {
    if (pick == null) return setPick(i);
    const o = order.slice();
    [o[pick], o[i]] = [o[i], o[pick]];
    setOrder(o);
    setPick(null);
  };
  const setCard = (i, k, val) => setCards(cards.map((c, j) => (j === i ? { ...c, [k]: val } : c)));
  if (print) return html`<${PrintCards} cards=${cards.slice(0, count)} close=${() => setPrint(false)} />`;
  return html`
    <p class="small muted" style="margin:0 0 12px">Au lancement, l’appli tire au sort ${count} énigmes parmi les 20 de la réserve et les attache aux cartes. Chaque bonne réponse révèle un chiffre et son symbole. ${count === 5 ? 'Le cinquième symbole, le fantôme, est un leurre : l’ultime énigme ne le cite pas.' : ''}</p>
    <p class="label">Nombre d’énigmes par partie</p>
    <div class="seg" style="margin-bottom:14px">${[4, 5].map((n) => html`<button class=${count === n ? 'on' : ''} disabled=${!idle} onClick=${() => setCount(n)}>${n === 5 ? '5, dont un leurre' : '4'}</button>`)}</div>
    <p class="label">Les cartes à cacher</p>
    ${cards.slice(0, count).map((c, i) => html`<div class="two" key=${i} style="margin-bottom:6px;grid-template-columns:110px 1fr">
      <input class="inp" inputmode="numeric" disabled=${!idle} value=${c.num} onInput=${(e) => setCard(i, 'num', e.target.value.replace(/\D/g, '').slice(0, 6))} style="font:400 20px Gloock;color:var(--orange)" />
      <input class="inp" disabled=${!idle} value=${c.room} placeholder="Pièce" onInput=${(e) => setCard(i, 'room', e.target.value)} />
    </div>`)}
    <div class="orow" style="margin-top:10px"><${Icon} n="lock" /><span class="olbl">Code du cadenas<small>Les 4 chiffres de ton vrai cadenas</small></span>
      <input class="inp" style="width:110px;height:40px;text-align:center;font:400 22px Gloock;color:var(--orange)" inputmode="numeric" maxlength="4" disabled=${!idle} value=${code} onInput=${(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} /></div>
    <p class="label" style="margin-top:12px">Ordre des symboles dans le code ${idle ? html`<span class="muted">(touche deux symboles pour les échanger)</span>` : ''}</p>
    <div class="dg">${order.map((sy, i) => html`<div key=${sy} style=${pick === i ? 'border-color:var(--orange)' : ''} onClick=${() => idle && swap(i)}><${Icon} n=${SYM_ICON[sy]} s=${18} /><b>${code[i] || '?'}</b></div>`)}</div>
    <p class="label" style="margin-top:14px">L’ultime énigme</p>
    <textarea class="inp" rows="6" disabled=${!idle} value=${ult} onInput=${(e) => setUlt(e.target.value)}></textarea>
    ${idle && dirty ? html`<div style="margin-top:8px"><${Btn} disabled=${code.length !== 4} onClick=${save}>Enregistrer</${Btn}></div>` : null}
    <div class="stack" style="margin-top:8px">
      <${Btn} kind="ghost" icon="printer" onClick=${() => setPrint(true)}>Imprimer les cartes numérotées</${Btn}>
      <${Btn} kind="ghost" icon="list" onClick=${() => setPool(!pool)}>${pool ? 'Masquer' : 'Voir'} la réserve de 20 énigmes</${Btn}>
    </div>
    ${pool ? ENIGMA_POOL.map((e, i) => html`<div class="erow" key=${i} style="cursor:default"><span class="n" style="min-width:32px">${i + 1}</span><span class="t">${e.q}<small>Réponse : ${e.answers[0]}</small></span></div>`) : null}
    <p class="label" style="margin-top:22px">Les 5 indices du refuge</p>
    <p class="sub" style="margin:-4px 0 10px">Du plus mystérieux au plus évident : le cinquième donne la réponse.</p>
    ${clues.map((c, i) => html`<label class="field" key=${i} style="margin-bottom:8px"><span class="label">Indice ${i + 1}, à ${N.cfg.clueAt[i]} min de la fin</span>
      <textarea class="inp" rows="2" value=${c} onInput=${(e) => { const x = clues.slice(); x[i] = e.target.value; setClues(x); }}></textarea></label>`)}
    ${clues.join('\n') !== N.clues.join('\n') ? html`<${Btn} onClick=${() => send('nuit', 'clues', { clues })}>Enregistrer les indices</${Btn}>` : null}`;
}

function PrintCards({ cards, close }) {
  return html`<div class="noprint stack" style="margin-bottom:12px">
      <${Btn} icon="printer" onClick=${() => window.print()}>Imprimer</${Btn}>
      <button class="link" onClick=${close}>Retour</button>
    </div>
    <div class="print">${cards.map((c) => html`<div class="pcard"><b>${c.num}</b><span>Tape ce numéro dans l’appli</span></div>`)}</div>`;
}

// ===================== préparation =====================

function Prep({ v, send, gps }) {
  const N = v.nuit;
  const ps = v.players;
  const [mjEdit, setMjEdit] = useState(false);
  const [first, setFirst] = useState(v.mj.first);
  const [last, setLast] = useState(v.mj.last);
  const ready = ps.filter((p) => p.monster && p.av).length;
  const idle = N.st === 'idle';
  const warn = [];
  if (!N.center) warn.push('Place la maison dans Terrain.');
  if (!N.refugePt) warn.push('Place le refuge dans Terrain.');
  if (N.clues[0].startsWith('Indice 1 :')) warn.push('Écris les indices du refuge dans Énigmes et indices.');
  return html`
    <div class="stats" style="margin-bottom:12px">
      <div class="stat"><b>${ps.length}</b><span>joueurs</span></div>
      <div class="stat"><b>${ready}</b><span>fiches prêtes</span></div>
      <div class="stat"><b>${N.escape.code}</b><span>code du cadenas</span></div>
    </div>
    ${idle ? html`<div class="stack">
      <${Btn} kind="ghost" icon="tv" onClick=${() => send('core', 'screen', { screen: v.screen === 'intro' ? 'lobby' : 'intro' })}>${v.screen === 'intro' ? 'Revenir à l’accueil sur la TV' : 'Lancer l’intro sur la TV'}</${Btn}>
      <${Btn} icon="play" confirm="Lancer la nuit maintenant ?" onClick=${() => send('nuit', 'start')}>Lancer la partie</${Btn}>
    </div>
    ${warn.length ? html`<div class="alert" style="margin-top:10px">${warn.map((w) => html`<div>${w}</div>`)}</div>` : null}`
    : html`<p class="small muted">La partie est lancée : pilote-la depuis l’onglet de l’acte en cours.</p>`}

    <${Section} title="Les joueurs" sub=${`${ps.length} inscrits`} open=${idle}>
      ${ps.map((p) => html`<div class="frow" key=${p.id}>
        <${Av} src=${p.av} size=${34} />
        <span class="fname"><b>${p.name} ${p.last || ''}</b><span>${p.monster ? p.monster.name : 'Fiche en cours'}</span></span>
        <span class="dot ${p.on ? 'on' : ''}"></span>
        <${Btn} kind="ghost" small confirm="Retirer ?" onClick=${() => send('core', 'kick', { pid: p.id })}><${Icon} n="x" s=${14} /></${Btn}>
      </div>`)}
      ${!ps.length ? html`<p class="small muted">Personne pour l’instant. Les joueurs scannent le QR code affiché sur la TV.</p>` : null}
    </${Section}>

    <${Section} title="Terrain et durées" sub=${N.center && N.refugePt ? 'Maison et refuge placés' : 'À placer'}>
      <${Terrain} v=${v} send=${send} gps=${gps} />
    </${Section}>

    <${Section} title="Énigmes et indices" sub="Escape game et refuge">
      <${Enigmes} v=${v} send=${send} />
    </${Section}>

    <div class="orow" style="margin-top:12px" onClick=${() => setMjEdit(!mjEdit)}><${Icon} n="crosshair" /><span class="olbl">${v.mj.first} ${v.mj.last}<small>Le chasseur, c’est toi</small></span><${Icon} n="chevrons-right" /></div>
    ${mjEdit ? html`<div class="two" style="margin-top:8px"><input class="inp" value=${first} onInput=${(e) => setFirst(e.target.value)} /><input class="inp" value=${last} onInput=${(e) => setLast(e.target.value)} /></div>
      <div style="margin-top:8px"><${Btn} small onClick=${() => { send('core', 'mjName', { first, last }); setMjEdit(false); }}>Enregistrer</${Btn}></div>` : null}`;
}

// ===================== briques des actes =====================

function Clock({ N, clock, label }) {
  return html`<div class="big tnum" style="margin:6px 0 2px;font-size:92px"><${Countdown} to=${N.endsAt} clock=${clock} /></div>
    <p class="small muted" style="margin:0 0 12px">${N.paused ? html`<span class="ok">En pause</span>` : label}</p>`;
}

function TimeBtns({ N, send }) {
  return html`<div class="btns">
    <${Btn} kind="dark" onClick=${() => send('nuit', 'addTime', { min: 5 })}>+5 min</${Btn}>
    <${Btn} kind="dark" onClick=${() => send('nuit', 'addTime', { min: -5 })}>−5 min</${Btn}>
    <${Btn} kind="dark" icon=${N.paused ? 'play' : 'pause'} onClick=${() => send('nuit', N.paused ? 'resume' : 'pause')}>${N.paused ? 'Reprendre' : 'Pause'}</${Btn}>
  </div>`;
}

function Say({ N, send }) {
  const [text, setText] = useState('');
  return html`<div class="card" style="margin-top:12px">
    <p class="label" style="display:flex;gap:8px;align-items:center"><${Icon} n="tv" s=${16} />Écrire un indice sur la TV</p>
    <textarea class="inp" rows="2" value=${text} maxlength="240" placeholder="Ex. : Une carte se cache près de ce qui réchauffe la cuisine." onInput=${(e) => setText(e.target.value)}></textarea>
    <div style="margin-top:8px"><${Btn} icon="sparkles" disabled=${!text.trim()} onClick=${() => { send('nuit', 'say', { text }); setText(''); }}>Afficher sur la TV</${Btn}></div>
    <p class="sub">Il s’affiche en grand sur la TV, reste visible dans un coin, et arrive aussi sur les téléphones.${N.say ? ` Dernier : « ${N.say.text} »` : ''}</p>
  </div>`;
}

function Journal({ N }) {
  return html`<p class="label" style="margin-top:20px">Journal</p>
    <ul class="feed">${N.feed.slice().reverse().map((f) => html`<li key=${f.id}><span>${hm(f.t)}</span>${f.text}</li>`)}</ul>`;
}

function NotYet({ text }) {
  return html`<p class="lead muted" style="margin-top:8px">${text}</p>`;
}

// ===================== acte 1 : l'évasion =====================

function Act1({ v, send, clock }) {
  const N = v.nuit;
  if (N.st === 'idle') return html`<${NotYet} text="L’évasion commence quand tu lances la partie, depuis l’onglet Préparation. Tu pourras ici suivre les énigmes, mettre en pause et écrire des indices sur la TV." />`;
  if (N.st !== 'evasion') {
    const took = Math.round((N.escapedAt - N.startAt) / 60000);
    return html`<p class="lead">${N.timedOut ? `Temps écoulé : le code ${N.escape.code} a été révélé.` : `Évadés en ${took} min.`} Avance donnée : ${N.head} min.</p>`;
  }
  const names = Object.fromEntries(v.players.map((p) => [p.id, p]));
  const hints = Object.values(N.hints).filter((h) => !h.free).length;
  const solved = Object.keys(N.solved).length;
  return html`
    <${Clock} N=${N} clock=${clock} label="avant que le cadenas ne s’ouvre de lui-même" />
    <${TimeBtns} N=${N} send=${send} />
    <div class="stats" style="margin:12px 0"><div class="stat"><b>${Object.keys(N.found).length}</b><span>trouvées</span></div><div class="stat"><b>${solved}</b><span>résolues</span></div><div class="stat"><b>${hints}</b><span>coup${hints > 1 ? 's' : ''} de pouce</span></div><div class="stat"><b>${N.tries}</b><span>essais du code</span></div></div>
    <p class="label">Les énigmes</p>
    ${N.escape.enigmas.map((e) => {
      const f = N.found[e.num];
      const s = N.solved[e.num];
      return html`<div class="erow" key=${e.num} style="cursor:default">
        <span class="n">${e.num}</span>
        <span class="t">${e.q.length > 70 ? e.q.slice(0, 70) + '…' : e.q}<small>${e.room} · réponse : ${e.answers[0]}${e.sym === 'ghost' ? ' · leurre' : ''} · ${s ? `Résolue par ${names[s.pid] ? names[s.pid].name : '?'}` : f ? `Trouvée par ${names[f.pid] ? names[f.pid].name : '?'}, pas encore résolue` : 'Pas encore trouvée'}${N.hints[e.num] ? ' · coup de pouce donné' : ''}</small></span>
        <span class="d"><${Icon} n=${SYM_ICON[e.sym]} s=${16} />${e.sym === 'ghost' ? html`<span title="leurre">${N.escape.decoy}</span>` : N.escape.code[N.escape.order.indexOf(e.sym)]}</span>
      </div>`;
    })}
    <${Say} N=${N} send=${send} />
    <div class="stack" style="margin-top:8px">
      <${Btn} kind="dark" icon="sparkles" onClick=${() => send('nuit', 'hint')}>Révéler le coup de pouce d’une énigme trouvée</${Btn}>
      <${Btn} kind="dark" confirm="Ouvrir le cadenas pour tout le monde ?" onClick=${() => send('nuit', 'next')}>Ouvrir le cadenas et lancer l’alerte</${Btn}>
    </div>
    <${Journal} N=${N} />`;
}

// ===================== acte 2 : l'alerte =====================

function HuntMap({ v, clock, gps, sim, arbitre, refuge }) {
  const N = v.nuit;
  useNow(5000);
  const names = Object.fromEntries(v.players.map((p) => [p.id, p]));
  const now = clock();
  const monsters = arbitre
    ? Object.entries(N.pos).filter(([id]) => N.status[id] === 'monstre').map(([id, p]) => ({ id, lat: p.lat, lng: p.lng, av: names[id] && names[id].av, kind: 'monstre', label: `${names[id] ? names[id].name : '?'}${N.out[id] ? ', hors zone' : ''}`, dim: now - p.t > 60000 }))
    : (N.sights || []).map((s) => {
      const m = Math.floor((now - s.t) / 60000);
      return { id: s.id, lat: s.lat, lng: s.lng, av: names[s.pid] && names[s.pid].av, kind: 'monstre', label: `${names[s.pid] ? names[s.pid].name : '?'}${s.kind === 'horszone' ? ', hors zone' : m >= 1 ? `, il y a ${m} min` : ''}` };
    });
  const hunters = Object.entries(N.hpos || {}).filter(([id]) => id !== 'mj').map(([id, p]) => ({ id, lat: p.lat, lng: p.lng, av: names[id] && names[id].av, kind: 'chasseur', label: names[id] && names[id].name }));
  return html`<div style="position:relative;height:48dvh">
    <div class="mapbox" style="position:absolute;inset:0">
      <${GameMap} center=${N.center} radius=${refuge ? null : N.cfg.radius} refuge=${arbitre || refuge ? N.refugePt : null} me=${gps.pos} marks=${[...monsters, ...hunters]}
        blind=${!arbitre && N.blindUntil > now} mapStyle=${N.cfg.mapStyle} onTap=${sim ? (p) => gps.moveTo(p) : null} />
      <span class="pill maptag"><${Icon} n="radio" s=${14} />${N.huntAt > now ? `Tu sors dans ${fmtShort(N.huntAt - now)}` : `Signalement dans ${fmtShort(N.nextSight - now)}`}</span>
    </div>
  </div>
  ${gps.err ? html`<div class="alert" style="margin-top:8px">${gps.err}</div>` : null}`;
}

function Monsters({ v, send, refuge }) {
  const N = v.nuit;
  const [who, setWho] = useState(null);
  return html`<p class="label" style="margin-top:18px">Les monstres</p>
    ${v.players.map((p) => {
      const st = N.status[p.id];
      return html`<div class="frow ${who === p.id ? 'on' : ''}" key=${p.id} onClick=${() => setWho(who === p.id ? null : p.id)}>
        <${Av} src=${p.av} size=${30} />
        <span class="fname"><b>${p.name} ${p.last || ''}</b><span>${p.monster ? p.monster.name : ''} · ${STATUS[st] || '?'}${N.out[p.id] ? ' · hors zone' : ''}${N.powers[p.id] && N.powers[p.id].used ? ' · pouvoir utilisé' : ''}</span></span>
        <span class="dot ${p.on ? 'on' : ''}"></span>
      </div>
      ${who === p.id ? html`<div class="btns" style="margin:4px 0 8px">
        ${st === 'monstre' ? html`<${Btn} small kind="red" confirm="Exorciser ?" onClick=${() => send('nuit', 'exorcise', { pid: p.id, by: 'mj' })}>Exorciser</${Btn}>` : null}
        ${st === 'monstre' && refuge ? html`<${Btn} small kind="ghost" confirm="Sauver ?" onClick=${() => send('nuit', 'save', { pid: p.id })}>Le sauver</${Btn}>` : null}
        ${st !== 'monstre' ? html`<${Btn} small kind="ghost" confirm="Le ramener ?" onClick=${() => send('nuit', 'revive', { pid: p.id })}>Redevenir monstre</${Btn}>` : null}
      </div>` : null}`;
    })}`;
}

function Exos({ v }) {
  const N = v.nuit;
  const names = Object.fromEntries(v.players.map((p) => [p.id, p]));
  return html`<p class="label" style="margin-top:18px">Exorcismes</p>
    ${(N.mine || []).length ? N.mine.slice().sort((a, b) => b.at - a.at).map((x) => html`<div class="frow" key=${x.id} style="cursor:default">
      <${Av} src=${names[x.id] && names[x.id].av} size=${30} />
      <span class="fname"><b>${names[x.id] ? `${names[x.id].name} ${names[x.id].last || ''}` : '?'}</b><span>par ${x.by === 'mj' ? 'toi' : names[x.by] ? names[x.by].name : '?'}</span></span>
      <span class="ok" style="font-family:Gloock;font-size:18px">en ${mins(x.after)} min</span>
    </div>`) : html`<p class="small muted">Aucun pour l’instant. Le monstre attrapé le déclare lui-même en glissant le bouton rouge de son téléphone.</p>`}`;
}

function Act2({ v, send, clock, gps, sim }) {
  const N = v.nuit;
  if (N.st === 'idle' || N.st === 'evasion') return html`<${NotYet} text="L’alerte générale commence quand le cadenas s’ouvre. Tu verras ici la carte de la chasse, les monstres et les exorcismes." />`;
  if (N.st !== 'alerte') return html`<p class="lead">L’alerte est terminée. ${plural(N.count.exorcises, 'monstre exorcisé', 'monstres exorcisés')}.</p><${Exos} v=${v} />`;
  return html`
    <${Clock} N=${N} clock=${clock} label="avant la fin de l’alerte" />
    <${TimeBtns} N=${N} send=${send} />
    <div class="stats" style="margin:12px 0"><div class="stat"><b>${N.count.monstres}</b><span>monstres libres</span></div><div class="stat"><b>${N.count.exorcises}</b><span>exorcisés</span></div></div>
    <${HuntMap} v=${v} clock=${clock} gps=${gps} sim=${sim} />
    <p class="sub">Les monstres apparaissent à chaque signalement (toutes les ${N.cfg.every} min), ou toutes les 10 s s’ils sortent de la zone. Les autres chasseurs sont visibles en direct.${sim ? ' Démo : touche la carte pour te déplacer.' : ''}</p>
    <${Exos} v=${v} />
    <${Monsters} v=${v} send=${send} />
    <${Say} N=${N} send=${send} />
    <div class="stack" style="margin-top:8px"><${Btn} kind="dark" confirm="Finir l’alerte maintenant ?" onClick=${() => send('nuit', 'next')}>Finir l’alerte et passer au refuge</${Btn}></div>
    <${Journal} N=${N} />`;
}

// ===================== acte 3 : le refuge =====================

function Act3({ v, pub, send, clock, gps, sim }) {
  const N = v.nuit;
  useNow(1000);
  if (N.st === 'fin') return html`<${Fin} v=${v} send=${send} />`;
  if (N.st !== 'refuge') return html`<${NotYet} text="Le refuge commence à la fin de l’alerte générale. Tu verras ici les indices qui se débloquent, qui est arrivé, et tu pourras terminer la nuit." />`;
  const now = clock();
  return html`
    <${Clock} N=${N} clock=${clock} label="avant le dernier départ" />
    <${TimeBtns} N=${N} send=${send} />
    <div class="stats" style="margin:12px 0"><div class="stat"><b>${N.count.monstres}</b><span>encore dehors</span></div><div class="stat"><b>${N.count.sauves}</b><span>sauvés</span></div><div class="stat"><b>${N.count.exorcises}</b><span>exorcisés</span></div></div>
    <p class="small muted" style="margin:0 0 12px">${N.onlyHunters ? 'Plus aucun monstre : les exorcisés cherchent le refuge pour le détruire.' : 'Un monstre qui atteint le refuge rentre chez lui. Si un exorcisé l’atteint avant, tous les monstres encore dehors sont exorcisés. Toi, tu ne déclenches rien en y allant.'}</p>
    <p class="label">Les indices</p>
    ${(N.tiles || []).map((t) => html`<div class="erow" key=${t.k} style="cursor:default;opacity:${t.open ? 1 : 0.55}">
      <span class="n">${t.k + 1}</span><span class="t">${N.clues[t.k]}<small>${t.open ? 'Débloqué' : `Se débloque dans ${fmtShort(t.at - now)}`}</small></span></div>`)}
    <div style="margin-top:14px"><${HuntMap} v=${v} clock=${clock} gps=${gps} sim=${sim} refuge /></div>
    <p class="sub">Pendant la course, les joueurs n’ont plus de carte. Toi, tu vois encore les signalements et le refuge.</p>
    <${Monsters} v=${v} send=${send} refuge />
    <div class="stack" style="margin-top:12px"><${Btn} kind="dark" confirm="Faire partir le dernier portail ?" onClick=${() => send('nuit', 'next')}>Terminer la nuit</${Btn}></div>
    <${Journal} N=${N} />`;
}

function Fin({ v, send }) {
  const R = v.nuit.results || { saved: [], exo: [], lost: [], hunters: {} };
  return html`
    <div class="stats" style="margin-bottom:14px">
      <div class="stat"><b>${R.saved.length}</b><span>sauvés</span></div>
      <div class="stat"><b>${R.captures ?? R.exo.length}</b><span>exorcismes</span></div>
      <div class="stat"><b>${R.hunters.mj || 0}</b><span>captures pour toi</span></div>
    </div>
    <p class="lead">${R.sealedBy ? (R.destroyed ? 'Le refuge a été détruit.' : 'Un exorcisé a atteint le refuge le premier.') : R.allCaught ? 'Tous les monstres ont été exorcisés : victoire des chasseurs.' : 'Le dernier portail est parti.'} Kebab time.</p>
    <div class="stack" style="margin-top:16px">
      <${Btn} kind="ghost" confirm="Effacer les scores et revenir à l’accueil ?" onClick=${() => send('nuit', 'reset')}>Préparer une nouvelle partie</${Btn}>
    </div>`;
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
