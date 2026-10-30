// L'hôte : tourne sur l'écran TV. Relie le moteur au relais chiffré.
// En mode démo, il tourne sans relais, avec des monstres virtuels et une horloge accélérée.
import { Engine, freshState } from './engine.js';
import { Bots } from './demo.js';
import { Link, keyFromSecret, seal, unseal, newKeyPair, sharedKey, roomTopic, randomId, brokerUrl, store } from '../net.js';

const KEYS = { real: 'hw.host', demo: 'hw.demo' };

export function appUrl() {
  return location.origin + location.pathname + location.search;
}

export function brokerParam(b) {
  return /^\d+$/.test(String(b)) ? String(b) : encodeURIComponent(b);
}

export class Host {
  static saved(demo = false) {
    const d = store.get(KEYS[demo ? 'demo' : 'real']);
    return d && d.S && d.room ? d : null;
  }

  static forget(demo = false) {
    const key = KEYS[demo ? 'demo' : 'real'];
    const d = store.get(key);
    if (d && d.S) for (const id of Object.keys(d.S.photos || {})) store.del('hw.media.' + id);
    store.del(key);
    if (demo) store.del('hw.demo.id');
  }

  static async create(name, broker, { demo = false } = {}) {
    Host.forget(demo);
    const data = {
      room: randomId(12), admin: randomId(12), broker: broker ?? 0, keys: await newKeyPair(), S: freshState(name),
      demo, clk: demo ? { g: Date.now(), r: Date.now(), s: 1 } : null, bots: demo ? { n: 0, gps: true } : null,
    };
    store.set(KEYS[demo ? 'demo' : 'real'], data);
    return new Host(data);
  }

  constructor(data) {
    this.d = data;
    this.demo = !!data.demo;
    this.E = new Engine(data.S);
    this.E.onMedia = (id, d) => this.putMedia(id, d);
    this.listeners = new Set();
    this.media = {};
    this.pkeys = {};
    this.lastSent = {};
    this.status = this.demo ? 'local' : 'connexion';
    this.pubView = null;
    if (this.demo) {
      this.E.demo = true;
      this.applyClock();
      this.bots = new Bots(this);
    }
  }

  // ---------- horloge de démo ----------
  applyClock() {
    const c = this.d.clk;
    this.E.speed = c.s;
    this.E.clock = () => c.g + (Date.now() - c.r) * c.s;
  }

  setSpeed(s) {
    if (!this.demo) return;
    const g = this.E.now();
    this.d.clk = { g, r: Date.now(), s: Math.max(1, Math.min(30, Number(s) || 1)) };
    this.applyClock();
    this.changed();
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(); }

  async start() {
    if (this.demo) {
      this.timer = setInterval(() => { this.bots.tick(); this.E.tick(); this.flush(); }, 1000);
      this.flush(true);
      return;
    }
    this.base = await roomTopic(this.d.room);
    this.roomKey = await keyFromSecret(this.d.room, 'room');
    this.adminKey = await keyFromSecret(this.d.admin, 'admin');
    for (const id of Object.keys(this.d.S.photos || {})) {
      const m = store.get('hw.media.' + id);
      if (m) this.media[id] = m;
    }
    this.link = new Link(brokerUrl(this.d.broker), (s) => {
      this.status = s;
      if (s === 'ok') { this.lastSent = {}; this.flush(true); }
      this.emit();
    });
    this.link.connect();
    this.link.sub(`${this.base}/join`, (t, b) => this.onJoin(b));
    this.link.sub(`${this.base}/in/+`, (t, b) => this.onIn(t.split('/').pop(), b));
    this.link.sub(`${this.base}/mjin`, (t, b) => this.onMj(b));
    this.timer = setInterval(() => { this.E.tick(); this.flush(); }, 1000);
    this.flush(true);
  }

  stop() {
    clearInterval(this.timer);
    this.link && this.link.end();
  }

  joinUrl() { return `${appUrl()}#j=${this.d.room}&b=${brokerParam(this.d.broker)}`; }
  mjUrl() { return `${appUrl()}#mj=${this.d.room}.${this.d.admin}&b=${brokerParam(this.d.broker)}`; }

  keyFor(pid) {
    if (this.pkeys[pid]) return this.pkeys[pid];
    const p = this.E.S.players[pid];
    if (!p || !p.pub || p.bot) return null;
    this.pkeys[pid] = sharedKey(this.d.keys.priv, p.pub).catch(() => null);
    return this.pkeys[pid];
  }

