// Portraits en pixels 32 × 32, tramés dans la palette de la nuit (noir → orange → crème).
export const PALETTE = ['#070403', '#2a1006', '#7d300a', '#ff7a1a', '#ffd0a0'];
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const N = 32;
const RGB = PALETTE.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const hasDom = typeof document !== 'undefined';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// L : tableau de N*N luminances (0..1), null pour le fond
export function gridToPng(L) {
  if (!hasDom) return null;
  const c = canvas(N, N);
  const x = c.getContext('2d');
  const img = x.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let u = 0; u < N; u++) {
      const i = y * N + u;
      let v = L[i];
      if (v == null) {
        const d = Math.hypot(u - N / 2 + 0.5, y - N * 0.42) / (N * 0.7);
        v = 0.3 - d * 0.22;
      }
      const t = v + (BAYER[y % 4][u % 4] / 16 - 0.47) * 0.16;
      const k = Math.max(0, Math.min(4, Math.floor(t * 4.7)));
      const [r, g, b] = RGB[k];
      img.data.set([r, g, b, 255], i * 4);
    }
  }
  x.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

// Capture d'un visage (vidéo ou image) → portrait tramé. `mirror` pour la caméra frontale.
export function pixelate(src, sw, sh, { mirror = true } = {}) {
  const side = Math.min(sw, sh) * 0.86;
  const sx = (sw - side) / 2;
  const sy = Math.max(0, (sh - side) / 2 - side * 0.04);
  const c = canvas(N, N);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high';
  if (mirror) { x.translate(N, 0); x.scale(-1, 1); }
  x.drawImage(src, sx, sy, side, side, 0, 0, N, N);
  const d = x.getImageData(0, 0, N, N).data;
  const L = new Array(N * N);
  const inner = [];
  for (let i = 0; i < N * N; i++) {
    const l = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
    L[i] = l;
    const u = (i % N) / N - 0.5;
    const v = Math.floor(i / N) / N - 0.45;
    if ((u * u) / 0.07 + (v * v) / 0.12 < 1) inner.push(l);
  }
  inner.sort((a, b) => a - b);
  const lo = inner[Math.floor(inner.length * 0.04)] ?? 0;
  const hi = inner[Math.floor(inner.length * 0.97)] ?? 1;
  const span = Math.max(0.08, hi - lo);
  for (let i = 0; i < N * N; i++) {
    const u = (i % N) / N - 0.5;
    const v = Math.floor(i / N) / N - 0.45;
    const r = Math.sqrt((u * u) / 0.09 + (v * v) / 0.16);
    let t = (L[i] - lo) / span;
    t = Math.max(0, Math.min(1, t));
    t = 0.06 + Math.pow(t, 0.9) * 0.86;
    t *= 1 - 0.55 * Math.max(0, Math.min(1, r - 0.75));
    L[i] = t;
  }
  return gridToPng(L);
}

// ---------- visages générés (monstres virtuels de la démo) ----------
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const ell = (u, v, cx, cy, rx, ry) => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2;

