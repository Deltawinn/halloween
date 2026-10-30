// Moteur : tourne sur l'écran TV (l'hôte). Il détient tout l'état, applique les
// actions des joueurs et du MJ, et calcule ce que chacun a le droit de voir.
import { core } from './core.js';
import { nuit } from './nuit.js';
import { manoir } from './manoir.js';

export const GAMES = { core, nuit, manoir };
const ONLINE_MS = 50000;

export function freshState(name) {
  const S = {
    v: 2,
    name: name || 'Le dernier portail',
    created: Date.now(),
    seq: 0,
    players: {},
    order: [],
    scores: {},
    ledger: [],
    screen: 'lobby',
    ovQueue: [],
    ovCur: null,
    alerts: {},
    mjAlerts: [],
    runs: {},
    runCount: {},
    gains: {},
    photos: {},
    acks: {},
    mj: { first: 'Andy', last: 'Mercier', pos: null },
  };
  for (const [k, g] of Object.entries(GAMES)) if (g.init) S[k] = g.init();
  return S;
}

export class Engine {
  constructor(S) {
    this.S = S;
    this.clock = null; // horloge accélérée en mode démo
  }

  now() { return this.clock ? this.clock() : Date.now(); }

  // ---------- joueurs ----------
  list() { return this.S.order.map((id) => this.S.players[id]).filter((p) => p && !p.gone); }
  ids() { return this.list().map((p) => p.id); }
  name(pid) {
    if (pid === 'mj') return `${this.S.mj.first} ${this.S.mj.last}`.trim();
    const p = this.S.players[pid];
    return p ? p.name : '?';
  }
  full(pid) {
    if (pid === 'mj') return this.name('mj');
    const p = this.S.players[pid];
    return p ? `${p.name}${p.last ? ' ' + p.last : ''}` : '?';
  }
  online(pid) { const p = this.S.players[pid]; return !!p && Date.now() - (p.seen || 0) < ONLINE_MS; }
  score(pid) { return this.S.scores[pid] || 0; }

  addPlayer({ pid, pub, name, emoji }) {
    const S = this.S;
    const n = String(name || 'Joueur').trim().slice(0, 18) || 'Joueur';
    S.players[pid] = { id: pid, pub, name: n, last: '', emoji: emoji || '', joined: this.now(), seen: Date.now(), profile: null, monster: null, avatar: null, want: null, bound: null };
    S.order.push(pid);
    S.scores[pid] = 0;
    this.mjAlert(`${n} est entré.`, 'info');
    return S.players[pid];
  }

  // ---------- points (loup-garou) ----------
  award(pid, delta, reason, game) {
    if (!this.S.players[pid] || !delta) return;
    this.S.scores[pid] = (this.S.scores[pid] || 0) + delta;
    this.S.ledger.push({ t: this.now(), pid, d: delta, r: reason, g: game || null });
    if (this.S.ledger.length > 400) this.S.ledger.splice(0, 100);
  }

  startRun(game) {
    const S = this.S;
    S.runCount[game] = (S.runCount[game] || 0) + 1;
    S.runs[game] = game + '-' + S.runCount[game];
  }

  finishRun() {}

  putMedia(id, data) { if (this.onMedia) this.onMedia(id, data); }

  // ---------- notifications ----------
  alert(pid, text, kind = 'info', extra) {
    const list = (this.S.alerts[pid] ||= []);
    list.push({ id: ++this.S.seq, text, kind, t: this.now(), ...(extra || {}) });
    if (list.length > 6) list.shift();
  }

  alertMany(pids, text, kind, extra) { for (const p of pids) this.alert(p, text, kind, extra); }

  alertAll(text, kind, extra) {
    this.alertMany(this.ids(), text, kind, extra);
    this.mjAlert(text, kind === 'bad' ? 'warn' : 'info');
  }

