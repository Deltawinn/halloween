// Mode démo : des monstres virtuels jouent la partie pour que le MJ teste tout, seul, avant la soirée.
import { MONSTERS } from '../data.js';
import { botFace } from '../pixel.js';
import { haversine, jitter, pick, MIN } from './util.js';

const NAMES = [
  ['Morticia', 'Lune'], ['Gomez', 'Corbeau'], ['Mercredi', 'Ombre'], ['Igor', 'Brume'], ['Lenore', 'Cendre'],
  ['Silas', 'Nuit'], ['Mina', 'Givre'], ['Victor', 'Sépulcre'], ['Ada', 'Crypte'], ['Elias', 'Ronce'],
  ['Ophélie', 'Saule'], ['Basile', 'Tombe'],
];

// Probabilité qu'un événement de fréquence `perMin` arrive pendant `dt` ms de jeu
const chance = (perMin, dt) => 1 - Math.exp(-perMin * (dt / MIN));

export class Bots {
  constructor(host) {
    this.h = host;
    this.E = host.E;
    this.cfg = host.d.bots || (host.d.bots = { n: 0, gps: true });
    this.mem = {};
    this.last = this.E.now();
  }

  list() { return this.E.list().filter((p) => p.bot); }

  handle(m) {
    const E = this.E;
    if (m.a === 'count') this.setCount(m.n);
    else if (m.a === 'speed') this.h.setSpeed(m.s);
    else if (m.a === 'gps') this.cfg.gps = !!m.on;
    else if (m.a === 'reset') {
      E.handle({ mj: true }, { g: 'nuit', a: 'reset' });
      this.mem = {};
    }
  }

  setCount(n) {
    const E = this.E;
    if (E.S.nuit.st !== 'idle') return;
    n = Math.max(0, Math.min(12, Math.round(Number(n) || 0)));
    this.cfg.n = n;
    const bots = this.list();
    for (let i = n; i < bots.length; i++) E.handle({ mj: true }, { a: 'kick', pid: bots[i].id });
    for (let i = bots.length; i < n; i++) this.add();
  }

  add() {
    const E = this.E;
    const used = new Set(E.list().map((p) => p.name));
    const free = NAMES.filter(([f]) => !used.has(f));
    const [first, last] = free.length ? free[0] : [`Monstre ${E.list().length + 1}`, ''];
    const taken = new Set(E.list().map((p) => p.monster && p.monster.name));
    const mon = MONSTERS.find((m) => !taken.has(m.name)) || pick(MONSTERS);
    const pid = 'bot-' + Math.random().toString(36).slice(2, 8);
    E.addPlayer({ pid, pub: null, name: first });
    const p = E.S.players[pid];
    p.bot = true;
    p.last = last;
    p.monster = { name: mon.name, film: mon.film };
    p.avatar = botFace(NAMES.findIndex(([f]) => f === first) + 3);
  }

  act(pid, a, x) { this.E.handle({ pid }, { g: 'nuit', a, ...(x || {}) }); }

  tick() {
    const E = this.E;
    const N = E.S.nuit;
    const now = E.now();
    const dt = Math.min(MIN, Math.max(0, now - this.last));
    this.last = now;
    const bots = this.list();
    for (const b of bots) b.seen = Date.now();
    if (N.pausedAt) return;

    if (N.st === 'idle') return this.lobby(bots);
    if (N.st === 'evasion') return this.evasion(bots, dt, now);
    if ((N.st === 'alerte' || N.st === 'refuge') && this.cfg.gps && N.center) this.outside(bots, dt, now);
  }

  lobby() {}

  evasion(bots, dt, now) {
    const E = this.E;
    const N = E.S.nuit;
    if (!bots.length) return;
    const enig = N.escape.enigmas;
    const unfound = enig.filter((e) => !N.found[e.num]);
    if (unfound.length && Math.random() < chance(0.09 * bots.length, dt)) {
      this.act(pick(bots).id, 'num', { n: pick(unfound).num });
    }
    for (const e of enig) {
      const f = N.found[e.num];
      if (!f || N.solved[e.num]) continue;
      const m = (this.mem['e' + e.num] ||= { at: f.at + (3 + Math.random() * 4) * MIN });
      if (now >= m.at) this.act(pick(bots).id, 'answer', { num: e.num, text: e.answers[0] });
    }
    if (Object.keys(N.solved).length === 4) {
      const last = Math.max(...Object.values(N.solved).map((s) => s.at));
      const m = (this.mem.code ||= { at: last + (2 + Math.random() * 2) * MIN, tried: false });
      if (!m.tried && now >= m.at - MIN) { m.tried = true; this.act(pick(bots).id, 'code', { code: '0000' }); }
      if (now >= m.at) this.act(pick(bots).id, 'code', { code: N.escape.code });
    }
  }

  outside(bots, dt, now) {
    const E = this.E;
    const N = E.S.nuit;
    const C = N.center;
    const R = N.cfg.radius;
    const rebel = bots[0] && bots[0].id;
    for (const b of bots) {
      const st = N.status[b.id];
      if (st === 'sauve') continue;
      const m = (this.mem[b.id] ||= { pos: jitter(C, 40), speed: 1 + Math.random() * 0.8, wp: null });
      // choix de la destination
      const hunter = st === 'exorcise';
      if (hunter) {
        const prey = N.sights.filter((s) => N.status[s.pid] === 'monstre').slice(-6);
        if (!m.wp || Math.random() < chance(0.5, dt)) m.wp = prey.length ? pick(prey) : jitter(C, R * 0.8);
      } else if (N.st === 'refuge' && N.refugePt && (m.goHome ??= Math.random() < 0.75) && now - N.refugeAt > (2 + (b.id.charCodeAt(4) % 8)) * MIN) {
        m.wp = N.refugePt;
      } else if (!m.wp || haversine(m.pos, m.wp) < 15) {
        m.wp = b.id === rebel && N.st === 'alerte' && Math.random() < 0.5 ? jitter(C, R * 1.25) : jitter(C, R * 0.85);
      }
      // déplacement à pied
      const d = haversine(m.pos, m.wp);
      const step = Math.min(d, (m.speed * dt) / 1000);
      if (d > 0.5) {
        const k = step / d;
        m.pos = { lat: m.pos.lat + (m.wp.lat - m.pos.lat) * k, lng: m.pos.lng + (m.wp.lng - m.pos.lng) * k };
      }
      const hunting = now >= N.huntAt;
      if (hunter) {
        N.hpos[b.id] = { lat: m.pos.lat, lng: m.pos.lng, acc: 8, t: now };
        if (!hunting) continue;
        continue;
      }
      this.act(b.id, 'gps', { lat: m.pos.lat, lng: m.pos.lng, acc: 8 });
      if (N.status[b.id] !== 'monstre') continue;
      // le MJ (position réelle ou simulée) attrape les monstres virtuels qu'il approche
      const mj = N.hpos.mj;
      if (hunting && mj && now - mj.t < 2 * MIN && haversine(mj, m.pos) < 25) { this.act(b.id, 'caught', { by: 'mj' }); continue; }
      if (hunting && N.st === 'alerte' && Math.random() < chance(0.006, dt)) { this.act(b.id, 'caught', { by: 'mj' }); continue; }
      const pw = N.powers[b.id];
      if (pw && !pw.used && pw.id !== 'immune' && Math.random() < chance(0.05, dt)) {
        const t = E.ids().find((id) => N.status[id] === 'exorcise');
        if (pw.id !== 'revive' || t) this.act(b.id, 'power', { target: t });
      }
    }
  }
}
