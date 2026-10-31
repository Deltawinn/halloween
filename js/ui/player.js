// Téléphone d'un joueur : inscription, puis les trois actes de la nuit.
import {
  html, useState, useEffect, useRef, useMemo, useSource, useNow, Countdown, Icon, Ex, Av, Btn, Pill, Steps, Scene,
  Sheet, Slide, Toasts, Status, keepAwake, Safe, Title, fmt, fmtShort, hm, mins, plural, ordinal, ORD, SYM_ICON,
} from './kit.js';
import { GameMap } from './map.js';
import { useGps } from './gps.js';
import { unlockAudio, play } from './sound.js';
import { grab, stylize, botFace } from '../pixel.js';
import { MONSTERS, SYMBOLS } from '../data.js';
import { store } from '../net.js';
import { haversine } from '../host/util.js';
import { InstallHelp, isStandalone, isPhone } from './join.js';

const lk = (c, k) => `hw.p.${c.room || 'demo'}.${k}`;
function useFlag(client, key) {
  const k = lk(client, key);
  const [v, set] = useState(() => !!store.get(k));
  return [v, (x) => { store.set(k, !!x); set(!!x); }];
}

export function PlayerApp({ client }) {
  useSource(client);
  const pub = client.pub;
  const v = client.priv;
  // en pause, tous les chronos se figent
  const clock = () => {
    const n = (client.priv && client.priv.nuit) || (client.pub && client.pub.nuit);
    return (n && n.pausedAt) || client.now();
  };
  useEffect(() => {
    const wake = () => { unlockAudio(); keepAwake(); };
    document.addEventListener('pointerdown', wake, { once: true });
  }, []);

  if (!pub) return html`<${Opening} client=${client} />`;
  // la vue privée (énigmes, statut…) peut arriver un instant après la vue publique : on suit la privée
  const N = (v && v.nuit) || pub.nuit || { st: 'idle' };
  const me = v && v.me;
  let body;
  if (!client.id) body = html`<${Onboard} client=${client} pub=${pub} />`;
  else if (!me) body = html`<div class="screen"><div class="grow"></div><p class="lead center muted">Le portail te reconnaît…</p><div class="grow"></div></div>`;
  else if (me.gone) body = html`<div class="screen"><div class="grow"></div><${Ex} size=${44}>Banni</${Ex}><p class="lead" style="margin-top:16px">Le maître du jeu t’a retiré de la partie.</p><div class="grow"></div><${Btn} kind="ghost" onClick=${() => client.forget()}>Recommencer</${Btn}></div>`;
  else if (N.st === 'idle') body = html`<${Lobby} client=${client} pub=${pub} v=${v} />`;
  else if (N.st === 'evasion') body = html`<${Evasion} client=${client} pub=${pub} v=${v} clock=${clock} />`;
  else if (N.st === 'fin') body = html`<${Results} client=${client} pub=${pub} v=${v} />`;
  else body = html`<${Outside} client=${client} pub=${pub} v=${v} clock=${clock} />`;
  return html`<${Safe}>${body}</${Safe}>
    <${Toasts} alerts=${v && v.alerts} storeKey=${lk(client, 'toast')} />
    <${Status} status=${client.status} hostAlive=${client.hostAlive()} />
    <div class="grain"></div>`;
}

function Opening({ client }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 10000); return () => clearTimeout(t); }, []);
  const rescan = () => { store.del('hw.lastJoin'); history.replaceState(null, '', location.pathname + '?app=1'); location.reload(); };
  return html`<div class="screen"><div class="grow"></div>
    <p class="lead center muted">Ouverture du portail…</p>
    ${slow ? html`<p class="small center muted" style="margin-top:10px">L’écran TV ne répond pas. La partie n’a peut-être pas encore commencé, ou c’est un ancien QR code.</p>
      <div style="margin-top:16px"><${Btn} kind="ghost" icon="scan-face" onClick=${rescan}>Scanner le QR code de la TV</${Btn}></div>` : null}
    <div class="grow"></div>
    <${Status} status=${client.status} hostAlive=${client.hostAlive()} /></div>`;
}

// ===================== inscription =====================

function Onboard({ client, pub }) {
  const [step, setStep] = useState(1);
  const [shot, setShot] = useState(null);
  if (step === 1) return html`<${Welcome} pub=${pub} onGo=${() => { unlockAudio(); keepAwake(); setStep(2); }} />`;
  if (step === 2) return html`<${Selfie} onDone=${(x) => { setShot(x); setStep(3); }} />`;
  return html`<${Portrait} shot=${shot} names retake=${() => setStep(2)} onDone=${async (avatar, first, last) => {
    if (!client.id) await client.register(first);
    client.send({ a: 'identity', first, last });
    if (avatar) client.send({ a: 'avatar', data: avatar });
  }} />`;
}

function Welcome({ pub, onGo }) {
  const n = (pub.players || []).length;
  return html`<div class="screen">
    <div class="scene-bg" style="transform:translateY(-14%)"><${Scene} name="brume" className="scene" style="width:100%;height:100%" /></div>
    <div class="fade" style="background:linear-gradient(180deg,rgba(0,0,0,.55) 0%,transparent 22%,transparent 50%,#000 78%)"></div>
    <div class="pills" style="justify-content:center;margin-top:6px"><${Pill} or icon="moon-star">Halloween, 31 octobre</${Pill}></div>
    <div class="grow" style="min-height:24dvh"></div>
    <${Title} />
    <p class="lead" style="margin-top:22px">Entre. Ne pose aucune question.<br />Tout te sera révélé à la tombée de la nuit.</p>
    ${!isStandalone() && isPhone() ? html`<${InstallHelp} />` : null}
    <div class="bottom">
      <${Btn} onClick=${onGo}>${!isStandalone() && isPhone() ? 'Continuer sans installer' : 'Entrer dans la partie'}</${Btn}>
      <p class="link">${n ? `${plural(n, 'âme')} déjà ${n > 1 ? 'arrivées' : 'arrivée'}` : 'Les âmes sont attendues ce soir'}</p>
    </div>
  </div>`;
}

