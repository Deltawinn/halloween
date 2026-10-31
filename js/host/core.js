// Actions générales : présence, identité, monstre, binôme, SOS, pilotage par le MJ.
import { MONSTERS } from '../data.js';
import { shuffle } from './util.js';

const SCREENS = ['lobby', 'intro', 'nuit', 'manoir'];
const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

function locked(E) { return E.S.nuit && E.S.nuit.st !== 'idle'; }

export const core = {
  key: 'core',

  act: {
    ping() {},
    hello() {},

    identity(E, { pid }, m) {
      const p = E.S.players[pid];
      const first = clean(m.first, 18);
      if (first) p.name = first;
      p.last = clean(m.last, 24);
    },

    avatar(E, { pid }, m) {
      const d = String(m.data || '');
      if ((d.startsWith('data:image/png') || d.startsWith('data:image/jpeg')) && d.length < 20000) E.S.players[pid].avatar = d;
    },

    monster(E, { pid }, m) {
      if (locked(E)) return;
      const p = E.S.players[pid];
      const known = MONSTERS.find((x) => x.name === m.name);
      if (known) p.monster = { name: known.name, film: known.film };
      else if (clean(m.name, 30)) p.monster = { name: clean(m.name, 30), film: 'Monstre maison', custom: true };
    },

    choose(E, { pid }, m) {
      if (locked(E)) return;
      const p = E.S.players[pid];
      const t = E.S.players[m.pid];
      if (p.bound || !t || t.gone || t.id === pid || t.bound) return;
      p.want = t.id;
      if (t.want === pid) {
        p.bound = t.id;
        t.bound = pid;
        E.alert(t.id, `Ton sort est désormais lié à ${p.name}.`, 'ok');
        E.alert(pid, `Ton sort est désormais lié à ${t.name}.`, 'ok');
        E.mjAlert(`Binôme scellé : ${p.name} et ${t.name}.`, 'info');
      } else {
        E.alert(t.id, `${p.name} veut lier son sort au tien.`, 'info');
      }
    },

    sos(E, { pid }, m) {
      const where = m.lat != null ? { lat: +m.lat, lng: +m.lng } : null;
      E.mjAlert(`SOS de ${E.full(pid)} !`, 'sos', { pid, where, t: E.now() });
      E.alert(pid, 'Ton SOS a été envoyé au maître du jeu.', 'ok');
    },
  },

  mj: {
    screen(E, c, m) { if (SCREENS.includes(m.screen)) E.S.screen = m.screen; },

    rename(E, c, m) {
      const p = E.S.players[m.pid];
      if (!p) return;
      if (clean(m.first, 18)) p.name = clean(m.first, 18);
      if (m.last != null) p.last = clean(m.last, 24);
    },

    kick(E, c, m) {
      const p = E.S.players[m.pid];
      if (!p) return;
      p.gone = true;
      if (p.bound && E.S.players[p.bound]) { E.S.players[p.bound].bound = null; E.S.players[p.bound].want = null; }
      p.bound = null;
    },

    unbind(E, c, m) {
      if (locked(E)) return;
      const p = E.S.players[m.pid];
      if (!p) return;
      const o = p.bound && E.S.players[p.bound];
      if (o) { o.bound = null; o.want = null; }
      p.bound = null; p.want = null;
    },

    pair(E, c, m) {
      if (locked(E)) return;
      const a = E.S.players[m.a];
      const b = E.S.players[m.b];
      if (!a || !b || a === b) return;
      for (const p of [a, b]) if (p.bound && E.S.players[p.bound]) { E.S.players[p.bound].bound = null; E.S.players[p.bound].want = null; }
      a.bound = b.id; b.bound = a.id; a.want = b.id; b.want = a.id;
    },

    autopair(E) {
      if (locked(E)) return;
      const free = shuffle(E.list().filter((p) => !p.bound));
      for (let i = 0; i + 1 < free.length; i += 2) {
        free[i].bound = free[i + 1].id; free[i + 1].bound = free[i].id;
        free[i].want = free[i + 1].id; free[i + 1].want = free[i].id;
      }
    },

    mjName(E, c, m) {
      if (clean(m.first, 18)) E.S.mj.first = clean(m.first, 18);
      if (m.last != null) E.S.mj.last = clean(m.last, 24);
    },

    title(E, c, m) {
      const title = clean(m.title, 80);
      if (title) E.overlay({ kind: 'mj', title, sub: clean(m.sub, 160), ms: 9000 });
    },

    skipOverlay(E) {
      if (E.S.ovCur) E.S.ovCur.until = 0;
      E.tickOverlay();
    },

    roomName(E, c, m) { if (clean(m.name, 40)) E.S.name = clean(m.name, 40); },
    clearAlerts(E) { E.S.mjAlerts = []; },
  },
};
