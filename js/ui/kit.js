// Briques d'interface partagées (Preact + htm, sans étape de build).
import { html, render, useState, useEffect, useRef, useMemo, useCallback, Component } from '../../vendor/preact-htm.mjs';
import qrcode from '../../vendor/qrcode.mjs';
import { ICONS } from './icons.js';
import { scene } from './art.js';
import { play } from './sound.js';

export { html, render, useState, useEffect, useRef, useMemo, useCallback };

// Re-rend le composant à chaque émission de la source (Host ou Client)
export function useSource(src) {
  const [, set] = useState(0);
  useEffect(() => src.on(() => set((x) => x + 1)), [src]);
  return src;
}

export function useNow(every = 500) {
  const [n, set] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => set(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  return n;
}

export function fmt(ms) {
  if (ms == null || !isFinite(ms)) return '–';
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtShort(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function hm(t) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const mins = (ms) => Math.max(0, Math.round(ms / 60000));
export const plural = (n, one, many) => `${n} ${n > 1 ? many || one + 's' : one}`;
export const ordinal = (n) => (n === 1 ? '1er' : `${n}e`);
export const ORD = ['Première', 'Deuxième', 'Troisième', 'Quatrième', 'Cinquième'];

// Compte à rebours sur l'heure de la partie (clock = fonction qui donne l'heure de jeu)
export function Countdown({ to, clock, className = '', short }) {
  useNow(250);
  const left = to - clock();
  return html`<span class="tnum ${className}">${short ? fmtShort(left) : fmt(left)}</span>`;
}

export function Icon({ n, s = 18, className = '' }) {
  return html`<svg class="ic ${className}" width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: ICONS[n] || '' }}></svg>`;
}

// Titre Gloock orange avec relief
export function Ex({ children, size = 52, depth = 6, className = '', tag = 'h1' }) {
  const shadow = Array.from({ length: depth }, (_, i) => `${i + 1}px ${i + 1}px 0 var(--ext)`).join(',');
  const T = tag;
  return html`<${T} class="disp ${className}" style=${{ fontSize: typeof size === 'number' ? size + 'px' : size, textShadow: shadow }}>${children}</${T}>`;
}

export function Av({ src, size = 44, className = '' }) {
  return html`<span class="avf ${className}" style=${{ width: size + 8 + 'px', height: size + 8 + 'px' }}>
    ${src ? html`<img class="av" src=${src} width=${size} height=${size} alt="" />` : html`<span class="av av-empty" style=${{ width: size + 'px', height: size + 'px' }}><${Icon} n="user" s=${Math.round(size * 0.5)} /></span>`}
  </span>`;
}

export function Btn({ kind = 'primary', onClick, children, disabled, small, type = 'button', confirm, icon, className = '' }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  const click = (e) => {
    if (disabled) return;
    if (confirm && !armed) { setArmed(true); return; }
    setArmed(false);
    onClick && onClick(e);
  };
  return html`<button type=${type} class="btn ${kind} ${small ? 'sm' : ''} ${armed ? 'armed' : ''} ${className}" disabled=${disabled} onClick=${click}>
    ${icon && !armed ? html`<${Icon} n=${icon} s=${small ? 16 : 18} />` : null}${armed ? confirm : children}
  </button>`;
}

export function Pill({ icon, children, or, className = '' }) {
  return html`<span class="pill ${or ? 'or' : ''} ${className}">${icon ? html`<${Icon} n=${icon} s=${14} />` : null}${children}</span>`;
}

export function Steps({ n, of }) {
  return html`<div class="steps">${Array.from({ length: of }, (_, i) => html`<i class=${i < n ? 'on' : ''}></i>`)}</div>`;
}

export function Scene({ name, className = '', style }) {
  const svg = useMemo(() => scene(name), [name]);
  return html`<div class="scene-wrap ${className}" style=${style} dangerouslySetInnerHTML=${{ __html: svg }}></div>`;
}

export function QR({ text, className = '' }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }, [text]);
  return html`<div class="qr ${className}" dangerouslySetInnerHTML=${{ __html: svg }}></div>`;
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 999, show }) {
  return html`<div class="ostep">
    <button type="button" onClick=${() => onChange(Math.max(min, value - step))} aria-label="moins">−</button>
    <b>${show ? show(value) : value}</b>
    <button type="button" onClick=${() => onChange(Math.min(max, value + step))} aria-label="plus">+</button>
  </div>`;
}