  async onJoin(bytes) {
    const m = await unseal(this.roomKey, bytes);
    if (!m || typeof m.pid !== 'string' || !m.pub || !m.pub.x) return;
    const S = this.E.S;
    const p = S.players[m.pid];
    if (!p) {
      if (Object.keys(S.players).length >= 40) return;
      this.E.addPlayer(m);
    } else {
      if (JSON.stringify(p.pub) !== JSON.stringify(m.pub)) return;
      p.seen = Date.now();
    }
    delete this.lastSent['to/' + m.pid];
    this.changed();
  }

  async onIn(pid, bytes) {
    const k = await this.keyFor(pid);
    if (!k) return;
    const m = await unseal(k, bytes);
    if (!m) return;
    if (m.a === 'hello') delete this.lastSent['to/' + pid];
    this.E.handle({ pid }, m);
    this.changed();
  }

  async onMj(bytes) {
    const m = await unseal(this.adminKey, bytes);
    if (!m) return;
    if (m.a === 'hello') {
      delete this.lastSent.mj;
      for (const [id, data] of Object.entries(this.media)) this.sendMedia(id, data);
    } else {
      this.E.handle({ mj: true }, m);
    }
    this.changed();
  }

  // actions venues de l'écran TV lui-même, ou du panneau MJ en démo
  local(msg) {
    if (this.demo && msg && msg.g === 'demo') {
      this.bots.handle(msg);
    } else {
      this.E.handle({ mj: true }, msg);
    }
    this.changed();
  }

  // action d'un joueur sans passer par le relais (démo)
  localPlayer(pid, msg) {
    this.E.handle({ pid }, msg);
    this.changed();
  }

  async putMedia(id, data) {
    this.media[id] = data;
    store.set('hw.media.' + id, data);
    this.sendMedia(id, data);
  }

  async sendMedia(id, data) {
    if (!this.link || this.status !== 'ok') return;
    this.link.pub(`${this.base}/media/${id}`, await seal(this.roomKey, { id, data }), true);
  }

  changed() {
    clearTimeout(this.ft);
    this.ft = setTimeout(() => this.flush(), 50);
  }

  async flush(force) {
    if (this.flushing) { this.again = true; return; }
    this.flushing = true;
    try {
      const E = this.E;
      const now = Date.now();
      const pub = E.publicView(this.d.keys.pub);
      this.pubView = pub;
      const ok = this.status === 'ok';
      const pubJson = JSON.stringify(pub);
      if (ok && (force || pubJson !== this.lastSent.pub || now - (this.lastPubAt || 0) > 8000)) {
        this.lastSent.pub = pubJson;
        this.lastPubAt = now;
        this.link.pub(`${this.base}/pub`, await seal(this.roomKey, { ...pub, now: E.now() }), true);
      }
      if (ok) {
        for (const p of E.list()) {
          if (p.bot) continue;
          const v = E.playerView(p.id);
          const j = JSON.stringify(v);
          const key = 'to/' + p.id;
          if (force || j !== this.lastSent[key]) {
            const k = await this.keyFor(p.id);
            if (!k) continue;
            this.lastSent[key] = j;
            this.link.pub(`${this.base}/${key}`, await seal(k, v), true);
          }
        }
        const mj = E.mjView();
        const mjJson = JSON.stringify(mj);
        if (force || mjJson !== this.lastSent.mj || now - (this.lastMjAt || 0) > 8000) {
          this.lastSent.mj = mjJson;
          this.lastMjAt = now;
          this.link.pub(`${this.base}/mj`, await seal(this.adminKey, { ...mj, now: E.now() }), true);
        }
      }
      this.save();
      this.emit();
    } catch (e) {
      console.error('flush', e);
    } finally {
      this.flushing = false;
      if (this.again) { this.again = false; this.changed(); }
    }
  }

  save() {
    const now = Date.now();
    if (now - (this.savedAt || 0) < 1500) {
      clearTimeout(this.st);
      this.st = setTimeout(() => this.save(), 1600);
      return;
    }
    this.savedAt = now;
    if (!store.set(this.demo ? KEYS.demo : KEYS.real, this.d)) console.warn('Sauvegarde locale impossible');
  }
}