function Selfie({ onDone }) {
  const video = useRef(null);
  const file = useRef(null);
  const [state, setState] = useState('start'); // start | live | scan | error
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let stream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } }, audio: false });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play().catch(() => {});
        setState('live');
      } catch {
        setState('error');
        setMsg('La caméra est bloquée. Utilise le bouton ci-dessous pour prendre la photo.');
      }
    })();
    return () => stream && stream.getTracks().forEach((t) => t.stop());
  }, []);
  const scan = () => {
    const vd = video.current;
    if (!vd || !vd.videoWidth) return;
    setState('scan');
    play('clue');
    const c = grab(vd, vd.videoWidth, vd.videoHeight, { mirror: true });
    setTimeout(() => onDone({ canvas: c }), 1400);
  };
  const fromFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => { onDone({ canvas: grab(img, img.naturalWidth, img.naturalHeight, { mirror: false }) }); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(f);
  };
  return html`<div class="screen">
    <div class="topbar"><span>Ton identité</span><span>1 sur 3</span></div>
    <${Steps} n=${1} of=${3} />
    <${Ex} size=${52}>Analyse de<br />ton visage</${Ex}>
    <div class="cam" style="margin-top:22px">
      <video ref=${video} playsinline muted autoplay></video>
      <svg class="frame" viewBox="0 0 346 430" preserveAspectRatio="none">
        <ellipse cx="173" cy="196" rx="84" ry="110" fill="none" stroke="#ff7a1a" stroke-width="1.6" stroke-dasharray="6 6" />
        <g stroke="#f4e4d0" stroke-width="2" fill="none"><path d="M20 50 V20 H50" /><path d="M296 20 H326 V50" /><path d="M20 380 V410 H50" /><path d="M296 410 H326 V380" /></g>
      </svg>
      ${state === 'scan' || state === 'live' ? html`<div class="scan" style=${state === 'scan' ? 'animation-duration:.5s' : ''}></div>` : null}
      <p class="msg">${state === 'scan' ? 'Analyse en cours…' : state === 'live' ? 'Place ton visage dans l’ovale.' : msg || 'Ouverture de la caméra…'}</p>
    </div>
    <input ref=${file} type="file" accept="image/*" capture="user" style="display:none" onChange=${fromFile} />
    <div class="bottom">
      ${state === 'error'
        ? html`<${Btn} icon="camera" onClick=${() => file.current.click()}>Prendre la photo</${Btn}>`
        : html`<${Btn} icon="scan-face" disabled=${state !== 'live'} onClick=${scan}>Lancer l’analyse</${Btn}>`}
      <button class="link" onClick=${() => onDone({ data: botFace(Math.floor(Math.random() * 9999)) })}>Pas de caméra ? Portrait mystère</button>
    </div>
  </div>`;
}

const STYLES = [['pixel', 'Pixel']];

function Portrait({ shot, retake, onDone, names }) {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [style, setStyle] = useState('pixel');
  const [sending, setSending] = useState(false);
  const looks = useMemo(() => {
    if (!shot) return {};
    if (shot.data) return { pixel: shot.data };
    return Object.fromEntries(STYLES.map(([k]) => [k, stylize(shot.canvas, k)]));
  }, [shot]);
  const keys = STYLES.filter(([k]) => looks[k]);
  const pick = looks[style] ? style : keys[0] && keys[0][0];
  const avatar = looks[pick];
  const ok = !names || first.trim().length > 0;
  return html`<div class="screen">
    ${names ? html`<div class="topbar"><span>Ton identité</span><span>2 sur 3</span></div><${Steps} n=${2} of=${3} />` : null}
    <${Ex} size=${52}>Ton portrait</${Ex}>
    <div class="portrait" style="margin-top:20px"><${Av} src=${avatar} size=${168} /></div>
    ${keys.length > 1 ? html`<div class="seg">${keys.map(([k, l]) => html`<button class=${pick === k ? 'on' : ''} onClick=${() => setStyle(k)}>${l}</button>`)}</div>
      <p class="sub center">Choisis le style qui te ressemble le plus.</p>` : null}
    ${names ? html`<div class="two" style="margin-top:18px">
      <label class="field"><span class="label">Prénom</span><input class="inp" value=${first} maxlength="18" autocomplete="given-name" onInput=${(e) => setFirst(e.target.value)} /></label>
      <label class="field"><span class="label">Nom</span><input class="inp" value=${last} maxlength="24" autocomplete="family-name" onInput=${(e) => setLast(e.target.value)} /></label>
    </div>` : null}
    <div class="bottom">
      <${Btn} disabled=${!ok || sending || !avatar} onClick=${async () => { setSending(true); await onDone(avatar, first.trim(), last.trim()); }}>${sending ? 'Ouverture…' : names ? 'Continuer' : 'Garder ce portrait'}</${Btn}>
      <button class="link" onClick=${retake}>Reprendre la photo</button>
    </div>
  </div>`;
}

function Lobby({ client, pub, v }) {
  const me = v.me;
  const [fiche, setFiche] = useFlag(client, 'fiche');
  const [edit, setEdit] = useState(null);
  const [shot, setShot] = useState(null);
  if (edit === 'photo') return html`<${Selfie} onDone=${(x) => { setShot(x); setEdit('style'); }} />`;
  if (edit === 'style') return html`<${Portrait} shot=${shot} retake=${() => setEdit('photo')} onDone=${(a) => { client.send({ a: 'avatar', data: a }); setEdit(null); }} />`;
  if (!me.av && !edit) {
    return html`<div class="screen"><div class="grow"></div><p class="lead center muted">Envoi de ton portrait…</p><div class="grow"></div>
      <button class="link" onClick=${() => setEdit('photo')}>Reprendre la photo</button></div>`;
  }
  if (!me.monster || edit === 'monster') return html`<${Monster} client=${client} pub=${pub} me=${me} done=${() => setEdit(null)} />`;
  if (!fiche) return html`<${Fiche} me=${me} ok=${() => setFiche(true)} editPhoto=${() => setEdit('photo')} editMonster=${() => setEdit('monster')} />`;
  return html`<${Waiting} pub=${pub} me=${me} back=${() => setFiche(false)} />`;
}

function Monster({ client, me, done }) {
  const [name, setName] = useState(me.monster ? me.monster.name : '');
  const go = () => { client.send({ a: 'monster', name: name.trim() }); done(); };
  return html`<div class="screen">
    <div class="topbar"><span>Ton identité</span><span>3 sur 3</span></div>
    <${Steps} n=${3} of=${3} />
    <${Ex} size=${52}>Ton monstre</${Ex}>
    <p class="lead muted" style="margin:10px 0 18px">Quel monstre incarnes-tu ce soir ? Tape le nom de ton costume.</p>
    <label class="field"><span class="label">Nom de ton monstre</span>
      <input class="inp" maxlength="30" value=${name} placeholder="Ex. : Art le Clown, la Nonne, un vampire…" onInput=${(e) => setName(e.target.value)}
        onKeyDown=${(e) => { if (e.key === 'Enter' && name.trim()) go(); }} /></label>
    <p class="sub">Un pouvoir secret te sera attribué au début de la partie.</p>
    <div class="bottom">
      <${Btn} disabled=${!name.trim()} onClick=${go}>Continuer</${Btn}>
    </div>
  </div>`;
}