export function Sheet({ onClose, children }) {
  return html`<div class="sheet-root">
    <div class="dim" onClick=${onClose}></div>
    <div class="sheet"><div class="grab"></div>${children}</div>
  </div>`;
}

// Bouton à glisser vers la droite pour confirmer
export function Slide({ label, onDone, disabled }) {
  const track = useRef(null);
  const [x, setX] = useState(0);
  const drag = useRef(null);
  const max = () => (track.current ? track.current.clientWidth - 72 : 200);
  const down = (e) => {
    if (disabled) return;
    drag.current = { x0: e.clientX - x };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!drag.current) return;
    setX(Math.max(0, Math.min(max(), e.clientX - drag.current.x0)));
  };
  const up = () => {
    if (!drag.current) return;
    drag.current = null;
    if (x >= max() * 0.88) { setX(max()); if (navigator.vibrate) try { navigator.vibrate(40); } catch {} onDone(); setTimeout(() => setX(0), 600); }
    else setX(0);
  };
  return html`<div class="slide ${disabled ? 'off' : ''}" ref=${track}>
    <span class="slide-l" style=${{ opacity: 1 - x / Math.max(1, max()) }}>${label}</span>
    <div class="knob" style=${{ transform: `translateX(${x}px)`, transition: drag.current ? 'none' : 'transform .25s' }}
      onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}><${Icon} n="chevrons-right" s=${22} /></div>
  </div>`;
}

// Notifications flottantes : n'affiche que les nouvelles alertes
export function Toasts({ alerts, storeKey, sound = true }) {
  const [shown, setShown] = useState([]);
  const seen = useRef(null);
  useEffect(() => {
    if (seen.current == null) {
      try { seen.current = Number(sessionStorage.getItem(storeKey)) || 0; } catch { seen.current = 0; }
      const max = Math.max(0, ...(alerts || []).map((a) => a.id));
      if (!seen.current && max) { seen.current = max; return; }
    }
    const fresh = (alerts || []).filter((a) => a.id > seen.current);
    if (!fresh.length) return;
    seen.current = Math.max(...fresh.map((a) => a.id));
    try { sessionStorage.setItem(storeKey, String(seen.current)); } catch {}
    const bad = fresh.some((a) => a.kind === 'bad');
    if (navigator.vibrate) { try { navigator.vibrate(bad ? [180, 80, 180] : 60); } catch {} }
    if (sound) play(bad ? 'bad' : 'ping');
    setShown((s) => [...s, ...fresh].slice(-2));
    const ids = fresh.map((a) => a.id);
    setTimeout(() => setShown((s) => s.filter((a) => !ids.includes(a.id))), 4500);
  }, [alerts]);
  if (!shown.length) return null;
  return html`<div class="toasts" role="status">
    ${shown.map((a) => html`<div class="toast t-${a.kind}" key=${a.id} onClick=${() => setShown((s) => s.filter((x) => x.id !== a.id))}>${a.text}</div>`)}
  </div>`;
}

export function Status({ status, hostAlive, label = 'Écran TV' }) {
  if (status === 'local') return null;
  const ok = status === 'ok' && hostAlive !== false;
  const text = status !== 'ok' ? 'Connexion au relais…' : hostAlive === false ? `${label} injoignable` : 'En ligne';
  return ok ? null : html`<div class="netbar">${text}</div>`;
}

export async function keepAwake() {
  try {
    if ('wakeLock' in navigator) {
      let lock = await navigator.wakeLock.request('screen');
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && lock.released) { try { lock = await navigator.wakeLock.request('screen'); } catch {} }
      });
      return true;
    }
  } catch {}
  return false;
}

export const SYM_ICON = { skull: 'skull', moon: 'moon', eye: 'eye', flame: 'flame' };

// Filet de sécurité : si un écran plante (données pas encore arrivées), on réessaie au lieu de figer l'appli
export class Safe extends Component {
  constructor() { super(); this.state = { err: null }; }
  componentDidCatch(err) {
    console.warn('écran', err);
    this.setState({ err: String(err && err.message || err) });
    clearTimeout(this.t);
    this.t = setTimeout(() => this.setState({ err: null }), 1200);
  }
  render() {
    if (this.state.err) return html`<div class="screen"><div class="grow"></div><p class="lead center muted">Synchronisation…</p><div class="grow"></div></div>`;
    return this.props.children;
  }
}
