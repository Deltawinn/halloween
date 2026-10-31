// « Le dernier portail » : la partie en trois actes.
// Acte 1 L'Évasion (escape game), Acte 2 L'Alerte générale (traque GPS), Acte 3 Le Refuge.
import { DEFAULT_ESCAPE, DEFAULT_CLUES, DEFAULT_CFG, MONSTERS, POWERS, CUSTOM_POWERS, MAP_STYLES } from '../data.js';
import { haversine, jitter, pick, MIN } from './util.js';

const SEC = 1000;
const OUT_PING = 10 * SEC;

export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();

const clone = (o) => JSON.parse(JSON.stringify(o));

export const nuit = {
  key: 'nuit',

  init: () => ({
    st: 'idle', // idle | evasion | alerte | refuge | fin
    cfg: { ...DEFAULT_CFG },
    center: null,
    refugePt: null,
    escape: clone(DEFAULT_ESCAPE),
    clues: DEFAULT_CLUES.slice(),
    startAt: 0, endsAt: 0, pausedAt: 0,
    found: {}, solved: {}, hints: {}, tries: 0, escapedAt: 0, timedOut: false, head: 0,
    alertAt: 0, huntAt: 0, nextSight: 0, refugeAt: 0, sightN: 0,
    powers: {}, status: {}, exo: {}, saved: {},
    pos: {}, hpos: {}, sights: [], out: {}, lastOut: {},
    fx: { decoy: {}, fake: {}, hide: {}, swap: {}, hide5: {}, blindUntil: 0, seeUntil: {}, immune: {}, early: {} },
    reads: {},
    feed: [],
    say: null,
    results: null,
  }),

  mj: {
    cfg(E, c, m) {
      const N = E.S.nuit;
      const k = (v, a, b, d) => Math.max(a, Math.min(b, Math.round(Number(v ?? d))));
      N.cfg.evasion = k(m.evasion, 5, 90, N.cfg.evasion);
      N.cfg.alerte = k(m.alerte, 5, 90, N.cfg.alerte);
      N.cfg.refuge = k(m.refuge, 5, 60, N.cfg.refuge);
      N.cfg.every = k(m.every, 1, 20, N.cfg.every);
      N.cfg.radius = k(m.radius, 200, 5000, N.cfg.radius);
      N.cfg.refugeR = k(m.refugeR, 15, 200, N.cfg.refugeR);
      if (MAP_STYLES[m.mapStyle]) N.cfg.mapStyle = m.mapStyle;
      // indices : répartis sur la durée du refuge (20, 16, 12, 8, 4 pour 20 min)
      const r = N.cfg.refuge;
      N.cfg.clueAt = [0, 1, 2, 3, 4].map((i) => Math.max(1, Math.round(r - (r * i) / 5)));
    },

    center(E, c, m) {
      if (isFinite(+m.lat) && isFinite(+m.lng)) E.S.nuit.center = { lat: +m.lat, lng: +m.lng };
    },

    refugePt(E, c, m) {
      if (isFinite(+m.lat) && isFinite(+m.lng)) E.S.nuit.refugePt = { lat: +m.lat, lng: +m.lng };
    },

    escape(E, c, m) {
      const N = E.S.nuit;
      if (N.st !== 'idle') return;
      const e = m.escape;
      if (!e || !Array.isArray(e.enigmas) || e.enigmas.length !== 4) return;
      const code = String(e.code || '').replace(/\D/g, '').slice(0, 4);
      if (code.length !== 4) return;
      N.escape = {
        code,
        order: Array.isArray(e.order) && e.order.length === 4 ? e.order.map(String) : N.escape.order,
        ultimate: String(e.ultimate || '').slice(0, 600),
        enigmas: e.enigmas.map((x, i) => ({
          num: String(x.num || '').replace(/\D/g, '').slice(0, 6) || String(i + 1),
          room: String(x.room || '').slice(0, 30),
          sym: ['skull', 'moon', 'eye', 'flame'].includes(x.sym) ? x.sym : N.escape.order[i],
          q: String(x.q || '').slice(0, 800),
          answers: (Array.isArray(x.answers) ? x.answers : String(x.answers || '').split(/[,;\n]/)).map((a) => String(a).trim()).filter(Boolean).slice(0, 8),
          hint: String(x.hint || '').slice(0, 300),
        })),
      };
    },

    clues(E, c, m) {
      if (Array.isArray(m.clues) && m.clues.length === 5) E.S.nuit.clues = m.clues.map((x) => String(x || '').slice(0, 300));
    },

    intro(E) { E.S.screen = 'intro'; },

    start(E) {
      const N = E.S.nuit;
      if (N.st !== 'idle') return;
      const now = E.now();
      Object.assign(N, {
        st: 'evasion', startAt: now, endsAt: now + N.cfg.evasion * MIN, pausedAt: 0,
        found: {}, solved: {}, hints: {}, tries: 0, escapedAt: 0, timedOut: false, head: 0,
        powers: {}, status: {}, exo: {}, saved: {}, pos: {}, hpos: {}, sights: [], out: {}, lastOut: {},
        fx: nuit.init().fx, reads: {}, feed: [], results: null, sightN: 0, say: null, exoLog: [], revivedAll: false,
      });
      for (const p of E.list()) {
        const known = p.monster && MONSTERS.find((x) => x.name === p.monster.name);
        N.powers[p.id] = { id: known ? known.power : pick(CUSTOM_POWERS), used: false };
        N.status[p.id] = 'monstre';
      }
      E.S.screen = 'nuit';
      E.startRun('nuit');
      feed(E, 'La nuit commence. Les monstres se réveillent dans la maison.');
      E.overlay({ kind: 'night', title: 'Réveil', sub: 'Vous êtes enfermés. Trouvez les numéros cachés et tapez-les dans l’appli.', ms: 9000 });
      E.alertAll('Ton pouvoir vient de se révéler sur ta fiche.', 'ok');
    },

    next(E) {
      const N = E.S.nuit;
      if (N.st === 'evasion') escape(E, true);
      else if (N.st === 'alerte') toRefuge(E);
      else if (N.st === 'refuge') finish(E);
    },

    addTime(E, c, m) {
      const N = E.S.nuit;
      const d = Math.round(Number(m.min) || 0) * MIN;
      if (!d || !['evasion', 'alerte', 'refuge'].includes(N.st)) return;
      N.endsAt = Math.max(E.now() + 30 * SEC, N.endsAt + d);
    },

    pause(E) {
      const N = E.S.nuit;
      if (N.pausedAt || !['evasion', 'alerte', 'refuge'].includes(N.st)) return;
      N.pausedAt = E.now();
      E.overlay({ kind: 'mj', title: 'Pause', sub: 'Le temps est suspendu.', ms: 4000 });
    },

    resume(E) {
      const N = E.S.nuit;
      if (!N.pausedAt) return;
      const d = E.now() - N.pausedAt;
      for (const k of ['startAt', 'endsAt', 'huntAt', 'nextSight', 'refugeAt', 'alertAt']) if (N[k]) N[k] += d;
      N.pausedAt = 0;
    },

    hint(E) {
      const N = E.S.nuit;
      if (N.st !== 'evasion') return;
      const e = N.escape.enigmas.find((x) => N.found[x.num] && !N.solved[x.num] && !N.hints[x.num]);
      if (!e) return;
      N.hints[e.num] = { by: 'mj', at: E.now(), free: true };
      feed(E, `Le maître du jeu offre un coup de pouce sur l’énigme ${e.num}.`);
      E.overlay({ kind: 'clue', title: `Coup de pouce, énigme ${e.num}`, sub: e.hint, ms: 10000 });
    },

    say(E, c, m) {
      const N = E.S.nuit;
      const text = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 240);
      if (!text) return;
      N.say = { id: ++E.S.seq, t: E.now(), text };
      feed(E, `Message du maître du jeu : ${text}`);
      E.overlay({ kind: 'say', title: text, ms: 15000 });
      E.alertMany(E.ids(), `Le maître du jeu : ${text}`, 'info');
    },

    gps(E, c, m) {
      if (isFinite(+m.lat) && isFinite(+m.lng)) E.S.nuit.hpos.mj = { lat: +m.lat, lng: +m.lng, acc: Math.round(+m.acc || 0), t: E.now() };
    },

    exorcise(E, c, m) {
      const N = E.S.nuit;
      if (N.status[m.pid] === 'monstre') exorcise(E, m.pid, m.by || 'mj');
    },

    revive(E, c, m) {
      const N = E.S.nuit;
      if (!N.status[m.pid] || N.st === 'fin') return;
      for (const id of pairOf(E, m.pid)) { N.status[id] = 'monstre'; delete N.exo[id]; delete N.saved[id]; }
      feed(E, `Le maître du jeu ramène ${E.name(m.pid)} dans le camp des monstres.`);
    },

    save(E, c, m) {
      const N = E.S.nuit;
      if (N.status[m.pid] === 'monstre' && N.st === 'refuge') save(E, m.pid);
    },

    reset(E) {
      const N = E.S.nuit;
      const keep = { cfg: N.cfg, center: N.center, refugePt: N.refugePt, escape: N.escape, clues: N.clues };
      Object.assign(N, nuit.init(), keep);
      E.S.screen = 'lobby';
    },
  },

  act: {
    num(E, { pid }, m) {
      const N = E.S.nuit;
      if (N.st !== 'evasion' || N.pausedAt) return;
      const n = String(m.n || '').replace(/\D/g, '');
      const e = N.escape.enigmas.find((x) => x.num === n);
      if (!e) { E.alert(pid, 'Ce numéro ne correspond à rien.', 'bad'); return; }
      if (!N.found[n]) {
        N.found[n] = { pid, at: E.now() };
        feed(E, `${E.name(pid)} a trouvé l’énigme ${n}.`);
        E.alertMany(E.ids().filter((id) => id !== pid), `${E.name(pid)} a trouvé l’énigme ${n}.`, 'info', { open: n });
      }
      E.alert(pid, `Énigme ${n} ouverte.`, 'ok', { open: n });
    },

    answer(E, { pid }, m) {
      const N = E.S.nuit;
      if (N.st !== 'evasion' || N.pausedAt) return;
      const e = N.escape.enigmas.find((x) => x.num === String(m.num));
      if (!e || !N.found[e.num] || N.solved[e.num]) return;
      const a = norm(m.text);
      const words = a.split(' ');
      const ok = a && e.answers.some((x) => {
        const n = norm(x);
        return n === a || words.includes(n) || (n.length > 4 && a.includes(n));
      });
      if (!ok) { E.alert(pid, 'Mauvaise réponse.', 'bad'); return; }
      N.solved[e.num] = { pid, at: E.now() };
      const n = Object.keys(N.solved).length;
      feed(E, `${E.name(pid)} a résolu l’énigme ${e.num} : un chiffre du cadenas apparaît.`);
      E.overlay({ kind: 'clue', title: `Énigme ${e.num} résolue`, sub: `${E.name(pid)} a trouvé. ${n === 4 ? 'Les quatre chiffres sont réunis.' : `${n} chiffre${n > 1 ? 's' : ''} sur 4.`}`, ms: 6000 });
      E.alertMany(E.ids(), n === 4 ? 'Tous les indices sont réunis, une ultime réponse vous permettra de fuir.' : `Énigme ${e.num} résolue par ${E.name(pid)}.`, 'ok');
    },

    hint(E, { pid }, m) {
      const N = E.S.nuit;
      if (N.st !== 'evasion') return;
      const e = N.escape.enigmas.find((x) => x.num === String(m.num));
      if (!e || !N.found[e.num] || N.solved[e.num] || N.hints[e.num]) return;
      N.hints[e.num] = { by: pid, at: E.now() };
      feed(E, `${E.name(pid)} a demandé un coup de pouce sur l’énigme ${e.num}.`);
      E.alertMany(E.ids(), `Coup de pouce sur l’énigme ${e.num} : une minute d’avance en moins.`, 'info');
    },

    code(E, { pid }, m) {
      const N = E.S.nuit;
      if (N.st !== 'evasion' || N.pausedAt) return;
      if (Object.keys(N.solved).length < 4) return;
      const code = String(m.code || '').replace(/\D/g, '');
      if (code === N.escape.code) {
        feed(E, `${E.name(pid)} a trouvé le code du cadenas.`);
        escape(E, false);
      } else {
        N.tries += 1;
        E.alert(pid, 'Le cadenas résiste.', 'bad');
      }
    },

    gps(E, { pid }, m) {
      const N = E.S.nuit;
      const lat = Number(m.lat);
      const lng = Number(m.lng);
      if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90) return;
      if (!['alerte', 'refuge'].includes(N.st)) return;
      const now = E.now();
      const p = { lat, lng, acc: Math.round(Math.min(5000, Number(m.acc) || 0)), t: now };
      const st = N.status[pid];
      if (st === 'exorcise') { N.hpos[pid] = p; return; }
      if (st !== 'monstre') return;
      N.pos[pid] = p;
      // hors zone
      if (N.center) {
        const d = haversine(N.center, p) - Math.min(p.acc, 50);
        if (d > N.cfg.radius) {
          if (!N.out[pid]) {
            N.out[pid] = now;
            E.alert(pid, 'Tu es hors zone !', 'bad');
            E.mjAlert(`${E.full(pid)} est hors zone.`, 'warn');
          }
          const hidden = (N.fx.hide5[pid] || 0) > now;
          if (!hidden && now - (N.lastOut[pid] || 0) >= OUT_PING - 500 && now >= N.huntAt) {
            N.lastOut[pid] = now;
            pushSight(E, { pid, lat: p.lat, lng: p.lng, kind: 'horszone' });
          }
        } else if (N.out[pid]) {
          delete N.out[pid];
          E.alert(pid, 'Tu es revenu dans la zone.', 'ok');
        }
      }
      // arrivée au refuge
      if (N.st === 'refuge' && N.refugePt && haversine(N.refugePt, p) <= N.cfg.refugeR) save(E, pid);
    },

    caught(E, { pid }, m) {
      const N = E.S.nuit;
      if (!['alerte', 'refuge'].includes(N.st) || N.status[pid] !== 'monstre') return;
      const by = m.by === 'mj' || N.status[m.by] === 'exorcise' ? m.by : null;
      if (!by) return;
      const p = N.pos[pid];
      if (N.st === 'refuge' && N.refugePt && p && E.now() - p.t < 2 * MIN && haversine(N.refugePt, p) <= N.cfg.safeR) {
        E.alert(pid, 'Tu es à moins de 100 m du point de rassemblement : personne ne peut t’attraper ici.', 'ok');
        return;
      }
      const pw = N.powers[pid];
      if (pw && pw.id === 'immune' && !pw.used) {
        pw.used = true;
        feed(E, `${E.full(pid)} a été attrapé… mais il revient toujours.`);
        E.alert(pid, 'Il revient toujours : ta capture ne compte pas. Fuis !', 'ok');
        if (by !== 'mj') E.alert(by, `${E.name(pid)} s’est relevé : sa capture ne compte pas.`, 'bad');
        E.mjAlert(`${E.full(pid)} a utilisé « Il revient toujours ».`, 'info');
        return;
      }
      exorcise(E, pid, by);
    },

    power(E, { pid }, m) {
      const N = E.S.nuit;
      const pw = N.powers[pid];
      if (!pw || pw.used || N.status[pid] !== 'monstre' || !['alerte', 'refuge'].includes(N.st)) return;
      const now = E.now();
      const sp = E.speed || 1; // en démo accélérée, les effets durent de vraies secondes
      const id = pw.id;
      if (id === 'immune') return;
      if (id === 'revive') {
        const t = m.target;
        if (N.status[t] !== 'exorcise') return;
        N.status[t] = 'monstre';
        delete N.exo[t];
        feed(E, `Électrochoc ! ${E.name(t)} redevient un monstre.`);
        E.alert(t, `${E.name(pid)} t’a ramené parmi les monstres. Fuis !`, 'ok', { page: 'revive' });
        E.overlay({ kind: 'curse', title: 'Électrochoc', sub: `${E.name(t)} redevient un monstre.`, ms: 7000 });
      } else if (id === 'decoy' || id === 'fake' || id === 'hide' || id === 'swap') {
        N.fx[id][pid] = true;
      } else if (id === 'hide5') {
        N.fx.hide5[pid] = now + 5 * MIN * sp;
      } else if (id === 'blind') {
        N.fx.blindUntil = now + MIN * sp;
        E.alertMany(hunters(E).filter((h) => h !== 'mj'), 'Votre carte vient de devenir noire…', 'bad');
        E.mjAlert(`${E.full(pid)} a brouillé la carte des chasseurs pendant 1 min.`, 'warn');
      } else if (id === 'see') {
        N.fx.seeUntil[pid] = now + 30 * SEC * sp;
      } else if (id === 'delay') {
        N.nextSight += 2 * MIN;
      } else if (id === 'clue') {
        N.fx.early[pid] = true;
      }
      pw.used = true;
      pw.at = now;
      E.alert(pid, `${POWERS[id].name} : ${DONE[id] || 'pouvoir lancé.'}`, 'ok');
      E.mjAlert(`${E.full(pid)} utilise ${POWERS[id].name}.`, 'info');
    },

    read(E, { pid }, m) {
      const N = E.S.nuit;
      if (N.st !== 'refuge' || N.status[pid] !== 'monstre' && N.status[pid] !== 'sauve') return;
      const k = Math.round(Number(m.k));
      if (!(k >= 0 && k < 5)) return;
      const r = (N.reads[pid] ||= {});
      if (r[k]) return;
      if (!clueOpen(E, pid, k)) return;
      r[k] = E.now();
      if (N.fx.early[pid] && !unlocked(E, k)) delete N.fx.early[pid];
    },
  },

  tick(E) {
    const N = E.S.nuit;
    if (N.pausedAt) return;
    const now = E.now();
    if (N.st === 'evasion' && now >= N.endsAt) {
      escape(E, true);
      return;
    }
    if (N.st === 'alerte' || N.st === 'refuge') {
      if (now >= N.huntAt && now >= N.nextSight) {
        N.nextSight = now + N.cfg.every * MIN;
        sightAll(E);
      }
      if (N.st === 'alerte' && now >= N.endsAt) toRefuge(E);
      else if (N.st === 'refuge' && now >= N.endsAt) finish(E);
    }
  },

  pub(E) {
    const N = E.S.nuit;
    const v = base(E);
    if (N.st === 'evasion') Object.assign(v, escapeView(E));
    if (N.st === 'alerte' || N.st === 'refuge' || N.st === 'fin') {
      v.center = N.center;
      v.radius = N.cfg.radius;
      v.sights = hunterSights(E);
      v.exo = N.exo;
      v.saved = N.saved;
    }
    if (N.st === 'refuge') v.tiles = [0, 1, 2, 3, 4].map((k) => ({ k, open: unlocked(E, k), at: unlockAt(E, k) }));
    if (N.st === 'fin') v.results = N.results;
    v.feed = N.feed.slice(-6);
    return v;
  },

  player(E, pid) {
    const N = E.S.nuit;
    const v = base(E);
    const me = E.S.players[pid];
    v.status = N.status[pid] || null;
    if (N.st !== 'idle' && N.powers[pid]) {
      const pw = N.powers[pid];
      v.power = { id: pw.id, ...POWERS[pw.id], used: pw.used };
    }
    if (N.st === 'evasion') Object.assign(v, escapeView(E));
    if (N.st === 'alerte' || N.st === 'refuge') {
      v.center = N.center;
      v.radius = N.cfg.radius;
      v.out = !!N.out[pid];
      v.outSince = N.out[pid] || 0;
      v.outPings = Object.values(N.sights).filter((s) => s.pid === pid && s.kind === 'horszone' && s.t >= (N.out[pid] || 0)).length;
      v.hunters = huntersList(E);
      if (N.status[pid] === 'monstre' || N.status[pid] === 'sauve') {
        if ((N.fx.seeUntil[pid] || 0) > E.now()) { v.seeUntil = N.fx.seeUntil[pid]; v.hpos = N.hpos; }
        if (N.st === 'refuge') v.tiles = tiles(E, pid);
        v.exorcisable = E.ids().filter((id) => N.status[id] === 'exorcise');
      }
      if (N.status[pid] === 'exorcise') {
        v.sights = hunterSights(E);
        v.hpos = N.hpos;
        v.blindUntil = N.fx.blindUntil;
        v.mine = Object.entries(N.exo).filter(([, x]) => x.by === pid).map(([id, x]) => ({ id, at: x.at, after: x.at - N.alertAt }));
        v.exo = N.exo;
      }
      if (N.exo[pid]) v.exoBy = N.exo[pid];
      if (N.saved[pid]) v.savedAt = N.saved[pid];
    }
    if (N.st === 'fin') v.results = N.results;
    return v;
  },

  mjv(E) {
    const N = E.S.nuit;
    return {
      ...base(E), cfg: N.cfg, center: N.center, refugePt: N.refugePt, escape: N.escape, clues: N.clues,
      found: N.found, solved: N.solved, hints: N.hints, tries: N.tries, powers: N.powers, status: N.status,
      exo: N.exo, saved: N.saved, pos: N.pos, hpos: N.hpos, out: N.out, sights: hunterSights(E),
      blindUntil: N.fx.blindUntil, feed: N.feed.slice(-12), results: N.results, head: N.head,
      tiles: N.st === 'refuge' ? [0, 1, 2, 3, 4].map((k) => ({ k, open: unlocked(E, k), at: unlockAt(E, k) })) : null,
      mine: Object.entries(N.exo).map(([id, x]) => ({ id, by: x.by, at: x.at, after: x.at - N.alertAt })),
    };
  },
};