function Fiche({ me, ok, editPhoto, editMonster }) {
  return html`<div class="screen">
    <div class="topbar"><span>Ton identité</span><span>Ta fiche</span></div>
    <${Steps} n=${3} of=${3} />
    <${Ex} size=${52}>Ta fiche</${Ex}>
    <div class="card" style="margin-top:22px;display:flex;gap:16px;align-items:center">
      <button style="background:none;border:0;padding:0" onClick=${editPhoto}><${Av} src=${me.av} size=${84} /></button>
      <div style="min-width:0">
        <p class="eyebrow">${me.name} ${me.last || ''}</p>
        <${Ex} size=${34} depth=${4} tag="h2">${me.monster.name}</${Ex}>
      </div>
    </div>
    <div class="sealed" style="margin-top:8px">
      <div class="ring"><${Icon} n="lock" s=${18} /></div>
      <${Ex} size=${26} depth=${3} tag="h3">Ton pouvoir</${Ex}>
      <p class="small muted" style="margin:0">Scellé jusqu’au début de la partie.</p>
    </div>
    <div class="row" style="margin-top:8px"><${Icon} n="info" s=${16} /><span class="small">Ta fiche reste modifiable jusqu’au lancement de la partie.</span></div>
    <div class="bottom">
      <${Btn} onClick=${ok}>Valider ma fiche</${Btn}>
      <div class="btns"><button class="link" onClick=${editPhoto}>Changer de photo</button><button class="link" onClick=${editMonster}>Changer de monstre</button></div>
    </div>
  </div>`;
}

function Waiting({ pub, me, back }) {
  const ps = pub.players || [];
  const ready = ps.filter((p) => p.mon && p.av).length;
  return html`<div class="screen">
    <div class="scene-bg"><${Scene} name="porte" className="scene" style="width:100%;height:100%" /></div>
    <div class="fade" style="background:linear-gradient(180deg,rgba(0,0,0,.7),transparent 30%,transparent 50%,#000 72%)"></div>
    <p class="eyebrow">Salle d’attente</p>
    <${Ex} size=${50}>La nuit va<br />commencer</${Ex}>
    <div class="grow" style="min-height:30dvh"></div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;justify-items:center">
      ${ps.map((p) => html`<${Av} key=${p.id} src=${p.av} size=${46} />`)}
    </div>
    <div class="pills" style="margin-top:14px">
      <${Pill} or icon="users">${ready} monstre${ready > 1 ? 's' : ''} prêt${ready > 1 ? 's' : ''} sur ${ps.length}</${Pill}>
    </div>
    <p class="small muted" style="margin-top:14px">Le maître du jeu lance la partie depuis son téléphone. Garde cette page ouverte.</p>
    <button class="link" style="text-align:left;padding-top:6px" onClick=${back}>Revoir ma fiche</button>
  </div>`;
}

// ===================== acte 1 : l'évasion =====================

function Evasion({ client, pub, v, clock }) {
  const N = v.nuit;
  const [tab, setTab] = useState('num');
  const [open, setOpen] = useState(null);
  const [pw, setPw] = useState(false);
  const solved = N.solved;
  const allSolved = N.total > 0 && solved === N.total;
  const found = N.enigmas.filter((e) => e.found).length;
  useEffect(() => { if (allSolved) setTab('lock'); }, [allSolved]);
  const cur = open && N.enigmas.find((e) => e.num === open);
  const head = html`<div class="topbar"><span>Acte 1 · Avance : ${N.projectedHead} min</span>
    ${N.power ? html`<button class="pill or" style="cursor:pointer" onClick=${() => setPw(true)}><${Icon} n="zap" s=${13} />Ton pouvoir</button>` : null}</div>`;
  let body;
  if (cur) body = html`<${Enigma} client=${client} e=${cur} N=${N} close=${() => setOpen(null)} head=${head} />`;
  else if (tab === 'num') body = html`<${NumPad} client=${client} N=${N} clock=${clock} head=${head} onOpen=${(n) => setOpen(n)} />`;
  else if (tab === 'list' || !allSolved) body = html`<${EnigmaList} N=${N} head=${head} onOpen=${(n) => setOpen(n)} />`;
  else body = html`<${Padlock} client=${client} N=${N} head=${head} />`;
  return html`<div class="screen has-tabs">${body}</div>
    ${pw ? html`<${PowerSheet} client=${client} v=${v} pub=${pub} close=${() => setPw(false)} />` : null}
    <nav class="tabs">
      <button class="tab ${tab === 'num' && !cur ? 'on' : ''}" onClick=${() => { setOpen(null); setTab('num'); }}><${Icon} n="hash" s=${20} />Numéro</button>
      <button class="tab ${tab === 'list' && !cur ? 'on' : ''}" onClick=${() => { setOpen(null); setTab('list'); }}><${Icon} n="list" s=${20} />Énigmes${found ? html`<span class="badge">${found}</span>` : null}</button>
      ${allSolved ? html`<button class="tab ${tab === 'lock' && !cur ? 'on' : ''}" onClick=${() => { setOpen(null); setTab('lock'); }}><${Icon} n="key-round" s=${20} />Le cadenas<span class="badge">!</span></button>` : null}
    </nav>`;
}

function Load({ from, to, clock }) {
  useNow(1000);
  const p = Math.max(0, Math.min(1, (clock() - from) / Math.max(1, to - from)));
  const n = 40;
  return html`<div class="load">${Array.from({ length: n }, (_, i) => html`<i class=${i < Math.round((1 - p) * n) ? 'd' : ''}></i>`)}</div>`;
}

function NumPad({ client, N, clock, head, onOpen }) {
  const [code, setCode] = useState('');
  const press = (k) => setCode((c) => (c.length < 4 ? c + k : c));
  const go = () => {
    if (!code) return;
    client.act('nuit', 'num', { n: code });
    const known = N.enigmas.find((e) => e.found && e.num === code);
    if (known) onOpen(code);
    else pending.current = code;
    setCode('');
  };
  const pending = useRef(null);
  useEffect(() => {
    if (pending.current && N.enigmas.some((e) => e.found && e.num === pending.current)) { onOpen(pending.current); pending.current = null; }
  }, [N.enigmas.map((e) => e.num).join()]);
  return html`${head}
    <${Ex} size=${50} className="" >L’Évasion</${Ex}>
    <div class="big tnum" style="margin-top:6px"><${Countdown} to=${N.endsAt} clock=${clock} /></div>
    <${Load} from=${N.startAt} to=${N.endsAt} clock=${clock} />
    <div class="pills" style="margin:14px 0 18px">
      <${Pill} or>${plural(N.solved, 'énigme résolue', 'énigmes résolues')} sur ${N.total}</${Pill}>
      <${Pill}>${N.enigmas.filter((e) => e.found).length} carte${N.enigmas.filter((e) => e.found).length > 1 ? 's' : ''} trouvée${N.enigmas.filter((e) => e.found).length > 1 ? 's' : ''}</${Pill}>
    </div>
    ${N.say ? html`<div class="row on" style="margin:-6px 0 14px"><${Icon} n="sparkles" s=${16} /><span class="small">Le maître du jeu : ${N.say.text}</span></div>` : null}
    <p class="label">Tu as trouvé un numéro ? Tape-le.</p>
    <div class="digits">${[0, 1, 2, 3].map((i) => html`<b class="${i === code.length ? 'cur' : ''} ${code[i] ? '' : 'e'}">${code[i] || '·'}</b>`)}</div>
    <div class="keys" style="margin-top:16px">
      ${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => html`<button onClick=${() => press(k)}>${k}</button>`)}
      <button class="k" onClick=${() => setCode('')}>Effacer</button>
      <button onClick=${() => press('0')}>0</button>
      <button class="k go" onClick=${go}>Ouvrir</button>
    </div>`;
}