export function botFace(seed) {
  if (!hasDom) return null;
  const rnd = rng(seed * 7919 + 13);
  const hairs = ['short', 'long', 'bun', 'bob', 'curly', 'bald', 'hood'];
  const hair = hairs[Math.floor(rnd() * hairs.length)];
  const glasses = rnd() < 0.25;
  const beard = rnd() < 0.3;
  const shirt = rnd() < 0.5 ? 2 : 1;
  const L = new Array(N * N).fill(null);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N;
      const v = (y + 0.5) / N;
      let l = null;
      if (ell(u, v, 0.5, 1.13, 0.5, 0.36) < 1) l = (shirt === 2 ? 0.42 : 0.16) + (0.5 - u) * 0.18;
      if (Math.abs(u - 0.5) < 0.085 && v > 0.6 && v < 0.84) l = 0.5 + (0.5 - u) * 0.3;
      if (hair === 'hood' && ell(u, v, 0.5, 0.5, 0.33, 0.42) < 1) l = 0.07 + (0.5 - u) * 0.08;
      const face = ell(u, v, 0.5, 0.45, 0.195, 0.255);
      if (!['hood', 'long', 'bob'].includes(hair) && (ell(u, v, 0.3, 0.47, 0.035, 0.055) < 1 || ell(u, v, 0.7, 0.47, 0.035, 0.055) < 1)) l = 0.55;
      if (face < 1) {
        const nx = (u - 0.5) / 0.195;
        const ny = (v - 0.45) / 0.255;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        l = 0.5 + 0.42 * Math.max(0, -0.45 * nx - 0.35 * ny + 0.8 * nz) - 0.08 * Math.max(0, nx);
        if (ell(u, v, 0.42, 0.465, 0.032, 0.016) < 1 || ell(u, v, 0.58, 0.465, 0.032, 0.016) < 1) l = 0.04;
        if (Math.abs(v - 0.425) < 0.012 && ((u > 0.37 && u < 0.46) || (u > 0.54 && u < 0.63))) l = 0.14;
        if (ell(u, v, 0.53, 0.55, 0.02, 0.03) < 1) l -= 0.16;
        if (ell(u, v, 0.5, 0.615, 0.055, 0.014) < 1) l = 0.28;
        if (glasses) {
          const a = Math.hypot(u - 0.42, (v - 0.465) * 0.9);
          const b = Math.hypot(u - 0.58, (v - 0.465) * 0.9);
          if ((a > 0.04 && a < 0.062) || (b > 0.04 && b < 0.062) || (Math.abs(v - 0.465) < 0.01 && u > 0.48 && u < 0.52)) l = 0.05;
        }
        if (beard && v > 0.555 && !(ell(u, v, 0.5, 0.615, 0.06, 0.02) < 1)) l = 0.14 + rnd() * 0.08;
      }
      const hl = 0.06 + rnd() * 0.04 + Math.max(0, 0.38 - u) * 0.3;
      const top = 0.3 - 0.07 * ((u - 0.5) / 0.21) ** 2;
      if (['short', 'long', 'bun', 'bob', 'curly'].includes(hair) && ell(u, v, 0.5, 0.43, 0.23, 0.29) < 1 && v < top + (hair === 'curly' ? 0.04 : 0)) l = hl;
      if (hair === 'curly' && ell(u, v, 0.5, 0.3, 0.27, 0.17) < 1 && (v < 0.34 || Math.abs(u - 0.5) > 0.19)) l = (x + y) % 3 ? hl : hl + 0.12;
      if (hair === 'long' && u > 0.26 && u < 0.74 && v < 0.8 && Math.abs(u - 0.5) > 0.17 && ell(u, v, 0.5, 0.5, 0.26, 0.38) < 1) l = hl;
      if (hair === 'bob' && Math.abs(u - 0.5) > 0.16 && v < 0.63 && ell(u, v, 0.5, 0.45, 0.25, 0.3) < 1) l = hl;
      if (hair === 'bun' && ell(u, v, 0.5, 0.13, 0.08, 0.065) < 1) l = hl;
      L[y * N + x] = l;
    }
  }
  return gridToPng(L);
}

// ---------- portraits stylisés à partir d'un selfie ----------
const RAMP = [[8, 3, 1], [42, 14, 4], [125, 48, 10], [255, 122, 26], [255, 208, 160], [255, 240, 224]];

function rampColor(t) {
  const x = Math.max(0, Math.min(1, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x));
  const f = x - i;
  return RAMP[i].map((c, k) => Math.round(c + (RAMP[i + 1][k] - c) * f));
}