// ---------------------------------------------------------------------------

const DONE = {
  decoy: 'au prochain signalement, deux faux toi apparaîtront sur la carte des chasseurs.',
  fake: 'au prochain signalement, les chasseurs recevront une fausse position.',
  hide: 'tu seras absent du prochain signalement.',
  hide5: 'ta position est cachée aux chasseurs pendant 5 minutes.',
  blind: 'la carte des chasseurs est noire pendant 1 minute.',
  swap: 'au prochain signalement, ta position sera échangée avec celle d’un autre monstre.',
  see: 'tu vois les chasseurs sur ta carte pendant 30 secondes.',
  delay: 'le prochain signalement est retardé de 2 minutes.',
  revive: 'le monstre choisi est de retour.',
  clue: 'au refuge, tu pourras lire le prochain indice avant tout le monde.',
};

function base(E) {
  const N = E.S.nuit;
  return {
    st: N.st, endsAt: N.endsAt, startAt: N.startAt, huntAt: N.huntAt, nextSight: N.nextSight, refugeAt: N.refugeAt,
    alertAt: N.alertAt, paused: !!N.pausedAt, pausedAt: N.pausedAt || 0, revivedAll: !!N.revivedAll, mapStyle: N.cfg.mapStyle || 'nuit', say: N.say, every: N.cfg.every, durations: { evasion: N.cfg.evasion, alerte: N.cfg.alerte, refuge: N.cfg.refuge },
    head: N.head, escapedAt: N.escapedAt, timedOut: N.timedOut,
    count: { monstres: countSt(E, 'monstre'), exorcises: countSt(E, 'exorcise'), sauves: countSt(E, 'sauve') },
  };
}