function EnigmaList({ N, head, onOpen }) {
  return html`${head}
    <${Ex} size=${50}>Les énigmes</${Ex}>
    <p class="lead muted" style="margin:10px 0 18px">${N.total} cartes numérotées sont cachées dans la maison. Chaque bonne réponse révèle un chiffre et son symbole.</p>
    ${N.enigmas.map((e, i) => e.found
      ? html`<button class="erow" onClick=${() => onOpen(e.num)}>
          <span class="n">${e.num}</span>
          <span class="t">${e.solvedBy ? 'Résolue' : 'À résoudre'}<small>Trouvée dans : ${e.room || 'la maison'}</small></span>
          ${e.solvedBy ? html`<span class="d"><${Icon} n=${SYM_ICON[e.sym]} s=${16} />${e.digit}</span>` : html`<${Icon} n="chevrons-right" s=${18} />`}
        </button>`
      : html`<div class="erow" style="opacity:.45;cursor:default"><span class="n">···</span><span class="t">Pas encore trouvée<small>Cherche une carte numérotée</small></span></div>`)}`;
}

function Enigma({ client, e, N, close, head }) {
  const [ans, setAns] = useState('');
  const idx = N.enigmas.findIndex((x) => x.num === e.num);
  const solved = !!e.solvedBy;
  return html`${head}
    <${Ex} size=${50}>Énigme ${e.num}</${Ex}>
    <p class="lead muted" style="margin:10px 0 16px">Trouvée dans : ${e.room || 'la maison'}.</p>
    <div class="card"><p class="just" style="white-space:pre-line">${e.q}</p></div>
    ${e.hint ? html`<div class="row" style="margin-top:8px"><${Icon} n="sparkles" s=${16} /><span class="small">${e.hint}</span></div>` : null}
    ${solved
      ? html`<div class="row on" style="margin-top:16px"><${Icon} n=${SYM_ICON[e.sym]} s=${18} /><span class="lbl">${SYMBOLS[e.sym]} : ${e.digit}<small>Ce chiffre rejoint le cadenas.</small></span></div>`
      : html`<label class="field" style="margin-top:16px"><span class="label">Ta réponse</span>
          <input class="inp" value=${ans} placeholder="Un mot" onInput=${(x) => setAns(x.target.value)} onKeyDown=${(x) => { if (x.key === 'Enter' && ans.trim()) { client.act('nuit', 'answer', { num: e.num, text: ans }); setAns(''); } }} /></label>`}
    <p class="label" style="margin-top:16px">Les chiffres trouvés, dans le désordre</p>
    <${Digits} N=${N} />
    <div class="bottom">
      ${solved ? html`<${Btn} kind="ghost" onClick=${close}>Retour</${Btn}>`
        : html`<${Btn} disabled=${!ans.trim()} onClick=${() => { client.act('nuit', 'answer', { num: e.num, text: ans }); setAns(''); }}>Valider la réponse</${Btn}>`}
      ${!solved && !e.hint ? html`<${Btn} kind="ghost" small confirm="Sûr ? Ça coûte 1 min d’avance" onClick=${() => client.act('nuit', 'hint', { num: e.num })} className="link-btn">Coup de pouce, contre 1 min d’avance</${Btn}>` : null}
      ${!solved ? html`<button class="link" onClick=${close}>Retour</button>` : null}
    </div>`;
}

function Digits({ N }) {
  const got = N.enigmas.filter((e) => e.solvedBy);
  return html`<div class="dg">
    ${Array.from({ length: N.total || 4 }, (_, i) => i).map((i) => {
      const e = got[i];
      return e ? html`<div><${Icon} n=${SYM_ICON[e.sym]} s=${18} /><b>${e.digit}</b></div>` : html`<div class="lock"><${Icon} n="lock" s=${18} /><b>?</b></div>`;
    })}
  </div>`;
}

function Padlock({ client, N, head }) {
  const [code, setCode] = useState('');
  const inp = useRef(null);
  if (N.solved < N.total) {
    return html`${head}
      <${Ex} size=${50}>Le cadenas</${Ex}>
      <p class="lead muted" style="margin:10px 0 18px">Résous toutes les énigmes pour réunir les chiffres.</p>
      <${Digits} N=${N} />`;
  }
  return html`${head}
    <${Ex} size=${50}>L’ultime<br />énigme</${Ex}>
    <p class="lead" style="margin:12px 0 16px">Tous les indices sont réunis, une ultime réponse vous permettra de fuir.</p>
    <${Digits} N=${N} />
    <div class="card" style="margin-top:8px"><p class="disp" style="font-size:20px;line-height:1.4;color:var(--creme);white-space:pre-line">${N.ultimate}</p></div>
    <p class="label" style="margin-top:16px">Le code du cadenas</p>
    <div style="position:relative">
      <div class="digits">${[0, 1, 2, 3].map((i) => html`<b class="${i === code.length ? 'cur' : ''} ${code[i] ? '' : 'e'}">${code[i] || '·'}</b>`)}</div>
      <input ref=${inp} class="codein" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="4" value=${code} aria-label="Code du cadenas"
        onInput=${(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} />
    </div>
    ${N.tries ? html`<p class="sub center">${plural(N.tries, 'tentative ratée', 'tentatives ratées')}.</p>` : null}
    <div class="bottom">
      <${Btn} icon="lock-open" disabled=${code.length !== 4} onClick=${() => { client.act('nuit', 'code', { code }); setCode(''); }}>Tenter le code</${Btn}>
    </div>`;
}

// ===================== actes 2 et 3 : dehors =====================

