// Installation de l'appli sur le téléphone, et scan du QR code de la TV depuis l'appli installée.
import { html, useState, useEffect, useRef, Icon, Ex, Btn, Pill, Scene } from './kit.js';

export const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isPhone = () => (window.matchMedia && matchMedia('(pointer: coarse)').matches) && Math.min(screen.width, screen.height) < 820;

// Android : Chrome propose sa propre fenêtre d'installation
let deferred = null;
const waiters = new Set();
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; waiters.forEach((f) => f()); });

export function useInstallPrompt() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set((x) => x + 1); waiters.add(f); return () => waiters.delete(f); }, []);
  return deferred ? async () => { deferred.prompt(); try { await deferred.userChoice; } catch {} deferred = null; } : null;
}

// Va vers un lien de partie (#j=… ou #mj=…) en restant dans l'appli installée
export function openLink(text) {
  let hash = '';
  try { hash = new URL(text, location.href).hash; } catch { hash = ''; }
  if (!/^#(j|mj)=/.test(hash)) return false;
  history.replaceState(null, '', location.pathname + location.search + hash);
  location.reload();
  return true;
}

export function InstallHelp({ compact }) {
  const prompt = useInstallPrompt();
  if (isStandalone()) return null;
  return html`<div class="card" style="margin-top:${compact ? 0 : 18}px">
    <p class="label" style="display:flex;gap:8px;align-items:center;color:var(--orange2)"><${Icon} n="smartphone" s=${16} />Installe l’appli sur ton téléphone</p>
    ${prompt ? html`<${Btn} icon="smartphone" onClick=${prompt}>Installer l’appli</${Btn}>`
      : isIos() ? html`<ol class="steps-list">
          <li>Touche le bouton <b>Partager</b> de Safari, le carré avec une flèche vers le haut.</li>
          <li>Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.</li>
          <li>Ouvre l’icône <b>Portail</b> qui vient d’apparaître, puis scanne le QR code de la TV.</li>
        </ol>`
      : html`<ol class="steps-list">
          <li>Ouvre le menu du navigateur, les trois points.</li>
          <li>Choisis <b>Installer l’application</b> ou <b>Ajouter à l’écran d’accueil</b>.</li>
          <li>Ouvre l’icône <b>Portail</b>, puis scanne le QR code de la TV.</li>
        </ol>`}
  </div>`;
}

export function Scanner({ onCancel }) {
  const video = useRef(null);
  const [msg, setMsg] = useState('Ouverture de la caméra…');
  useEffect(() => {
    let stream;
    let stop = false;
    let timer;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stop) return;
        video.current.srcObject = stream;
        await video.current.play().catch(() => {});
        setMsg('Vise le QR code affiché sur la TV.');
        const jsQR = (await import('../../vendor/jsqr.mjs')).default;
        const c = document.createElement('canvas');
        const x = c.getContext('2d', { willReadFrequently: true });
        const loop = () => {
          if (stop) return;
          const v = video.current;
          if (v && v.videoWidth) {
            const k = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
            c.width = Math.round(v.videoWidth * k);
            c.height = Math.round(v.videoHeight * k);
            x.drawImage(v, 0, 0, c.width, c.height);
            const img = x.getImageData(0, 0, c.width, c.height);
            const code = jsQR(img.data, c.width, c.height, { inversionAttempts: 'dontInvert' });
            if (code && code.data) {
              if (openLink(code.data)) { stop = true; return; }
              setMsg('Ce QR code n’est pas celui de la partie.');
            }
          }
          timer = setTimeout(loop, 180);
        };
        loop();
      } catch {
        setMsg('La caméra est bloquée. Autorise-la dans les réglages, ou colle le lien ci-dessous.');
      }
    })();
    return () => { stop = true; clearTimeout(timer); stream && stream.getTracks().forEach((t) => t.stop()); };
  }, []);
  return html`<div class="cam" style="aspect-ratio:1">
    <video ref=${video} playsinline muted autoplay style="transform:none"></video>
    <svg class="frame" viewBox="0 0 100 100" preserveAspectRatio="none"><g stroke="#ff7a1a" stroke-width="1" fill="none"><path d="M18 30 V18 H30" /><path d="M70 18 H82 V30" /><path d="M18 70 V82 H30" /><path d="M70 82 H82 V70" /></g></svg>
    <div class="scan"></div>
    <p class="msg">${msg}</p>
  </div>`;
}

// Écran d'ouverture de l'appli installée (ou du site ouvert sur un téléphone sans lien de partie)
export function JoinScreen({ onOrganizer }) {
  const [scan, setScan] = useState(false);
  const [link, setLink] = useState('');
  const [bad, setBad] = useState(false);
  const app = isStandalone() || new URLSearchParams(location.search).has('app');
  return html`<div class="screen">
    ${!scan ? html`<div class="scene-bg" style="transform:translateY(-16%)"><${Scene} name="brume" className="scene" style="width:100%;height:100%" /></div>
      <div class="fade" style="background:linear-gradient(180deg,rgba(0,0,0,.5) 0%,transparent 20%,transparent 45%,#000 70%)"></div>` : null}
    <div class="pills" style="justify-content:center;margin-top:6px"><${Pill} or icon="moon-star">Halloween, 31 octobre</${Pill}></div>
    <div class="grow" style=${{ minHeight: scan ? '2dvh' : '30dvh' }}></div>
    <${Ex} size=${scan ? 44 : 60} depth=${8}>Le dernier<br />portail</${Ex}>
    ${scan
      ? html`<div style="margin-top:18px"><${Scanner} /></div>
        <label class="field" style="margin-top:12px"><span class="label">Ou colle le lien d’invitation</span>
          <input class="inp" value=${link} placeholder="https://…" onInput=${(e) => { setLink(e.target.value); setBad(false); }} /></label>
        ${bad ? html`<p class="sub" style="color:var(--rouge)">Ce lien n’est pas une invitation.</p>` : null}
        <div class="stack" style="margin-top:10px">
          ${link ? html`<${Btn} onClick=${() => setBad(!openLink(link.trim()))}>Rejoindre</${Btn}>` : null}
          <button class="link" onClick=${() => setScan(false)}>Retour</button>
        </div>`
      : html`<p class="lead" style="margin-top:18px">${app ? 'La porte s’ouvre avec le QR code affiché sur la TV.' : 'Entre. Ne pose aucune question.'}</p>
        ${!app ? html`<${InstallHelp} />` : null}
        <div class="bottom">
          <${Btn} icon="scan-face" onClick=${() => setScan(true)}>Scanner le QR code de la TV</${Btn}>
          <button class="link" onClick=${onOrganizer}>Maître du jeu : préparation et démo</button>
        </div>`}
  </div>`;
}