function countSt(E, s) { return Object.values(E.S.nuit.status).filter((x) => x === s).length; }

function escapeView(E) {
  const N = E.S.nuit;
  const solved = Object.keys(N.solved).length;
  return {
    enigmas: N.escape.enigmas.map((e, i) => {
      const f = N.found[e.num];
      const s = N.solved[e.num];
      const o = { i, found: !!f };
      if (f) Object.assign(o, { num: e.num, room: e.room, q: e.q, by: f.pid });
      if (f && N.hints[e.num]) o.hint = e.hint;
      if (s) Object.assign(o, { solvedBy: s.pid, sym: e.sym, digit: digitFor(N, e) });
      return o;
    }),
    solved,
    ultimate: solved === 4 ? N.escape.ultimate : null,
    hintsUsed: Object.values(N.hints).filter((h) => !h.free).length,
    tries: N.tries,
    projectedHead: headStart(E, false),
  };
}

function digitFor(N, e) {
  const i = N.escape.order.indexOf(e.sym);
  return i >= 0 ? N.escape.code[i] : '?';
}

function headStart(E, timedOut) {
  const N = E.S.nuit;
  if (timedOut) return 1;
  const left = Math.max(0, N.endsAt - E.now());
  const hints = Object.values(N.hints).filter((h) => !h.free).length;
  return Math.max(1, Math.min(6, 3 + Math.floor(left / (5 * MIN))) - hints);
}