function Outside({ client, pub, v, clock }) {
  const N = v.nuit;
  const st = N.status;
  const run = N.startAt;
  const [seenFlee, setFlee] = useFlag(client, 'flee' + run);
  const [seenExo, setExo] = useFlag(client, 'exo' + run);
  const [seenRefuge, setRefuge] = useFlag(client, 'refuge' + run);
  const sim = !!client.local;
  const mePlayer = (pub.players || []).find((p) => p.id === v.me.id);
  const gps = useGps({
    active: st === 'monstre' || st === 'exorcise',
    simulated: sim,
    start: N.center ? { lat: N.center.lat + (Math.random() - 0.5) * 0.002, lng: N.center.lng + (Math.random() - 0.5) * 0.002 } : null,
    send: (p) => client.act('nuit', 'gps', p),
  });
  const [outLocal, setOutLocal] = useState(false);
  useEffect(() => setOutLocal(!!N.out), [N.out]);

  if (st === 'sauve') return html`<${Portal} pub=${pub} v=${v} />`;
  if (st === 'exorcise') {
    if (!seenExo) return html`<${Exorcised} pub=${pub} v=${v} go=${() => setExo(true)} />`;
    if (N.st === 'refuge' && !seenRefuge) return html`<${EndAlert} hunter onlyHunters=${N.onlyHunters} go=${() => setRefuge(true)} />`;
    return html`<${Hunter} client=${client} pub=${pub} v=${v} clock=${clock} gps=${gps} sim=${sim} />`;
  }
  if (N.st === 'alerte' && !seenFlee) return html`<${Flee} N=${N} clock=${clock} go=${() => setFlee(true)} />`;
  if (N.st === 'refuge' && !seenRefuge) return html`<${EndAlert} go=${() => setRefuge(true)} />`;
  return html`<${MonsterMap} client=${client} pub=${pub} v=${v} clock=${clock} gps=${gps} sim=${sim} />
    ${N.out && outLocal ? html`<${OutZone} N=${N} pos=${gps.pos} clock=${clock} back=${sim && N.center ? () => { setOutLocal(false); gps.moveTo(N.center); } : null} />` : null}`;
}

function Flee({ N, clock, go }) {
  const took = Math.round((N.escapedAt - N.startAt) / 60000);
  return html`<div class="screen">
    <div class="scene-bg"><${Scene} name="rue" className="scene" style="width:100%;height:100%" /></div>
    <div class="grow" style="min-height:34dvh"></div>
    <p class="eyebrow">${N.timedOut ? 'Le temps est écoulé' : `Évadés en ${took} min`}</p>
    <${Ex} size=${64} depth=${8}>Fuyez</${Ex}>
    <p class="lead" style="margin-top:14px">${N.timedOut ? 'Le cadenas a été forcé, la clé est à vous.' : 'Le cadenas a cédé, la clé est à vous.'} L’alerte générale est déclenchée dans tout le quartier : le chasseur sort dans</p>
    <div class="big" style="margin-top:10px"><${Countdown} to=${N.huntAt} clock=${clock} /></div>
    <div class="bottom">
      <${Btn} icon="map" onClick=${go}>Voir la carte</${Btn}>
      <p class="link">Reste dans le périmètre d’un kilomètre</p>
    </div>
  </div>`;
}

function EndAlert({ go, hunter, onlyHunters }) {
  const title = hunter ? (onlyHunters ? html`Détruis<br />le refuge` : html`La course<br />au refuge`) : 'Bravo';
  const text = hunter
    ? (onlyHunters
      ? 'Tous les monstres ont été exorcisés. Retrouve leur refuge grâce aux indices et détruis-le avant le dernier départ.'
      : 'Les monstres encore libres foncent vers leur refuge. Trouve-le grâce aux indices : si tu y arrives avant eux, tous les monstres encore dehors sont exorcisés.')
    : 'Les chasseurs ont abandonné le secteur. Rejoins le refuge pour rentrer chez toi avant le dernier départ pour l’Hôtel Transylvanie.';
  return html`<div class="screen">
    <div class="scene-bg"><${Scene} name="rue" className="scene" style="width:100%;height:100%" /></div>
    <div class="grow" style="min-height:30dvh"></div>
    <p class="eyebrow">Fin de l’alerte générale</p>
    <${Ex} size=${hunter ? 50 : 64} depth=${8}>${title}</${Ex}>
    <p class="lead" style="margin-top:14px">${text}</p>
    <p class="lead ok" style="margin-top:12px">${hunter ? 'Les indices se débloquent toutes les 4 minutes.' : 'Attention : si un exorcisé atteint le refuge avant toi, tu seras exorcisé.'}</p>
    <div class="bottom"><${Btn} icon="lock-open" onClick=${go}>Voir les indices</${Btn}></div>
  </div>`;
}

function Head({ act, title, to, clock, sub, right }) {
  return html`<div class="topbar"><span>${act}</span><span>${right || ''}</span></div>
    <div class="head" style="margin:4px 0 12px">
      <${Ex} size=${40} depth=${5}>${title}</${Ex}>
      <div class="timer"><span class="t" style="font-size:52px"><${Countdown} to=${to} clock=${clock} /></span><small>${sub}</small></div>
    </div>`;
}

function SightTag({ N, clock }) {
  useNow(1000);
  const now = clock();
  if (N.huntAt > now) return html`<span class="pill or maptag"><${Icon} n="timer" s=${14} />Le chasseur sort dans ${fmtShort(N.huntAt - now)}</span>`;
  return html`<span class="pill maptag"><${Icon} n="radio" s=${14} />Signalement dans ${fmtShort(N.nextSight - now)}</span>`;
}

