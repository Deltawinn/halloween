// Carte de la traque (Leaflet + fond sombre CARTO teinté orange). Zoom aux boutons et au pincement.
import * as L from '../../vendor/leaflet.esm.js';
import { html, useEffect, useRef, useState } from './kit.js';
import { ICONS } from './icons.js';

// Fonds de carte sans clé, au choix du MJ. Si un fond ne répond pas, on bascule sur OpenStreetMap.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const T = (path, cls, extra = {}) => ({ url: ESRI + path + '/MapServer/tile/{z}/{y}/{x}', opt: { maxZoom: 19, className: cls, ...extra } });
const STYLES = {
  nuit: [T('Canvas/World_Dark_Gray_Base', 'tiles-esri', { maxNativeZoom: 16, attribution: '© Esri, © OpenStreetMap' }), T('Canvas/World_Dark_Gray_Reference', 'tiles-esri-labels', { maxNativeZoom: 16 })],
  gris: [T('Canvas/World_Dark_Gray_Base', 'tiles-plain', { maxNativeZoom: 16, attribution: '© Esri, © OpenStreetMap' }), T('Canvas/World_Dark_Gray_Reference', 'tiles-plain', { maxNativeZoom: 16 })],
  satellite: [T('World_Imagery', 'tiles-sat', { maxNativeZoom: 18, attribution: '© Esri, Maxar' }), T('Reference/World_Transportation', 'tiles-sat-roads', { maxNativeZoom: 18 })],
  plan: [{ url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', opt: { maxZoom: 19, className: 'tiles-osm', attribution: '© OpenStreetMap' } }],
};
let broken = {};
try { broken = JSON.parse(sessionStorage.getItem('hw.tiles.ko') || '{}'); } catch {}

function addBase(m, style, onSwap) {
  const key = broken[style] ? 'plan' : STYLES[style] ? style : 'nuit';
  const layers = STYLES[key].map((t) => L.tileLayer(t.url, t.opt).addTo(m));
  if (key !== 'plan') {
    let ok = 0;
    let bad = 0;
    layers[0].on('tileload', () => { ok += 1; });
    layers[0].on('tileerror', () => {
      bad += 1;
      if (bad >= 4 && ok === 0 && !broken[key]) {
        broken[key] = true;
        try { sessionStorage.setItem('hw.tiles.ko', JSON.stringify(broken)); } catch {}
        onSwap();
      }
    });
  }
  return layers;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ico = (n, s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;

export function GameMap({ center, radius, refuge, me, mate, marks, onTap, className = '', blind, home = true, fitKey, mapStyle = 'nuit' }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const fitted = useRef(null);
  const refit = useRef(null);
  const base = useRef([]);
  const [swap, setSwap] = useState(0);
  const tapRef = useRef(onTap);
  tapRef.current = onTap;

  useEffect(() => {
    const m = L.map(el.current, { zoomControl: false, attributionControl: true, center: [46.6, 2.4], zoom: 5, tap: true });
    L.control.zoom({ position: 'topright', zoomInTitle: 'Zoomer', zoomOutTitle: 'Dézoomer' }).addTo(m);
    m.attributionControl.setPrefix(false);
    layer.current = L.layerGroup().addTo(m);
    m.on('click', (e) => tapRef.current && tapRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    map.current = m;
    let w0 = el.current.clientHeight;
    const ro = new ResizeObserver(() => {
      m.invalidateSize();
      const h = el.current && el.current.clientHeight;
      if (!w0 && h) { fitted.current = null; refit.current && refit.current(); }
      w0 = h;
    });
    ro.observe(el.current);
    return () => { ro.disconnect(); m.remove(); };
  }, []);

  // fond de carte : change quand le MJ choisit un autre style
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    base.current.forEach((l) => m.removeLayer(l));
    base.current = addBase(m, mapStyle, () => setSwap((x) => x + 1));
    base.current.forEach((l) => l.bringToBack());
  }, [mapStyle, swap]);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    if (center && radius) {
      L.circle([center.lat, center.lng], { radius, color: '#ff7a1a', weight: 2, dashArray: '7 7', fillColor: '#ff7a1a', fillOpacity: 0.03, interactive: false }).addTo(g);
    }
    if (center && home) {
      L.marker([center.lat, center.lng], { icon: L.divIcon({ className: 'mk-home', html: ico('house', 22), iconSize: [28, 28] }), interactive: false }).addTo(g);
    }
    if (refuge) {
      L.circle([refuge.lat, refuge.lng], { radius: 100, color: '#ffd0a0', weight: 1, dashArray: '2 5', fillOpacity: 0.04, interactive: false }).addTo(g);
      L.marker([refuge.lat, refuge.lng], { icon: L.divIcon({ className: 'mk-refuge', html: ico('flag', 18), iconSize: [30, 30] }), interactive: false }).addTo(g);
    }
    for (const k of marks || []) {
      if (k.lat == null) continue;
      const inner = k.av ? `<img src="${k.av}" alt="">` : ico(k.kind === 'chasseur' ? 'crosshair' : 'ghost', 16);
      const lab = k.label ? `<span class="mk-l">${esc(k.label)}</span>` : '';
      L.marker([k.lat, k.lng], {
        icon: L.divIcon({ className: `mk mk-${k.kind || 'monstre'} ${k.dim ? 'dim' : ''}`, html: `<i>${inner}</i>${lab}`, iconSize: [34, 34], iconAnchor: [17, 17] }),
        interactive: false, zIndexOffset: k.kind === 'chasseur' ? 500 : 0,
      }).addTo(g);
    }
    if (mate) {
      L.marker([mate.lat, mate.lng], { icon: L.divIcon({ className: 'mk mk-mate', html: `<i>${mate.av ? `<img src="${mate.av}" alt="">` : ico('user', 16)}</i><span class="mk-l">${esc(mate.label || 'Binôme')}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }), interactive: false }).addTo(g);
    }
    if (me) {
      if (me.acc) L.circle([me.lat, me.lng], { radius: Math.min(me.acc, 300), color: '#ffd0a0', weight: 1, fillOpacity: 0.06, interactive: false }).addTo(g);
      L.marker([me.lat, me.lng], { icon: L.divIcon({ className: 'mk-me', html: '<i></i>', iconSize: [20, 20] }), interactive: false, zIndexOffset: 1000 }).addTo(g);
    }
    const key = fitKey || (center ? 'c' : me ? 'm' : '');
    refit.current = () => {
      if (!el.current || !el.current.clientHeight) return;
      if (center && radius) m.fitBounds(L.latLng(center.lat, center.lng).toBounds(radius * 2.25));
      else if (center) m.setView([center.lat, center.lng], 16);
      else if (me) m.setView([me.lat, me.lng], 16);
      fitted.current = key;
    };
    if (key && fitted.current !== key) refit.current();
  }, [center && center.lat, center && center.lng, radius, refuge && refuge.lat, refuge && refuge.lng, me && me.lat, me && me.lng, mate && mate.lat, JSON.stringify(marks || []), fitKey]);

  return html`<div class="mapin ${className} ${blind ? 'blind' : ''}">
    <div class="map" ref=${el}></div>
    ${blind ? html`<div class="map-blind"><span>Ne t’endors pas…</span></div>` : null}
  </div>`;
}