function feed(E, text) {
  const N = E.S.nuit;
  N.feed.push({ id: ++E.S.seq, t: E.now(), text });
  if (N.feed.length > 60) N.feed.splice(0, 20);
}

function escape(E, timedOut) {
  const N = E.S.nuit;
  if (N.st !== 'evasion') return;
  const now = E.now();
  N.head = headStart(E, timedOut);
  N.timedOut = timedOut;
  N.escapedAt = now;
  N.st = 'alerte';
  N.alertAt = now;
  N.endsAt = now + N.cfg.alerte * MIN;
  N.huntAt = now + N.head * MIN;
  N.nextSight = N.huntAt;
  const took = Math.round((now - N.startAt) / MIN);
  feed(E, timedOut ? `Le temps est écoulé. Le code du cadenas était ${N.escape.code}.` : `Évadés en ${took} min. L’alerte générale est déclenchée.`);
  E.overlay({
    kind: 'wanted',
    title: timedOut ? 'Le temps est écoulé' : 'Le cadenas a cédé',
    sub: timedOut ? `Le code était ${N.escape.code}. Prenez la clé et fuyez : le chasseur sort dans 1 minute.` : `Évadés en ${took} min. Fuyez : le chasseur sort dans ${N.head} minute${N.head > 1 ? 's' : ''}.`,
    ms: 10000,
  });
  E.alertAll(timedOut ? `Le temps est écoulé. Le code était ${N.escape.code}. Fuyez !` : 'Le cadenas a cédé. Fuyez !', 'bad');
}