function MonsterMap({ client, pub, v, clock, gps, sim }) {
  const N = v.nuit;
  const [sheet, setSheet] = useState(null);
  const [show, setShow] = useState(null);
  const refuge = N.st === 'refuge';
  const people = client.names();
  const seeHunters = N.seeUntil && N.seeUntil > clock();
  const marks = seeHunters ? Object.entries(N.hpos || {}).map(([id, p]) => ({ id, lat: p.lat, lng: p.lng, kind: 'chasseur', av: id === 'mj' ? null : people[id] && people[id].av, label: id === 'mj' ? pub.mjName.split(' ')[0] : people[id] && people[id].name })) : [];
  const map = html`<${GameMap} center=${N.center} radius=${N.radius} me=${gps.pos}
    marks=${marks} mapStyle=${N.mapStyle}
    onTap=${sim ? (p) => gps.moveTo(p) : null} className="" />`;
  if (show != null) return html`<${ClueRead} N=${N} k=${show} clock=${clock} speed=${pub.speed || 1} close=${() => setShow(null)} />`;
  return html`<div class="screen has-slide">
    ${refuge
      ? html`<${Head} act="Acte 3" title="Le refuge" to=${N.endsAt} clock=${clock} sub="avant le dernier départ" right=${`${plural(N.count.sauves, 'monstre arrivé', 'monstres arrivés')}`} />`
      : html`<${Head} act="Acte 2" title=${html`Alerte<br />générale`} to=${N.endsAt} clock=${clock} sub="avant la fin de l’alerte" right="Chacun pour soi" />`}
    ${refuge ? html`
      <p class="small muted" style="margin:0 0 10px">Chaque indice se déverrouille à son heure. Il s’autodétruit dès que tu l’as lu.</p>
      <${Tiles} client=${client} N=${N} clock=${clock} onRead=${(k) => setShow(k)} />` : null}
    ${refuge ? html`<p class="small muted" style="margin-top:12px">Pas de carte pendant la course : oriente-toi avec ta connaissance du quartier, ou l’appli Plans de ton téléphone.</p>`
      : html`<div style="position:relative;height:50dvh"><div class="mapbox" style="position:absolute;inset:0">${map}<${SightTag} N=${N} clock=${clock} /></div></div>`}
    ${gps.err ? html`<div class="alert" style="margin-top:8px">${gps.err}</div>` : null}
    ${sim && !refuge ? html`<p class="sub">Démo : touche la carte pour te déplacer.</p>` : null}
    ${sim && refuge ? html`<div class="btns" style="margin-top:8px"><${Btn} kind="ghost" small onClick=${() => N.refugePt0 && gps.moveTo(N.refugePt0)}>Démo : aller au refuge</${Btn}></div>` : null}
    ${seeHunters ? html`<p class="sub ok">Tu vois les chasseurs pendant encore <${Countdown} to=${N.seeUntil} clock=${clock} short />.</p>` : null}
    ${refuge ? html`
      <div class="row" style="margin-top:8px"><${Icon} n="shield" s=${16} /><span class="small">À moins de 50 m du refuge, plus personne ne peut t’attraper.</span></div>
      <div class="row"><${Icon} n="triangle-alert" s=${16} /><span class="small">Si un exorcisé atteint le refuge avant toi, tu es exorcisé.</span></div>
` : null}
    <div class="btns" style="margin-top:8px">
      <${Btn} icon="zap" kind=${N.power && N.power.used ? 'ghost' : 'primary'} onClick=${() => setSheet('power')}>${N.power && N.power.used ? 'Pouvoir utilisé' : 'Mon pouvoir'}</${Btn}>
      <${Btn} kind="dark" icon="life-buoy" confirm="Envoyer un SOS au MJ ?" onClick=${() => client.act('core', 'sos', gps.pos || {})} className="sos-btn">SOS</${Btn}>
    </div>
    <div class="slidebar"><${Slide} label="Glisse si un chasseur t’a attrapé" onDone=${() => setSheet('caught')} /></div>
    ${sheet === 'caught' ? html`<${CaughtSheet} client=${client} v=${v} close=${() => setSheet(null)} />` : null}
    ${sheet === 'power' ? html`<${PowerSheet} client=${client} v=${v} pub=${pub} close=${() => setSheet(null)} />` : null}
  </div>`;
}

function CaughtSheet({ client, v, close }) {
  const [by, setBy] = useState(null);
  const H = v.nuit.hunters || [];
  return html`<${Sheet} onClose=${close}>
    <${Ex} size=${36} depth=${4} tag="h2">Qui t’a<br />attrapé ?</${Ex}>
    <p class="small muted" style="margin:10px 0 14px">Tu deviendras chasseur à ton tour.</p>
    ${H.map((h) => html`<button key=${h.id} class="frow ${by === h.id ? 'on' : ''}" onClick=${() => setBy(h.id)}>
      <${Av} src=${h.id === 'mj' ? null : (client.names()[h.id] || {}).av} size=${34} />
      <span class="fname"><b>${h.name}</b><span>${h.role}</span></span>
      <span class="chk ${by === h.id ? 'on' : ''}">${by === h.id ? html`<${Icon} n="check" s=${14} />` : null}</span>
    </button>`)}
    <div style="margin-top:14px" class="stack">
      <${Btn} kind="red" disabled=${!by} onClick=${() => { client.act('nuit', 'caught', { by }); close(); }}>Confirmer l’exorcisme</${Btn}>
      <button class="link" onClick=${close}>Annuler, je suis encore libre</button>
    </div>
  </${Sheet}>`;
}

function PowerSheet({ client, v, pub, close }) {
  const P = v.nuit.power;
  const [target, setTarget] = useState(null);
  const names = client.names();
  if (!P) return null;
  const exo = Object.keys(v.nuit.exo || {}).filter((id) => names[id]);
  const auto = P.id === 'immune';
  const inside = v.nuit.st === 'evasion';
  return html`<${Sheet} onClose=${close}>
    <p class="eyebrow">Ton pouvoir de ${v.me.monster ? v.me.monster.name : 'monstre'}</p>
    <${Ex} size=${40} depth=${5} tag="h2">${P.name}</${Ex}>
    <p class="lead" style="margin:12px 0 14px">${P.desc}</p>
    <div class="pills"><${Pill} or>${P.used ? 'Déjà utilisé' : auto ? 'Automatique' : '1 utilisation'}</${Pill}></div>
    ${P.id === 'revive' && !P.used && !inside ? html`<p class="label" style="margin-top:16px">Qui ramener ?</p>
      ${exo.length ? exo.map((id) => html`<button key=${id} class="frow ${target === id ? 'on' : ''}" onClick=${() => setTarget(id)}>
        <${Av} src=${names[id].av} size=${30} /><span class="fname"><b>${names[id].name}</b><span>${names[id].mon || ''}</span></span></button>`) : html`<p class="small muted">Personne n’a encore été exorcisé.</p>`}` : null}
    <div style="margin-top:16px" class="stack">
      ${inside ? html`<p class="sub">Utilisable une fois dehors, pendant l’alerte générale ou le refuge.</p>` : null}
      ${!P.used && !auto && !inside ? html`<${Btn} icon="zap" disabled=${P.id === 'revive' && !target} onClick=${() => { client.act('nuit', 'power', { target }); close(); }}>Lancer le pouvoir</${Btn}>` : null}
      <button class="link" onClick=${close}>${P.used || auto || inside ? 'Fermer' : 'Plus tard'}</button>
    </div>
  </${Sheet}>`;
}

function OutZone({ N, pos, clock, back }) {
  useNow(500);
  const dist = pos && N.center ? Math.max(0, Math.round(haversine(N.center, pos) - N.radius)) : null;
  useEffect(() => {
    const t = setInterval(() => {
      play('alarm');
      if (navigator.vibrate) try { navigator.vibrate([400, 150, 400, 150, 400]); } catch {}
    }, 2200);
    play('alarm');
    return () => { clearInterval(t); if (navigator.vibrate) try { navigator.vibrate(0); } catch {} };
  }, []);
  return html`<div class="redzone">
    <div class="ringw"><${Icon} n="siren" s=${44} /></div>
    <h1 class="disp" style="font-size:78px">Hors<br />zone</h1>
    <p class="lead" style="margin:18px 0 26px;color:#fff4ec">Les chasseurs reçoivent ta position toutes les 10 secondes. Reviens dans le périmètre.</p>
    <div class="stats" style="width:100%">
      <div class="stat"><b>${dist != null ? (dist >= 1000 ? (dist / 1000).toFixed(1).replace('.', ',') + ' km' : dist + ' m') : '…'}</b><span>hors de la zone</span></div>
      <div class="stat"><b>${fmtShort(clock() - N.outSince)}</b><span>depuis ta sortie</span></div>
      <div class="stat"><b>${N.outPings}</b><span>position${N.outPings > 1 ? 's' : ''} envoyée${N.outPings > 1 ? 's' : ''}</span></div>
    </div>
    <p class="small" style="margin-top:28px;color:#ffd8cc">L’écran clignote et le téléphone vibre tant que tu es dehors.</p>
    ${back ? html`<button class="btn ghost" style="margin-top:20px;color:#fff;border-color:#fff" onClick=${back}>Démo : revenir dans la zone</button>` : null}
  </div>`;
}

