// Écran TV : il fait tourner la partie (l'hôte) et affiche ce que tout le monde peut voir.
import { html, useState, useEffect, useRef, useSource, useNow, Safe, Countdown, Icon, Ex, Av, Pill, Scene, QR, Title, fmtShort, hm, plural, SYM_ICON } from './kit.js';
import { GameMap } from './map.js';
import { play, unlockAudio, setSound, soundOn } from './sound.js';

export function TvApp({ host }) {
  useSource(host);
  const pub = host.pubView;
  const clock = () => host.E.S.nuit.pausedAt || host.E.now();
  const [scale, setScale] = useState(1);
  const wrap = useRef(null);
  useEffect(() => {
    const fit = () => {
      const el = wrap.current;
      if (!el) return;
      setScale(Math.min(el.clientWidth / 1920, el.clientHeight / 1080));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  const lastOv = useRef(null);
  useEffect(() => {
    if (pub && pub.ov && pub.ov.id !== lastOv.current) {
      lastOv.current = pub.ov.id;
      play(pub.ov.kind);
    }
  }, [pub && pub.ov && pub.ov.id]);
  if (!pub) return html`<div class="tvwrap" ref=${wrap}></div>`;
  const N = pub.nuit;
  let body;
  if (N.st === 'idle') body = pub.screen === 'intro' ? html`<${Intro} pub=${pub} />` : html`<${Accueil} pub=${pub} host=${host} />`;
  else if (N.st === 'evasion') body = html`<${Evasion} pub=${pub} clock=${clock} />`;
  else if (N.st === 'alerte') body = html`<${Alerte} pub=${pub} clock=${clock} />`;
  else if (N.st === 'refuge') body = html`<${Refuge} pub=${pub} clock=${clock} />`;
  else body = html`<${Fin} pub=${pub} />`;
  return html`<div class="tvwrap" ref=${wrap} onClick=${unlockAudio}>
    <div class="stage" style=${{ transform: `translate(-50%,-50%) scale(${scale})` }}>
      <${Safe}>${body}</${Safe}>
      ${pub.ov ? html`<${Overlay} ov=${pub.ov} pub=${pub} />` : null}
      ${N.paused ? html`<div class="ov"><${Ex} size=${170} depth=${12}>Pause</${Ex}></div>` : null}
      <div class="grain" style="position:absolute"></div>
    </div>
    <${Corner} host=${host} pub=${pub} />
  </div>`;
}

function Corner({ host, pub }) {
  const [mj, setMj] = useState(false);
  const [snd, setSnd] = useState(soundOn());
  const full = () => {
    const d = document;
    if (d.fullscreenElement) d.exitFullscreen && d.exitFullscreen();
    else d.documentElement.requestFullscreen && d.documentElement.requestFullscreen().catch(() => {});
  };
  return html`
    ${mj && !host.demo ? html`<div style="position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.92);display:grid;place-items:center" onClick=${() => setMj(false)}>
      <div style="width:340px;text-align:center">
        <div class="tvqr"><${QR} text=${host.mjUrl()} /></div>
        <p class="lead" style="margin-top:16px">Panneau du maître du jeu. Scanne-le avec ton téléphone, puis ferme.</p>
        <p class="small muted" style="margin-top:6px">Ce code donne le contrôle de la partie : ne le montre à personne.</p>
      </div>
    </div>` : null}
    <div class="tvcorner">
      ${host.status !== 'local' ? html`<span class="small" style="color:${host.status === 'ok' ? 'var(--gris)' : 'var(--rouge)'}">${host.status === 'ok' ? 'Relais connecté' : 'Relais : ' + host.status}</span>` : null}
      ${!host.demo ? html`<button class="tvbtn" onClick=${() => setMj(true)}>Panneau MJ</button>` : null}
      <button class="tvbtn" onClick=${() => { setSound(!snd); setSnd(!snd); unlockAudio(); }}>${snd ? 'Son activé' : 'Son coupé'}</button>
      <button class="tvbtn" onClick=${full}>Plein écran</button>
      ${pub.ov ? html`<button class="tvbtn" onClick=${() => host.local({ a: 'skipOverlay' })}>Passer</button>` : null}
    </div>`;
}

function Cast({ pub, size = 92, statusOf, cols = 5, gap = 18, names = true }) {
  return html`<div class="cast" style=${{ gridTemplateColumns: `repeat(${cols},1fr)`, gap: gap + 'px' }}>
    ${pub.players.map((p) => {
      const st = statusOf ? statusOf(p.id) : '';
      return html`<div class="castc ${st}" key=${p.id}><${Av} src=${p.av} size=${size} />${names ? html`<b>${p.name}</b>` : null}</div>`;
    })}
  </div>`;
}

function Accueil({ pub, host }) {
  const n = pub.players.length;
  return html`
    <div class="scene-wrap" style="right:0;top:0;width:960px;height:1080px;-webkit-mask-image:linear-gradient(90deg,transparent,#000 30%);mask-image:linear-gradient(90deg,transparent,#000 30%)"><${Scene} name="brume" className="scene" style="width:100%;height:100%" /></div>
    <div class="pg">
      <p class="tvlabel">Halloween, 31 octobre</p>
      <${Title} px=${104} depth=${10} />
      <p class="tvlead" style="margin-top:28px">Scanne le code. Entre. Ne pose aucune question.</p>
      <div style="margin-top:56px;width:860px"><${Cast} pub=${pub} size=${96} /></div>
      ${!n ? html`<p class="tvlead muted" style="margin-top:20px">Aucune âme pour l’instant.</p>` : null}
    </div>
    <div style="position:absolute;right:150px;top:470px;width:360px;z-index:6;text-align:center">
      ${host.demo
        ? html`<div class="card" style="padding:30px"><p class="tvlead">Démo : pour jouer un monstre, passe sur l’onglet Joueur en haut de l’écran.</p></div>`
        : html`<div class="tvqr"><${QR} text=${host.joinUrl()} /></div>`}
      <p class="tvlabel" style="margin-top:14px">${plural(n, 'âme')} dans la maison</p>
    </div>`;
}

function Intro({ pub }) {
  const d = pub.nuit.durations;
  const total = d.evasion + d.alerte + d.refuge;
  return html`
    <div class="scene-wrap" style="right:0;top:0;width:820px;height:1080px"><${Scene} name="porte" className="scene" style="width:100%;height:100%" /></div>
    <div class="pg" style="padding-top:240px;width:1180px">
      <${Ex} size=${150} depth=${12}>Réveil</${Ex}>
      <p class="tvlead" style="margin-top:40px;text-align:justify">Ce soir, c’était Halloween : la seule nuit où les monstres peuvent sortir sans risque. Vous vous réveillez sans souvenirs, enfermés dans une maison que vous ne connaissez pas. Aucune issue. Quelqu’un a caché la clé, et le dernier portail vers l’Hôtel Transylvanie se ferme dans ${Math.floor(total / 60) ? `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')}` : `${total} min`}.</p>
      <div class="pills" style="margin-top:34px;gap:14px">
        <span class="pill or" style="font-size:22px;padding:10px 20px">Évasion ${d.evasion} min</span>
        <span class="pill" style="font-size:22px;padding:10px 20px">Alerte générale ${d.alerte} min</span>
        <span class="pill" style="font-size:22px;padding:10px 20px">Refuge ${d.refuge} min</span>
      </div>
    </div>`;
}

function Evasion({ pub, clock }) {
  const N = pub.nuit;
  const names = Object.fromEntries(pub.players.map((p) => [p.id, p]));
  return html`<div class="pg">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div style="padding-top:60px"><p class="tvlabel">Acte 1</p><${Ex} size=${140} depth=${10}>L’Évasion</${Ex}></div>
      <div style="text-align:right">
        <div class="tvbig tnum" style="text-shadow:${ext(12)}"><${Countdown} to=${N.endsAt} clock=${clock} /></div>
        <p class="tvlabel" style="margin-top:14px">Avance gagnée : ${N.projectedHead} min${N.hintsUsed ? `, ${plural(N.hintsUsed, 'coup')} de pouce` : ''}</p>
      </div>
    </div>
    <div style="display:flex;gap:18px;margin-top:60px">
      ${N.enigmas.map((e) => html`<div class="room ${e.found ? '' : 'lock'}" key=${e.i}>
        <h3>${e.found ? e.num : '···'}</h3>
        <p>${e.solvedBy ? `Résolue par ${names[e.solvedBy] ? names[e.solvedBy].name : '?'}` : e.found ? `Trouvée par ${names[e.by] ? names[e.by].name : '?'}` : 'Pas encore trouvée'}</p>
      </div>`)}
    </div>
    <div style="display:flex;align-items:center;gap:40px;margin-top:50px">
      <p class="tvlabel" style="margin:0;width:200px">Le cadenas</p>
      <div class="tvdg">${[0, 1, 2, 3].map((i) => {
        const e = N.enigmas.filter((x) => x.solvedBy)[i];
        return e ? html`<div><${Icon} n=${SYM_ICON[e.sym]} s=${30} /><b>${e.digit}</b></div>` : html`<div class="lock"><${Icon} n="lock" s=${30} /><b>?</b></div>`;
      })}</div>
      ${N.ultimate ? html`<p class="tvlead" style="flex:1;font-family:Gloock;font-size:34px;line-height:1.3">${N.ultimate}</p>` : null}
    </div>
    ${N.say ? html`<div class="tvsay"><span>Le maître du jeu murmure</span><p>${N.say.text}</p></div>` : null}
  </div>`;
}

const ext = (n) => Array.from({ length: n }, (_, i) => `${i + 1}px ${i + 1}px 0 var(--ext)`).join(',');

function statusFn(N) {
  return (id) => (N.saved && N.saved[id] ? 'saved' : N.exo && N.exo[id] ? 'exo' : '');
}

function Alerte({ pub, clock }) {
  const N = pub.nuit;
  useNow(5000);
  const names = Object.fromEntries(pub.players.map((p) => [p.id, p]));
  const now = clock();
  const marks = (N.sights || []).map((s) => {
    const m = Math.floor((now - s.t) / 60000);
    return { id: s.id, lat: s.lat, lng: s.lng, av: names[s.pid] && names[s.pid].av, kind: 'monstre', label: `${names[s.pid] ? names[s.pid].name : '?'}${s.kind === 'horszone' ? ', hors zone' : m >= 1 ? `, il y a ${m} min` : ''}` };
  });
  return html`
    <div style="position:absolute;left:60px;top:60px;width:1100px;height:960px"><div class="mapbox" style="position:absolute;inset:0">
      <${GameMap} center=${N.center} radius=${N.radius} marks=${marks} blind=${N.blindUntil > now} mapStyle=${N.mapStyle} />
    </div></div>
    <div style="position:absolute;left:1220px;top:60px;right:60px;bottom:60px;z-index:5">
      <p class="tvlabel">Acte 2</p>
      <${Ex} size=${110} depth=${10}>Alerte<br />générale</${Ex}>
      <div class="tvbig tnum" style="font-size:170px;margin-top:24px;text-shadow:${ext(10)}"><${Countdown} to=${N.endsAt} clock=${clock} /></div>
      <p class="tvlabel" style="margin-top:12px">${N.huntAt > now ? `Le chasseur sort dans ${fmtShort(N.huntAt - now)}` : `Avant la fin de l’alerte, prochain signalement dans ${fmtShort(N.nextSight - now)}`}</p>
      <div style="margin-top:40px"><${Cast} pub=${pub} size=${76} gap=${12} statusOf=${statusFn(N)} /></div>
      <ul class="tvfeed" style="margin-top:30px">${(N.feed || []).slice(-3).reverse().map((f) => html`<li key=${f.id}>${f.text}</li>`)}</ul>
    </div>`;
}

function Refuge({ pub, clock }) {
  const N = pub.nuit;
  useNow(1000);
  const now = clock();
  const saved = pub.players.filter((p) => N.saved && N.saved[p.id]);
  return html`
    <div class="scene-wrap" style="right:0;top:0;width:820px;height:1080px"><${Scene} name="lac" className="scene" style="width:100%;height:100%" /></div>
    <div class="pg" style="width:1150px">
      <p class="tvlabel">Acte 3</p>
      <div style="display:flex;align-items:baseline;gap:40px"><${Ex} size=${130} depth=${10}>Le refuge</${Ex}><span class="tvbig tnum" style="font-size:130px;text-shadow:${ext(10)}"><${Countdown} to=${N.endsAt} clock=${clock} /></span></div>
      <p class="tvlabel" style="margin-top:10px">avant le dernier départ pour l’Hôtel Transylvanie</p>
      <div class="tvtiles" style="margin-top:56px">${(N.tiles || []).map((t) => html`<div class=${t.open ? 'open' : ''} key=${t.k}><b>${t.k + 1}</b>${t.open ? 'Déverrouillé' : `dans ${fmtShort(t.at - now)}`}</div>`)}</div>
      <p class="tvlead" style="margin-top:34px;color:var(--brume)">Chaque indice ne se lit qu’une fois, sur le téléphone des monstres encore libres.</p>
      <div style="display:flex;align-items:center;gap:24px;margin-top:60px">
        <p class="tvlabel" style="margin:0">${saved.length ? 'Déjà arrivés' : 'Personne n’est encore arrivé'}</p>
        <div style="display:flex;gap:12px">${saved.map((p) => html`<${Av} key=${p.id} src=${p.av} size=${64} className="glow" />`)}</div>
      </div>
      <div style="display:flex;gap:30px;margin-top:40px"><span class="tvlabel">${plural(N.count.monstres, 'monstre')} encore dehors</span><span class="tvlabel">${plural(N.count.exorcises, 'exorcisé')}</span></div>
    </div>`;
}

function Fin({ pub }) {
  const N = pub.nuit;
  const R = N.results || { saved: [], exo: [], hunters: {} };
  const mj = pub.mjName.split(' ')[0];
  return html`
    <div class="scene-wrap" style="right:0;top:0;width:760px;height:1080px;opacity:.8"><${Scene} name="lac" className="scene" style="width:100%;height:100%" /></div>
    <div class="pg" style="width:1250px">
      <p class="tvlabel">Le dernier départ a eu lieu à ${hm(R.at || Date.now())}</p>
      <${Ex} size=${150} depth=${12}>Fin de la nuit</${Ex}>
      <div style="display:flex;gap:14px;margin-top:50px">
        <div class="tvstat"><b>${R.saved.length}</b><span>monstres sauvés</span></div>
        <div class="tvstat"><b>${R.exo.length}</b><span>exorcisés</span></div>
        <div class="tvstat"><b>${R.hunters.mj || 0}</b><span>captures pour ${mj}</span></div>
      </div>
      <div style="margin-top:50px"><${Cast} pub=${pub} size=${80} cols=${10} gap=${10} statusOf=${statusFn(N)} /></div>
      <div style="margin-top:60px"><${Ex} size=${80} depth=${8} tag="p">Kebab time.</${Ex}></div>
    </div>`;
}

function Overlay({ ov, pub }) {
  if (ov.kind === 'say') {
    return html`<div class="ov k-say" key=${ov.id}>
      <p class="tvlabel" style="color:var(--orange2);font-size:30px">Le maître du jeu murmure</p>
      <${Ex} size=${ov.title.length > 90 ? 76 : 104} depth=${8}>${ov.title}</${Ex}>
    </div>`;
  }
  const p = ov.pid && pub.players.find((x) => x.id === ov.pid);
  return html`<div class="ov k-${ov.kind}" key=${ov.id}>
    ${p ? html`<div style="margin-bottom:30px"><${Av} src=${p.av} size=${120} /></div>` : null}
    <${Ex} size=${170} depth=${12}>${ov.title}</${Ex}>
    ${ov.sub ? html`<p>${ov.sub}</p>` : null}
  </div>`;
}