function toRefuge(E) {
  const N = E.S.nuit;
  if (N.st !== 'alerte') return;
  const now = E.now();
  // si tout le monde a été exorcisé, le portail rappelle toutes les âmes : l'acte 3 se joue quand même
  const allCaught = !countSt(E, 'monstre') && E.ids().length > 0;
  if (allCaught) {
    for (const id of E.ids()) if (N.status[id] === 'exorcise') { N.status[id] = 'monstre'; delete N.exo[id]; }
    N.revivedAll = true;
  }
  N.st = 'refuge';
  N.refugeAt = now;
  N.endsAt = now + N.cfg.refuge * MIN;
  if (N.huntAt > now) N.huntAt = now;
  if (allCaught) {
    feed(E, 'Tous les monstres ont été exorcisés… mais le portail rappelle toutes les âmes. Course au refuge pour tout le monde.');
    E.overlay({ kind: 'curse', title: 'Le portail vous rappelle', sub: 'Tous les monstres ont été exorcisés, mais le dernier portail réveille chaque âme. Rejoignez le point de rassemblement avant le dernier départ.', ms: 11000 });
    for (const id of E.ids()) E.alert(id, 'Le portail te rappelle : tu redeviens un monstre. Rejoins le point de rassemblement !', 'ok', { page: 'refuge' });
    return;
  }
  feed(E, 'Fin de l’alerte générale. Les monstres cherchent le point de rassemblement.');
  E.overlay({ kind: 'clue', title: 'Fin de l’alerte', sub: 'Les monstres encore libres doivent rejoindre le point de rassemblement avant le dernier départ.', ms: 9000 });
  for (const id of E.ids()) {
    if (N.status[id] === 'monstre') E.alert(id, 'Bravo, les chasseurs ont abandonné le secteur. Rejoins le point de rassemblement.', 'ok', { page: 'refuge' });
    else E.alert(id, 'Les monstres cherchent leur point de rassemblement. Continuez la traque.', 'info');
  }
}