function Tiles({ client, N, clock, onRead }) {
  useNow(1000);
  const now = clock();
  return html`<div class="tiles">
    ${(N.tiles || []).map((t) => {
      const st = t.state;
      const lab = st === 'burnt' ? 'Détruit' : st === 'open' ? 'Lire' : st === 'reading' ? 'Ouvert' : `dans ${fmtShort(t.at - now)}`;
      return html`<button key=${t.k} class="tile ${st}" disabled=${st === 'locked' || st === 'burnt'}
        onClick=${() => { if (st === 'open') client.act('nuit', 'read', { k: t.k }); if (st === 'open' || st === 'reading') onRead(t.k); }}>
        <${Icon} n=${st === 'burnt' ? 'x' : st === 'locked' ? 'lock' : 'lock-open'} s=${16} /><b>${t.k + 1}</b>${lab}
      </button>`;
    })}
  </div>`;
}

function ClueRead({ N, k, clock, close, speed }) {
  useNow(250);
  const t = (N.tiles || [])[k];
  const text = t && t.text;
  const left = t && t.until ? (t.until - clock()) / speed : 0;
  useEffect(() => { if (t && t.state === 'burnt') close(); }, [t && t.state]);
  return html`<div class="screen">
    <div class="topbar"><span>Acte 3</span><span></span></div>
    <${Ex} size=${50}>Indice ${k + 1}</${Ex}>
    <div class="card" style="margin-top:20px;min-height:180px;display:flex;align-items:center">
      ${text ? html`<p class="clue">${text}</p>` : html`<p class="muted">Ouverture…</p>`}
    </div>
    ${text ? html`<p class="ok" style="margin-top:14px;display:flex;gap:8px;align-items:center"><${Icon} n="timer" s=${16} />Ce message s’autodétruira dans ${fmtShort(left)}</p>` : null}
    <p class="small muted" style="margin-top:8px">Il ne sera plus jamais lisible : mémorise-le bien.</p>
    <div class="bottom"><${Btn} kind="ghost" onClick=${close}>Retour</${Btn}></div>
  </div>`;
}

function Exorcised({ pub, v, go }) {
  const x = v.nuit.exoBy || {};
  const names = Object.fromEntries((pub.players || []).map((p) => [p.id, p]));
  const by = x.by === 'mj' ? `${pub.mjName}, le chasseur` : names[x.by] ? `${names[x.by].name} ${names[x.by].last || ''}, ancien ${names[x.by].mon || 'monstre'}` : '…';
  const mon = v.me.monster ? v.me.monster.name : 'Ton monstre';
  return html`<div class="screen">
    <div class="scene-bg" style="opacity:.6"><${Scene} name="brume" className="scene" style="width:100%;height:100%;filter:grayscale(1)" /></div>
    <div class="grow" style="min-height:30dvh"></div>
    <div style="margin-bottom:14px"><${Av} src=${v.me.av} size=${70} className="exo-av" /></div>
    <p class="eyebrow">Capturé à ${hm(x.at || Date.now())} par ${by}</p>
    <${Ex} size=${56} depth=${7}>Exorcisé</${Ex}>
    <p class="lead" style="margin-top:14px">${mon} a quitté ton corps. Tu redeviens humain : tu chasses désormais les monstres.</p>
    <div class="bottom"><${Btn} icon="crosshair" onClick=${go}>Rejoindre la chasse</${Btn}></div>
  </div>`;
}

function Hunter({ client, pub, v, clock, gps, sim }) {
  const N = v.nuit;
  const names = client.names();
  const [show, setShow] = useState(null);
  useNow(5000);
  if (show != null) return html`<${ClueRead} N=${N} k=${show} clock=${clock} speed=${pub.speed || 1} close=${() => setShow(null)} />`;
  const now = clock();
  const marks = [
    ...(N.sights || []).map((s) => {
      const p = names[s.pid] || {};
      const m = Math.floor((now - s.t) / 60000);
      return { id: s.id, lat: s.lat, lng: s.lng, av: p.av, kind: 'monstre', label: `${p.name || '?'}${s.kind === 'horszone' ? ', hors zone' : m >= 1 ? `, il y a ${m} min` : ''}` };
    }),
    ...Object.entries(N.hpos || {}).filter(([id]) => id !== v.me.id).map(([id, p]) => ({ id, lat: p.lat, lng: p.lng, kind: 'chasseur', av: id === 'mj' ? null : names[id] && names[id].av, label: id === 'mj' ? pub.mjName.split(' ')[0] : names[id] && names[id].name })),
  ];
  const last = (N.sights || []).filter((s) => s.kind === 'auto').reduce((a, s) => Math.max(a, s.t), 0);
  const huntersNames = (N.hunters || []).map((h) => h.name.split(' ')[0]).join(', ');
  const blind = N.blindUntil && N.blindUntil > now;
  const refuge = N.st === 'refuge';
  return html`<div class="screen">
    <${Head} act=${`Chasseurs : ${huntersNames}`} title=${refuge ? (N.onlyHunters ? 'Détruis le refuge' : 'La course') : 'La chasse'} to=${N.endsAt} clock=${clock}
      sub=${refuge ? 'avant le dernier départ' : 'avant la fin de l’alerte'} right=${plural((N.mine || []).length, 'exorcisme')} />
    ${refuge ? html`<p class="small muted" style="margin:0 0 10px">${N.onlyHunters ? 'Retrouve le refuge grâce aux indices pour le détruire.' : 'Atteins le refuge avant les monstres : tous ceux encore dehors seront exorcisés.'} Chaque indice s’autodétruit dès qu’il est lu.</p>
      <${Tiles} client=${client} N=${N} clock=${clock} onRead=${(k) => setShow(k)} />
      <div style="height:10px"></div>` : null}
    ${refuge ? null : html`<div style="position:relative;height:52dvh">
      <div class="mapbox" style="position:absolute;inset:0">
        <${GameMap} center=${N.center} radius=${N.radius} me=${gps.pos} marks=${marks} blind=${blind} mapStyle=${N.mapStyle} onTap=${sim ? (p) => gps.moveTo(p) : null} />
        <span class="pill maptag"><${Icon} n="radio" s=${14} />${last ? `Signalement il y a ${Math.max(0, Math.floor((now - last) / 60000))} min` : N.huntAt > now ? `Départ dans ${fmtShort(N.huntAt - now)}` : 'En attente du signalement'}</span>
      </div>
    </div>`}
    ${gps.err ? html`<div class="alert" style="margin-top:8px">${gps.err}</div>` : null}
    <p class="label" style="margin-top:14px">Tes exorcismes</p>
    ${(N.mine || []).length ? N.mine.map((x) => html`<div class="frow" key=${x.id}>
        <${Av} src=${names[x.id] && names[x.id].av} size=${32} />
        <span class="fname"><b>${names[x.id] ? `${names[x.id].name} ${names[x.id].last || ''}` : '?'}</b><span>${names[x.id] && names[x.id].mon}</span></span>
        <span class="ok" style="font-family:Gloock;font-size:18px">en ${mins(x.after)} min</span>
      </div>`) : html`<p class="small muted">Pas encore. Quand tu attrapes un monstre, c’est lui qui le déclare sur son téléphone.</p>`}
  </div>`;
}

