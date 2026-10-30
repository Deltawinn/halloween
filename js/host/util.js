export function shuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

export function haversine(a, b) {
  const R = 6371000;
  const toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// décale un point d'au plus `m` mètres dans une direction aléatoire
export function jitter(p, m) {
  const d = Math.sqrt(Math.random()) * m;
  const t = Math.random() * Math.PI * 2;
  const dLat = (d * Math.cos(t)) / 111320;
  const dLng = (d * Math.sin(t)) / (111320 * Math.cos((p.lat * Math.PI) / 180));
  return { lat: p.lat + dLat, lng: p.lng + dLng };
}

export const MIN = 60000;
