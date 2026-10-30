// Le Manoir : loup-garou version vampires, rôles secrets sur les téléphones.
import { ROLES } from '../data.js';
import { shuffle, pick } from './util.js';

const PTS_VILLAGE = 15;
const PTS_VAMP = 25;
const PTS_ALIVE = 5;

function rolesFor(n) {
  const vamp = n >= 12 ? 3 : n >= 7 ? 2 : 1;
  const list = [];
  for (let i = 0; i < vamp; i++) list.push('vampire');
  list.push('medium');
  if (n >= 6) list.push('sorciere');
  if (n >= 7) list.push('chasseur');
  while (list.length < n) list.push('villageois');
  return list.slice(0, n);
}

export const manoir = {
  key: 'manoir',

  init: () => ({
    st: 'idle', // idle | roles | night | day | vote | voted | hunter | over
    parts: [],
    roles: {},
    alive: {},
    night: 0,
    step: null, // vampires | medium | witch | ready
    vv: {},
    victim: null,
    medium: { pick: null },
    witch: { life: true, death: true, save: false, kill: null, done: false },
    sus: {},
    susTop: null,
    lastDeaths: [],
    votes: {},
    voteRes: null,
    hunter: null,
    afterHunter: null,
    winner: null,
    log: [],
  }),

  mj: {
    deal(E, c, m) {
      const M = E.S.manoir;
      const parts = (Array.isArray(m.parts) && m.parts.length ? m.parts : E.ids())
        .filter((id) => E.S.players[id]);
      if (parts.length < 4) { E.mjAlert('Il faut au moins 4 joueurs pour Le Manoir.', 'warn'); return; }
      Object.assign(M, manoir.init());
      M.parts = parts;
      const roles = shuffle(rolesFor(parts.length));
      parts.forEach((id, i) => { M.roles[id] = roles[i]; M.alive[id] = true; });
      M.st = 'roles';
      E.startRun('manoir');
      E.S.screen = 'manoir';
      E.alertMany(parts, 'Ton rôle secret t’attend. Ne le montre à personne.', 'info');
    },

    night(E) {
      const M = E.S.manoir;
      if (!['roles', 'day', 'voted'].includes(M.st)) return;
      M.st = 'night';
      M.night += 1;
      M.vv = {};
      M.victim = null;
      M.medium = { pick: null };
      M.witch = { ...M.witch, save: false, kill: null, done: false };
      M.sus = {};
      M.step = 'vampires';
      M.voteRes = null;
      E.overlay({ kind: 'night', title: `Nuit ${M.night}`, sub: 'Le manoir s’endort. Les vampires se réveillent…', ms: 5000 });
    },

    step(E) { if (E.S.manoir.st === 'night') advance(E, true); },

    dawn(E) { if (E.S.manoir.st === 'night') dawn(E); },

    vote(E) {
      const M = E.S.manoir;
      if (M.st !== 'day' && M.st !== 'voted') return;
      M.st = 'vote';
      M.votes = {};
      M.voteRes = null;
    },

    count(E) { if (E.S.manoir.st === 'vote') countVotes(E); },

    kill(E, c, m) {
      const M = E.S.manoir;
      if (!M.alive[m.pid]) return;
      die(E, [{ pid: m.pid, cause: 'mj' }], M.st);
    },

    stop(E) {
      const M = E.S.manoir;
      if (M.st === 'idle' || M.st === 'over') return;
      M.st = 'over';
      M.winner = null;
      E.finishRun('manoir');
    },

    reset(E) { Object.assign(E.S.manoir, manoir.init()); },
  },

  act: {
    vamp(E, { pid }, m) {
      const M = E.S.manoir;
      if (M.st !== 'night' || M.step !== 'vampires') return;
      if (M.roles[pid] !== 'vampire' || !M.alive[pid]) return;
      if (!M.alive[m.t] || M.roles[m.t] === 'vampire') return;
      M.vv[pid] = m.t;
      const vamps = aliveWith(M, 'vampire');
      const choices = vamps.map((v) => M.vv[v]);
      if (choices.every((x) => x && x === choices[0])) advance(E, false);
    },

    medium(E, { pid }, m) {
      const M = E.S.manoir;
      if (M.st !== 'night' || M.step !== 'medium') return;
      if (M.roles[pid] !== 'medium' || !M.alive[pid] || M.medium.pick) return;
      if (!M.alive[m.t] || m.t === pid) return;
      M.medium.pick = m.t;
      M.medium.seen = M.roles[m.t];
      M.log.push({ n: M.night, txt: `Le médium a sondé ${E.name(m.t)} (${ROLES[M.roles[m.t]].name}).` });
    },

    mediumOk(E, { pid }) {
      const M = E.S.manoir;
      if (M.st === 'night' && M.step === 'medium' && M.roles[pid] === 'medium' && M.medium.pick) advance(E, false);
    },

    witch(E, { pid }, m) {
      const M = E.S.manoir;
      if (M.st !== 'night' || M.step !== 'witch') return;
      if (M.roles[pid] !== 'sorciere' || !M.alive[pid] || M.witch.done) return;
      if (m.save && M.witch.life && M.victim) { M.witch.save = true; M.witch.life = false; }
      if (m.kill && M.witch.death && M.alive[m.kill] && m.kill !== pid) { M.witch.kill = m.kill; M.witch.death = false; }
      M.witch.done = true;
      advance(E, false);
    },

    sus(E, { pid }, m) {
      const M = E.S.manoir;
      if (M.st !== 'night' || !M.alive[pid] || !M.alive[m.t] || m.t === pid) return;
      M.sus[pid] = m.t;
    },

    vote(E, { pid }, m) {
      const M = E.S.manoir;
      if (M.st !== 'vote' || !M.alive[pid] || !M.alive[m.t]) return;
      M.votes[pid] = m.t;
      const voters = M.parts.filter((id) => M.alive[id]);
      if (voters.every((id) => M.votes[id])) countVotes(E);
    },

    shoot(E, { pid }, m) {
      const M = E.S.manoir;
      if (M.st !== 'hunter' || M.hunter !== pid || !M.alive[m.t]) return;
      M.hunter = null;
      const back = M.afterHunter || 'day';
      M.st = back;
      die(E, [{ pid: m.t, cause: 'chasseur' }], back);
    },
  },

  pub(E) {
    const M = E.S.manoir;
    const v = {
      st: M.st, night: M.night, step: M.st === 'night' ? M.step : null, winner: M.winner,
      people: M.parts.map((id) => ({ id, alive: !!M.alive[id], role: M.alive[id] && M.st !== 'over' ? null : M.roles[id] })),
      lastDeaths: M.lastDeaths,
      susTop: M.st === 'day' ? M.susTop : null,
      voted: M.st === 'vote' ? Object.keys(M.votes) : [],
      voteRes: M.voteRes,
      hunter: M.hunter,
    };
    return v;
  },

  player(E, pid) {
    const M = E.S.manoir;
    if (!M.parts.includes(pid)) return { st: M.st, in: false };
    const role = M.roles[pid];
    const v = {
      st: M.st, in: true, role, alive: !!M.alive[pid], night: M.night, step: M.st === 'night' ? M.step : null,
      targets: M.parts.filter((id) => M.alive[id] && id !== pid),
      mySus: M.sus[pid] || null, myVote: M.votes[pid] || null, winner: M.winner,
      hunter: M.st === 'hunter' && M.hunter === pid,
    };
    if (role === 'vampire') {
      v.mates = M.parts.filter((id) => M.roles[id] === 'vampire' && id !== pid);
      if (M.st === 'night' && M.step === 'vampires') v.vv = M.vv;
    }
    if (role === 'medium' && M.st === 'night' && M.step === 'medium') {
      v.medium = { pick: M.medium.pick, seen: M.medium.seen || null };
    }
    if (role === 'sorciere') {
      v.witch = { life: M.witch.life, death: M.witch.death };
      if (M.st === 'night' && M.step === 'witch') { v.witch.victim = M.victim; v.witch.turn = !M.witch.done; }
    }
    if (M.st === 'over') v.roles = M.roles;
    return v;
  },

  mjv(E) {
    const M = E.S.manoir;
    return {
      st: M.st, night: M.night, step: M.step, parts: M.parts, roles: M.roles, alive: M.alive, vv: M.vv, victim: M.victim,
      medium: M.medium, witch: M.witch, votes: M.votes, voteRes: M.voteRes, hunter: M.hunter, winner: M.winner,
      log: M.log.slice(-12), lastDeaths: M.lastDeaths,
    };
  },
};