function finish(E) {
  const N = E.S.nuit;
  if (N.st === 'fin' || N.st === 'idle') return;
  N.st = 'fin';
  const now = E.now();
  const lost = E.ids().filter((id) => N.status[id] === 'monstre');
  N.results = {
    at: now,
    saved: Object.entries(N.saved).sort((a, b) => a[1] - b[1]).map(([id, at]) => ({ id, at })),
    exo: Object.entries(N.exo).sort((a, b) => a[1].at - b[1].at).map(([id, x]) => ({ id, by: x.by, at: x.at })),
    lost,
    hunters: countBy((N.exoLog || []).map((x) => x.by)),
    captures: (N.exoLog || []).length,
  };
  N.results.allCaught = !N.results.saved.length && !lost.length;
  feed(E, N.results.allCaught ? 'Tous les monstres ont été exorcisés : les chasseurs gagnent.' : 'Le dernier départ pour l’Hôtel Transylvanie a eu lieu.');
  E.overlay({
    kind: 'reveal',
    title: N.results.allCaught ? 'Victoire des chasseurs' : 'Fin de la nuit',
    sub: `${N.results.saved.length} monstre${N.results.saved.length > 1 ? 's' : ''} sauvé${N.results.saved.length > 1 ? 's' : ''}, ${N.results.exo.length} exorcisé${N.results.exo.length > 1 ? 's' : ''}.`,
    ms: 10000,
  });
  E.alertAll('La partie est terminée. Kebab time !', 'ok');
}

