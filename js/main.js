// Aiguillage : écran TV (hôte), panneau MJ, téléphone de joueur ou démo selon le lien.
import { html, render, useState, useEffect, useSource, Btn, Ex, Icon, keepAwake } from './ui/kit.js';
import { TvApp } from './ui/tv.js';
import { PlayerApp } from './ui/player.js';
import { MjApp } from './ui/mj.js';
import { Host, brokerParam } from './host/host.js';
import { Client, LocalClient } from './client.js';
import { BROKERS, Link } from './net.js';
import { unlockAudio } from './ui/sound.js';

const root = document.getElementById('app');
root.textContent = '';

function parseHash() {
  const out = {};
  for (const part of location.hash.replace(/^#/, '').split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    if (i < 0) out[part] = true;
    else out[part.slice(0, i)] = part.slice(i + 1);
  }
  return out;
}

const customRelay = () => new URLSearchParams(location.search).get('relais');

async function boot() {
  const h = parseHash();
  if (h.j) {
    document.body.className = 'is-phone';
    const c = new Client({ room: h.j, broker: h.b || '0' });
    render(html`<${PlayerApp} client=${c} />`, root);
    window.__client = c;
    await c.start();
    return;
  }
  if (h.mj) {
    document.body.className = 'is-phone is-mj';
    const [room, admin] = String(h.mj).split('.');
    const c = new Client({ room, admin, broker: h.b || '0' });
    render(html`<${MjApp} client=${c} />`, root);
    window.__client = c;
    await c.start();
    return;
  }
  if (h.tv) {
    const saved = Host.saved();
    if (saved) return startTv(new Host(saved));
  }
  if (h.demo) {
    const saved = Host.saved(true);
    if (saved) return startDemo(new Host(saved));
  }
  document.body.className = 'is-home';
  render(html`<${Home} />`, root);
}

async function startTv(host) {
  document.body.className = 'is-tv';
  if (location.hash !== '#tv') history.replaceState(null, '', location.pathname + location.search + '#tv');
  render(html`<${TvApp} host=${host} />`, root);
  keepAwake();
  await host.start();
  window.__host = host;
}

async function startDemo(host) {
  document.body.className = 'is-demo';
  if (location.hash !== '#demo') history.replaceState(null, '', location.pathname + location.search + '#demo');
  const mj = new LocalClient(host, { admin: true });
  const player = new LocalClient(host);
  render(html`<${DemoShell} host=${host} mj=${mj} player=${player} />`, root);
  keepAwake();
  await host.start();
  mj.start();
  player.start();
  window.__host = host;
}

// Démo sur un seul appareil : on passe de l'écran TV au panneau MJ et au téléphone d'un joueur
function DemoShell({ host, mj, player }) {
  const [view, setView] = useState(() => sessionStorage.getItem('hw.demo.view') || 'mj');
  const pick = (v) => { sessionStorage.setItem('hw.demo.view', v); setView(v); window.scrollTo(0, 0); };
  useEffect(() => { document.body.dataset.view = view; }, [view]);
  return html`
    <div class="demobar"><b>DÉMO ×${host.E.speed}</b>
      <div class="seg">${[['tv', 'TV'], ['mj', 'MJ'], ['joueur', 'Joueur']].map(([k, l]) => html`<button class=${view === k ? 'on' : ''} onClick=${() => pick(k)}>${l}</button>`)}</div>
      <button class="tvbtn" style="padding:6px 10px;font-size:12px" onClick=${() => { location.hash = ''; location.reload(); }}>Quitter</button>
    </div>
    ${view === 'tv' ? html`<${TvApp} host=${host} />` : view === 'mj' ? html`<${MjApp} client=${mj} />` : html`<${PlayerApp} client=${player} />`}`;
}

function useRelays() {
  const custom = customRelay();
  const list = custom ? [{ id: brokerParam(custom), label: 'Relais personnalisé', url: custom }] : BROKERS.slice(0, 2);
  const [test, setTest] = useState({});
  useEffect(() => {
    const links = [];
    for (const b of list) {
      const l = new Link(b.url, (s) => { if (s === 'ok') setTest((t) => ({ ...t, [b.id]: 'ok' })); });
      l.connect();
      links.push(l);
    }
    const t = setTimeout(() => setTest((x) => { const y = { ...x }; for (const b of list) if (y[b.id] !== 'ok') y[b.id] = 'ko'; return y; }), 9000);
    return () => { clearTimeout(t); links.forEach((l) => l.end()); };
  }, []);
  return { list, test };
}

function Home() {
  const saved = Host.saved();
  const savedDemo = Host.saved(true);
  const { list, test } = useRelays();
  const [broker, setBroker] = useState(null);
  const [busy, setBusy] = useState(false);
  const best = list.find((b) => test[b.id] === 'ok');
  const chosen = broker != null ? broker : best ? String(best.id) : null;
  const create = async () => {
    unlockAudio();
    setBusy(true);
    const b = /^\d+$/.test(chosen) ? Number(chosen) : decodeURIComponent(chosen);
    startTv(await Host.create('Le dernier portail', b));
  };
  const demo = async (fresh) => {
    unlockAudio();
    setBusy(true);
    let host;
    if (!fresh && savedDemo) host = new Host(savedDemo);
    else {
      host = await Host.create('Démo', 0, { demo: true });
      host.bots.setCount(9);
      host.setSpeed(10);
    }
    startDemo(host);
  };
  return html`<div class="home">
    <p class="eyebrow">Halloween, 31 octobre</p>
    <${Ex} size=${64} depth=${8}>Le dernier<br />portail</${Ex}>
    <p class="lead" style="margin:20px 0 26px">Ouvre cette page sur l’ordinateur branché à la TV : il devient l’écran et le cerveau de la partie. Les joueurs rejoignent en scannant le QR code affiché.</p>
    ${saved ? html`<div class="card stack">
      <p class="lead">Une partie est en cours sur cet ordinateur, avec ${Object.values(saved.S.players).filter((p) => !p.gone).length} joueurs.</p>
      <${Btn} onClick=${() => { unlockAudio(); startTv(new Host(saved)); }}>Reprendre la partie</${Btn}>
    </div>` : null}
    <div class="card stack">
      <p class="label">Relais temps réel</p>
      <div class="seg">${list.map((b) => html`<button key=${b.id} class=${chosen === String(b.id) ? 'on' : ''} disabled=${test[b.id] === 'ko'} onClick=${() => setBroker(String(b.id))}>
        ${b.label} <small class=${test[b.id] === 'ok' ? 'ok' : 'muted'}>${test[b.id] === 'ok' ? 'joignable' : test[b.id] === 'ko' ? 'injoignable' : '…'}</small></button>`)}</div>
      <${Btn} kind=${saved ? 'ghost' : 'primary'} disabled=${busy || !chosen} confirm=${saved ? 'Effacer la partie en cours ?' : null} onClick=${create}>${saved ? 'Nouvelle partie' : 'Créer la partie'}</${Btn}>
    </div>
    <div class="card stack">
      <p class="lead"><b>Mode démo.</b> Toute la partie sur un seul appareil, avec des monstres virtuels et le temps accéléré. Rien n’est mélangé avec la vraie partie.</p>
      ${savedDemo ? html`<${Btn} kind="ghost" icon="play" disabled=${busy} onClick=${() => demo(false)}>Reprendre la démo</${Btn}>` : null}
      <${Btn} kind=${savedDemo ? 'ghost' : 'primary'} icon="ghost" disabled=${busy} onClick=${() => demo(true)}>${savedDemo ? 'Nouvelle démo' : 'Lancer la démo'}</${Btn}>
    </div>
    <p class="small muted" style="margin-top:16px">Tout passe chiffré par le relais : la clé ne circule que dans les liens d’invitation.</p>
    <div class="grain"></div>
  </div>`;
}

boot();