function aliveWith(M, role) { return M.parts.filter((id) => M.alive[id] && M.roles[id] === role); }

function advance(E, forced) {
  const M = E.S.manoir;
  if (M.step === 'vampires') {
    const counts = {};
    for (const v of aliveWith(M, 'vampire')) if (M.vv[v]) counts[M.vv[v]] = (counts[M.vv[v]] || 0) + 1;
    const max = Math.max(0, ...Object.values(counts));
    const top = Object.keys(counts).filter((k) => counts[k] === max);
    M.victim = top.length ? pick(top) : null;
    if (M.victim) M.log.push({ n: M.night, txt: `Les vampires ont choisi ${E.name(M.victim)}.` });
    M.step = 'medium';
    if (!aliveWith(M, 'medium').length) return advance(E, forced);
    return;
  }
  if (M.step === 'medium') {
    M.step = 'witch';
    if (!aliveWith(M, 'sorciere').length || (!M.witch.life && !M.witch.death)) return advance(E, forced);
    return;
  }
  if (M.step === 'witch') {
    M.step = 'ready';
  }
}

function dawn(E) {
  const M = E.S.manoir;
  const deaths = [];
  if (M.victim && !M.witch.save) deaths.push({ pid: M.victim, cause: 'vampires' });
  if (M.witch.save && M.victim) M.log.push({ n: M.night, txt: `La sorcière a sauvé ${E.name(M.victim)}.` });
  if (M.witch.kill && M.witch.kill !== M.victim) deaths.push({ pid: M.witch.kill, cause: 'sorciere' });
  else if (M.witch.kill && M.witch.kill === M.victim && M.witch.save) deaths.push({ pid: M.witch.kill, cause: 'sorciere' });
  // indice de soupçons : qui a été le plus désigné pendant la nuit
  const counts = {};
  for (const t of Object.values(M.sus)) counts[t] = (counts[t] || 0) + 1;
  const max = Math.max(0, ...Object.values(counts));
  M.susTop = max >= 2 ? Object.keys(counts).find((k) => counts[k] === max) : null;
  M.st = 'day';
  M.step = null;
  M.lastDeaths = [];
  if (!deaths.length) {
    E.overlay({ kind: 'dawn', title: 'Le jour se lève', sub: 'Personne n’est mort cette nuit.', ms: 6000 });
  }
  die(E, deaths, 'day');
}