  mjAlert(text, kind = 'info', data) {
    this.S.mjAlerts.push({ id: ++this.S.seq, text, kind, t: this.now(), data: data || null });
    if (this.S.mjAlerts.length > 40) this.S.mjAlerts.shift();
  }

  overlay(o) {
    this.S.ovQueue.push({ id: ++this.S.seq, ms: 7000, ...o });
    if (this.S.ovQueue.length > 10) this.S.ovQueue.shift();
    this.tickOverlay();
  }

  tickOverlay() {
    const S = this.S;
    const now = Date.now();
    if (S.ovCur && now < S.ovCur.until) return;
    const next = S.ovQueue.shift();
    S.ovCur = next ? { ...next, until: now + next.ms } : null;
  }

  // ---------- actions ----------
  handle(ctx, msg) {
    if (!msg || typeof msg !== 'object') return;
    const game = GAMES[msg.g || 'core'];
    if (!game) return;
    const table = ctx.mj ? game.mj : game.act;
    const fn = table && table[msg.a];
    if (!fn) return;
    if (ctx.pid) {
      if (!this.S.players[ctx.pid] || this.S.players[ctx.pid].gone) return;
      this.S.players[ctx.pid].seen = Date.now();
    }
    // accusé de réception : une action renvoyée n'est appliquée qu'une fois
    if (msg.n) {
      const acks = ((this.S.acks ||= {})[ctx.mj ? 'mj' : ctx.pid] ||= []);
      if (acks.includes(msg.n)) return;
      acks.push(msg.n);
      if (acks.length > 40) acks.shift();
    }
    try {
      fn(this, ctx, msg);
    } catch (e) {
      console.error('action', msg, e);
    }
  }

  tick() {
    this.tickOverlay();
    for (const g of Object.values(GAMES)) {
      if (g.tick) {
        try { g.tick(this); } catch (e) { console.error('tick', e); }
      }
    }
  }

  // ---------- vues ----------
  people() {
    return this.list().map((p) => ({
      id: p.id, name: p.name, last: p.last, av: p.avatar, mon: p.monster ? p.monster.name : null, on: this.online(p.id), bound: p.bound,
    }));
  }

  board() {
    const rows = this.list().map((p) => ({ id: p.id, name: p.name, score: this.score(p.id) }));
    rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return rows;
  }

  publicView(hostPub) {
    const S = this.S;
    const v = {
      name: S.name, hostPub, screen: S.screen, players: this.people(), ov: S.ovCur,
      mjName: this.name('mj'), speed: this.speed || 1,
    };
    for (const [k, g] of Object.entries(GAMES)) if (g.pub) v[k] = g.pub(this);
    return v;
  }

  playerView(pid) {
    const S = this.S;
    const p = S.players[pid];
    if (!p) return null;
    const v = {
      me: {
        id: pid, name: p.name, last: p.last, av: p.avatar, monster: p.monster, want: p.want, bound: p.bound,
        gone: !!p.gone, wantedBy: this.list().filter((o) => o.want === pid && o.id !== pid).map((o) => o.id),
      },
      alerts: S.alerts[pid] || [],
      acks: (S.acks && S.acks[pid]) || [],
    };
    for (const [k, g] of Object.entries(GAMES)) if (g.player) v[k] = g.player(this, pid);
    return v;
  }

  mjView() {
    const S = this.S;
    const v = {
      name: S.name, screen: S.screen, mj: S.mj,
      players: this.list().map((p) => ({ ...this.people().find((x) => x.id === p.id), seen: p.seen, want: p.want, monster: p.monster })),
      alerts: S.mjAlerts.slice(-25), ov: S.ovCur, queue: S.ovQueue.length, speed: this.speed || 1, demo: !!this.demo,
      acks: (S.acks && S.acks.mj) || [],
    };
    for (const [k, g] of Object.entries(GAMES)) if (g.mjv) v[k] = g.mjv(this);
    return v;
  }
}

export { shuffle, pick } from './util.js';