function countBy(arr) {
  const o = {};
  for (const x of arr) o[x] = (o[x] || 0) + 1;
  return o;
}

// chacun pour soi : on ne capture ou ne sauve qu'une personne à la fois
function pairOf(E, pid) {
  return [pid];
}

function pairNames(E, pid) {
  return pairOf(E, pid).map((id) => E.name(id)).join(' et ');
}

function hunters(E) {
  const N = E.S.nuit;
  return ['mj', ...E.ids().filter((id) => N.status[id] === 'exorcise')];
}

function huntersList(E) {
  const N = E.S.nuit;
  return hunters(E).map((id) => {
    if (id === 'mj') return { id, name: E.full('mj'), role: 'Le chasseur' };
    const p = E.S.players[id];
    const m = p.monster ? p.monster.name : 'monstre';
    return { id, name: E.full(id), role: `Exorcisé, ancien ${m}` };
  });
}

function exorcise(E, pid, by) {
  const N = E.S.nuit;
  const now = E.now();
  const pair = pairOf(E, pid).filter((id) => N.status[id] === 'monstre');
  for (const id of pair) {
    N.status[id] = 'exorcise';
    N.exo[id] = { by, at: now };
    (N.exoLog ||= []).push({ id, by, at: now });
    delete N.out[id];
  }
  const who = pair.map((id) => E.name(id)).join(' et ');
  const byName = E.full(by);
  feed(E, `${who} ${pair.length > 1 ? 'ont été exorcisés' : 'a été exorcisé'} par ${byName}.`);
  E.overlay({ kind: 'death', title: 'Exorcisme', sub: `${who} ${pair.length > 1 ? 'redeviennent humains' : 'redevient humain'}, attrapé${pair.length > 1 ? 's' : ''} par ${byName}.`, pid, ms: 7000 });
  for (const id of E.ids()) {
    if (pair.includes(id)) continue;
    E.alert(id, `Exorcisme : ${who}, par ${byName}.`, N.status[id] === 'monstre' ? 'bad' : 'ok');
  }
  for (const id of pair) E.alert(id, 'Tu as été exorcisé. Tu chasses désormais les monstres.', 'bad', { page: 'exorcise' });
  E.mjAlert(`Exorcisme : ${who}, par ${byName}.`, 'info');
  if (!countSt(E, 'monstre')) {
    if (N.st === 'alerte') toRefuge(E);
    else finish(E);
  }
}