function die(E, list, back) {
  const M = E.S.manoir;
  let hunterDied = null;
  for (const d of list) {
    if (!M.alive[d.pid]) continue;
    M.alive[d.pid] = false;
    M.lastDeaths.push({ id: d.pid, role: M.roles[d.pid], cause: d.cause });
    const role = ROLES[M.roles[d.pid]];
    const n = E.name(d.pid);
    const title = {
      vampires: `Les vampires ont saigné ${n}`, sorciere: `${n} a bu le poison de la sorcière`, vote: `Le manoir bannit ${n}`,
      chasseur: `Le chasseur emporte ${n}`, mj: `${n} quitte la partie`,
    }[d.cause] || `${n} n’est plus`;
    E.overlay({ kind: 'death', title, sub: `Son rôle : ${role.name}.`, pid: d.pid, ms: 6500 });
    E.alert(d.pid, 'Tu es mort. Les morts ne parlent plus : observe en silence jusqu’à la fin de la partie.', 'bad');
    M.log.push({ n: M.night, txt: `${title} (${role.name}).` });
    if (M.roles[d.pid] === 'chasseur') hunterDied = d.pid;
  }
  if (checkWin(E)) return;
  if (hunterDied) {
    M.hunter = hunterDied;
    M.afterHunter = back;
    M.st = 'hunter';
    E.alert(hunterDied, 'Chasseur : choisis qui tu emportes avec toi.', 'info');
  }
}

function countVotes(E) {
  const M = E.S.manoir;
  const counts = {};
  for (const t of Object.values(M.votes)) counts[t] = (counts[t] || 0) + 1;
  const max = Math.max(0, ...Object.values(counts));
  const top = Object.keys(counts).filter((k) => counts[k] === max);
  const out = top.length === 1 ? top[0] : null;
  M.voteRes = { counts, out, tie: top.length > 1, votes: { ...M.votes } };
  M.st = 'voted';
  M.lastDeaths = [];
  if (out) die(E, [{ pid: out, cause: 'vote' }], 'voted');
  else E.overlay({ kind: 'dawn', title: 'Égalité', sub: 'Le manoir n’a pas su trancher. Personne ne part.', ms: 5500 });
}

function checkWin(E) {
  const M = E.S.manoir;
  const vamps = aliveWith(M, 'vampire').length;
  const others = M.parts.filter((id) => M.alive[id] && M.roles[id] !== 'vampire').length;
  let winner = null;
  if (vamps === 0) winner = 'village';
  else if (vamps >= others) winner = 'vampires';
  if (!winner) return false;
  M.winner = winner;
  M.st = 'over';
  M.hunter = null;
  for (const id of M.parts) {
    const team = ROLES[M.roles[id]].team;
    if (team !== winner) continue;
    E.award(id, winner === 'village' ? PTS_VILLAGE : PTS_VAMP, 'Le Manoir : victoire', 'manoir');
    if (M.alive[id]) E.award(id, PTS_ALIVE, 'Le Manoir : survivant', 'manoir');
  }
  E.overlay({
    kind: 'win',
    title: winner === 'village' ? 'Le manoir est sauvé' : 'Les vampires règnent sur le manoir',
    sub: winner === 'village' ? 'Tous les vampires ont été démasqués.' : 'Il ne reste plus assez d’innocents pour leur résister.',
    ms: 9000,
  });
  E.finishRun('manoir');
  return true;
}
