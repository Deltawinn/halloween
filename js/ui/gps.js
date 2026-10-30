// Position GPS envoyée à l'hôte : à chaque déplacement notable, et au moins toutes les 5 s.
// En démo, la position est simulée : on se déplace en touchant la carte.
import { useState, useEffect, useRef } from './kit.js';

export function useGps({ active, send, simulated, start }) {
  const [pos, setPos] = useState(null);
  const [err, setErr] = useState(null);
  const cur = useRef(null);
  const last = useRef({ t: 0, p: null });
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (!active) return;
    if (simulated) {
      if (!cur.current && start) { cur.current = { ...start, acc: 6 }; setPos(cur.current); }
      return;
    }
    if (!navigator.geolocation) { setErr('Ce téléphone ne donne pas sa position.'); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const v = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) };
        cur.current = v;
        setPos(v);
        setErr(null);
      },
      (e) => setErr(e.code === 1 ? 'Autorise la localisation dans les réglages de ton navigateur pour jouer.' : 'Signal GPS faible…'),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active, simulated]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      const p = cur.current;
      if (!p) return;
      const now = Date.now();
      const l = last.current;
      const moved = !l.p || Math.abs(l.p.lat - p.lat) + Math.abs(l.p.lng - p.lng) > 0.00008;
      if ((moved && now - l.t > 2500) || now - l.t > 5000) {
        last.current = { t: now, p };
        sendRef.current(p);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [active]);

  const moveTo = (p) => { cur.current = { ...p, acc: 6 }; setPos(cur.current); last.current.t = 0; };
  return { pos, err, moveTo };
}