// recadre le visage en couleur, carré de 192 px
export function grab(src, sw, sh, { mirror = true } = {}) {
  const side = Math.min(sw, sh) * 0.86;
  const sx = (sw - side) / 2;
  const sy = Math.max(0, (sh - side) / 2 - side * 0.04);
  const c = canvas(192, 192);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high';
  if (mirror) { x.translate(192, 0); x.scale(-1, 1); }
  x.drawImage(src, sx, sy, side, side, 0, 0, 192, 192);
  return c;
}

// luminance normalisée sur le visage (niveaux automatiques)
function lum(c, n) {
  const k = canvas(n, n);
  const x = k.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high';
  x.drawImage(c, 0, 0, n, n);
  const d = x.getImageData(0, 0, n, n).data;
  const L = new Float32Array(n * n);
  const inner = [];
  for (let i = 0; i < n * n; i++) {
    const l = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
    L[i] = l;
    const u = (i % n) / n - 0.5;
    const v = Math.floor(i / n) / n - 0.45;
    if ((u * u) / 0.07 + (v * v) / 0.12 < 1) inner.push(l);
  }
  inner.sort((a, b) => a - b);
  const lo = inner[Math.floor(inner.length * 0.03)] ?? 0;
  const hi = inner[Math.floor(inner.length * 0.98)] ?? 1;
  const span = Math.max(0.1, hi - lo);
  for (let i = 0; i < n * n; i++) L[i] = Math.max(0, Math.min(1, (L[i] - lo) / span));
  return L;
}

// trois styles au choix : pixel (48 px, tramé), affiche (dégradé de la nuit), VHS (lignes, grain, vignette)
export function stylize(c, style) {
  if (!hasDom || !c) return null;
  if (style === 'pixel') {
    // 64 × 64, 8 tons, contours renforcés pour garder les traits du visage
    const n = 64;
    const L = lum(c, n);
    const B = new Float32Array(n * n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let sum = 0;
        let k = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            if (yy >= 0 && yy < n && xx >= 0 && xx < n) { sum += L[yy * n + xx]; k += 1; }
          }
        }
        B[y * n + x] = sum / k;
      }
    }
    const out = canvas(n, n);
    const x = out.getContext('2d');
    const img = x.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const u = i % n;
      const v = Math.floor(i / n);
      let t = L[i] + 0.9 * (L[i] - B[i]);
      t = Math.pow(Math.max(0, Math.min(1, t)), 0.85);
      t = 0.05 + t * 0.92 + (BAYER[v % 4][u % 4] / 16 - 0.47) * 0.06;
      const r = Math.hypot(u / n - 0.5, v / n - 0.47);
      t *= 1 - 0.5 * Math.max(0, r - 0.42);
      const [R, G, Bl] = rampColor(Math.round(Math.max(0, Math.min(1, t)) * 7) / 7);
      img.data.set([R, G, Bl, 255], i * 4);
    }
    x.putImageData(img, 0, 0);
    return out.toDataURL('image/png');
  }
  const n = 128;
  const L = lum(c, n);
  const out = canvas(n, n);
  const x = out.getContext('2d');
  const img = x.createImageData(n, n);
  const vhs = style === 'vhs';
  for (let i = 0; i < n * n; i++) {
    const u = (i % n) / n - 0.5;
    const v = Math.floor(i / n) / n - 0.5;
    let t = Math.pow(L[i], 0.85);
    if (vhs) {
      t = t * 0.92 + (Math.random() - 0.5) * 0.12;
      if (Math.floor(i / n) % 3 === 0) t *= 0.72;
      t *= 1 - 0.9 * Math.max(0, Math.hypot(u, v) - 0.36);
    } else {
      t = 0.04 + t * 0.92;
      t *= 1 - 0.6 * Math.max(0, Math.hypot(u, v) - 0.45);
    }
    const [r, g, b] = rampColor(t * (vhs ? 0.88 : 0.96));
    img.data.set([r, g, b, 255], i * 4);
  }
  x.putImageData(img, 0, 0);
  return out.toDataURL('image/jpeg', 0.8);
}