function save(E, pid) {
  const N = E.S.nuit;
  const now = E.now();
  const pair = pairOf(E, pid).filter((id) => N.status[id] === 'monstre');
  if (!pair.length) return;
  for (const id of pair) { N.status[id] = 'sauve'; N.saved[id] = now; delete N.out[id]; }
  const who = pair.map((id) => E.name(id)).join(' et ');
  feed(E, `${who} ${pair.length > 1 ? 'ont rejoint' : 'a rejoint'} le point de rassemblement.`);
  E.overlay({ kind: 'win', title: 'Un portail s’ouvre', sub: `${who} ${pair.length > 1 ? 'partent' : 'part'} pour l’Hôtel Transylvanie.`, pid, ms: 7000 });
  for (const id of pair) E.alert(id, 'Tu as passé le portail !', 'ok', { page: 'portail' });
  for (const id of E.ids()) if (!pair.includes(id)) E.alert(id, `${who} ${pair.length > 1 ? 'ont passé' : 'a passé'} le portail.`, 'info');
  E.mjAlert(`${who} sauvé${pair.length > 1 ? 's' : ''}.`, 'info');
  if (!countSt(E, 'monstre')) finish(E);
}

function pushSight(E, s) {
  const N = E.S.nuit;
  N.sights.push({ id: ++E.S.seq, t: E.now(), batch: N.sightN, ...s });
  if (N.sights.length > 300) N.sights.splice(0, 100);
}

function sightAll(E) {
  const N = E.S.nuit;
  const now = E.now();
  N.sightN += 1;
  const monsters = E.ids().filter((id) => N.status[id] === 'monstre' && N.pos[id]);
  const swaps = {};
  for (const id of monsters) {
    if (N.fx.swap[id]) {
      const other = pick(monsters.filter((x) => x !== id) || []);
      if (other) { swaps[id] = N.pos[other]; swaps[other] = N.pos[id]; }
      delete N.fx.swap[id];
    }
  }
  for (const id of monsters) {
    if ((N.fx.hide5[id] || 0) > now) continue;
    if (N.fx.hide[id]) { delete N.fx.hide[id]; continue; }
    let p = swaps[id] || N.pos[id];
    if (N.fx.fake[id] && N.center) {
      p = jitter(N.center, N.cfg.radius * 0.8);
      delete N.fx.fake[id];
    }
    pushSight(E, { pid: id, lat: p.lat, lng: p.lng, kind: 'auto', stale: now - N.pos[id].t > 2 * MIN });
    if (N.fx.decoy[id]) {
      for (let i = 0; i < 2; i++) {
        const q = jitter(p, 350);
        pushSight(E, { pid: id, lat: q.lat, lng: q.lng, kind: 'auto' });
      }
      delete N.fx.decoy[id];
    }
  }
  for (const h of hunters(E)) if (h !== 'mj') E.alert(h, 'Nouveau signalement : positions des monstres reçues.', 'info');
  for (const id of E.ids()) if (N.status[id] === 'monstre') E.alert(id, 'Les chasseurs viennent de recevoir ta position.', 'bad');
  E.mjAlert('Nouveau signalement envoyé aux chasseurs.', 'info');
}

// ce que voient les chasseurs : dernier signalement + positions hors zone récentes
function hunterSights(E) {
  const N = E.S.nuit;
  const now = E.now();
  const last = N.sights.filter((s) => s.kind === 'auto' && s.batch === N.sightN && N.status[s.pid] === 'monstre');
  const out = {};
  for (const s of N.sights) if (s.kind === 'horszone' && now - s.t < MIN && N.status[s.pid] === 'monstre') out[s.pid] = s;
  return [...last, ...Object.values(out)];
}

function unlockAt(E, k) {
  const N = E.S.nuit;
  const at = N.cfg.clueAt[k] ?? 0;
  return N.refugeAt + Math.max(0, N.cfg.refuge - at) * MIN;
}

function unlocked(E, k) { return E.S.nuit.st === 'refuge' && E.now() >= unlockAt(E, k); }

function clueOpen(E, pid, k) {
  const N = E.S.nuit;
  if (unlocked(E, k)) return true;
  if (N.fx.early[pid]) {
    const next = [0, 1, 2, 3, 4].find((i) => !unlocked(E, i));
    return next === k;
  }
  return false;
}

function tiles(E, pid) {
  const N = E.S.nuit;
  const now = E.now();
  const r = N.reads[pid] || {};
  const rs = N.cfg.readSecs * SEC * (E.speed || 1); // en démo accélérée, on garde 15 vraies secondes
  return [0, 1, 2, 3, 4].map((k) => {
    const t = { k, at: unlockAt(E, k) };
    if (r[k]) {
      const left = r[k] + rs - now;
      if (left > 0) Object.assign(t, { state: 'reading', text: N.clues[k], until: r[k] + rs });
      else t.state = 'burnt';
    } else if (clueOpen(E, pid, k)) t.state = 'open';
    else t.state = 'locked';
    return t;
  });
}