function Portal({ pub, v }) {
  const N = v.nuit;
  const order = Object.values(N.saved || {}).sort((a, b) => a - b).indexOf(N.savedAt) + 1;
  const names = Object.fromEntries((pub.players || []).map((p) => [p.id, p]));
  return html`<div class="screen">
    <div class="scene-bg"><${Scene} name="lac" className="scene" style="width:100%;height:100%" /></div>
    <div class="grow" style="min-height:44dvh"></div>
    <p class="eyebrow">Arrivée à ${hm(N.savedAt)}, ${ordinal(order || 1)} monstre sauvé</p>
    <${Ex} size=${50} depth=${7}>Tu as passé<br />le portail</${Ex}>
    <p class="lead" style="margin-top:14px">Tes complices t’attendaient au point de rassemblement. Direction l’Hôtel Transylvanie.</p>
    <div class="stats" style="margin-top:18px">
      <div class="stat"><b>${mins(N.savedAt - N.alertAt)}</b><span>min de cavale</span></div>
      <div class="stat"><b>${N.power && N.power.used ? 1 : 0}</b><span>pouvoir utilisé</span></div>
      <div class="stat"><b>${N.count.sauves}</b><span>monstres sauvés</span></div>
    </div>
    <p class="small muted" style="margin-top:14px">Attends les autres : les résultats s’affichent au dernier départ.</p>
  </div>`;
}

// verdict de la nuit, partagé par le téléphone et la TV
export function verdict(R, name) {
  if (R.sealedBy) return R.destroyed ? `${name(R.sealedBy)} a détruit le refuge.` : `${name(R.sealedBy)} a atteint le refuge le premier : les monstres restés dehors sont exorcisés.`;
  if (R.allCaught) return 'Tous les monstres ont été exorcisés.';
  if (R.saved.length) return `${R.saved.length} monstre${R.saved.length > 1 ? 's sont rentrés' : ' est rentré'} chez ${R.saved.length > 1 ? 'eux' : 'lui'}.`;
  return 'Le dernier portail est parti sans personne.';
}

function Results({ client, pub, v }) {
  const R = v.nuit.results || pub.nuit.results || { saved: [], exo: [], lost: [], hunters: {}, ranking: [] };
  const names = Object.fromEntries((pub.players || []).map((p) => [p.id, p]));
  const [open, setOpen] = useState(false);
  const name = (id) => (id === 'mj' ? pub.mjName.split(' ')[0] : names[id] ? names[id].name : '?');
  if (!open) {
    return html`<div class="screen">
      <div class="scene-bg"><${Scene} name="lac" className="scene" style="width:100%;height:100%" /></div>
      <div class="grow" style="min-height:40dvh"></div>
      <p class="eyebrow">${hm(R.at)}</p>
      <${Ex} size=${84} depth=${12}>Fin de<br />la partie</${Ex}>
      <p class="lead" style="margin-top:16px">${verdict(R, name)}</p>
      <div class="bottom"><${Btn} onClick=${() => setOpen(true)}>Kebab time</${Btn}></div>
    </div>`;
  }
  const S = R.summary || {};
  const meId = v.me.id;
  const status = (r) => (r.saved ? `rentré à ${hm(r.saved)}` : r.status === 'exorcise' ? 'exorcisé' : 'resté dehors');
  return html`<div class="screen">
    <p class="eyebrow">Résumé de la partie</p>
    <${Ex} size=${48} depth=${6}>Le classement</${Ex}>
    <div class="stats" style="margin:18px 0 14px">
      <div class="stat"><b>${S.escapeMin != null ? S.escapeMin : '–'}</b><span>min pour s’évader${S.timedOut ? ' (temps écoulé)' : ''}</span></div>
      <div class="stat"><b>${R.captures ?? 0}</b><span>exorcismes</span></div>
      <div class="stat"><b>${R.saved.length}</b><span>rentrés chez eux</span></div>
    </div>
    ${(R.ranking || []).map((r, i) => html`<div class="frow ${r.id === meId ? 'on' : ''}" key=${r.id} style="cursor:default">
      <span class="rank">${i + 1}</span>
      <${Av} src=${names[r.id] && names[r.id].av} size=${32} />
      <span class="fname"><b>${names[r.id] ? `${names[r.id].name} ${names[r.id].last || ''}` : '?'}</b>
        <span>${[r.solved ? `${r.solved} énigme${r.solved > 1 ? 's' : ''}` : '', r.survived ? `${r.survived} min de cavale` : '', r.captures ? `${r.captures} capture${r.captures > 1 ? 's' : ''}` : '', r.sealed ? 'a pris le refuge' : '', status(r)].filter(Boolean).join(' · ')}</span></span>
      <span class="pts">${r.pts}</span>
    </div>`)}
    <p class="label" style="margin-top:18px">La nuit en bref</p>
    <div class="card small" style="line-height:1.6">
      ${S.escapeMin != null ? html`<div>Évasion en ${S.escapeMin} min, ${S.tries || 0} essai${S.tries > 1 ? 's' : ''} raté${S.tries > 1 ? 's' : ''} au cadenas, ${S.hints || 0} coup${S.hints > 1 ? 's' : ''} de pouce.</div>` : null}
      <div>${R.hunters.mj || 0} capture${(R.hunters.mj || 0) > 1 ? 's' : ''} pour ${name('mj')}, ${S.powers || 0} pouvoir${S.powers > 1 ? 's' : ''} utilisé${S.powers > 1 ? 's' : ''}.</div>
      ${S.firstSaved ? html`<div>Premier rentré : ${name(S.firstSaved)}.</div>` : null}
      <div>${verdict(R, name)}</div>
    </div>
    <p class="sub">Points : 10 par énigme, 3 par carte trouvée, 1 par minute de cavale, 15 par capture, 50 pour rentrer chez soi (plus 1 par minute d’avance), 40 pour prendre le refuge.</p>
    <button class="link" onClick=${() => setOpen(false)}>Revoir la fin</button>
  </div>`;
}
