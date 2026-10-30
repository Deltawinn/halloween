// Client : téléphone d'un joueur ou panneau du MJ.
import { Link, keyFromSecret, seal, unseal, newKeyPair, sharedKey, roomTopic, randomId, brokerUrl, store } from './net.js';

const RELIABLE = new Set(['identity', 'avatar', 'monster', 'choose', 'sos', 'num', 'answer', 'hint', 'code', 'caught', 'power', 'read', 'start', 'next', 'exorcise', 'revive', 'save', 'escape', 'clues', 'cfg', 'center', 'refugePt', 'pair', 'kick', 'unbind', 'autopair', 'addTime', 'pause', 'resume', 'reset', 'intro', 'screen']);

export class Client {
  constructor({ room, broker, admin }) {
    this.room = room;
    this.broker = broker;
    this.admin = admin || null;
    this.listeners = new Set();
    this.pub = null;
    this.priv = null;
    this.mj = null;
    this.media = {};
    this.sync = null;
    this.lastPubAt = 0;
    this.status = 'connexion';
    this.id = null;
    this.outbox = [];
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(); }

  // heure de la partie (accélérée en démo)
  now() { const c = this.sync; return c ? c.g + (Date.now() - c.r) * c.s : Date.now(); }
  hostAlive() { return Date.now() - this.lastPubAt < 25000; }

  async start() {
    this.base = await roomTopic(this.room);
    this.roomKey = await keyFromSecret(this.room, 'room');
    this.idKey = 'hw.id.' + this.base;
    if (this.admin) this.adminKey = await keyFromSecret(this.admin, 'admin');
    else this.id = store.get(this.idKey);

    this.link = new Link(brokerUrl(this.broker), (s) => {
      this.status = s;
      if (s === 'ok') this.hello();
      this.emit();
    });
    this.link.connect();
    this.link.sub(`${this.base}/pub`, async (t, b) => {
      const v = await unseal(this.roomKey, b);
      if (!v) return;
      this.sync = { g: v.now, r: Date.now(), s: v.speed || 1 };
      this.lastPubAt = Date.now();
      this.pub = v;
      if (!this.admin) await this.ensureKey();
      this.emit();
    });
    if (this.admin) {
      this.link.sub(`${this.base}/mj`, async (t, b) => {
        const v = await unseal(this.adminKey, b);
        if (!v) return;
        this.mj = v;
        this.emit();
      });
      this.link.sub(`${this.base}/media/+`, async (t, b) => {
        const v = await unseal(this.roomKey, b);
        if (v && v.id) { this.media[v.id] = v.data; this.emit(); }
      });
    }
    this.pinger = setInterval(() => {
      if (document.visibilityState === 'visible' && this.pkey) this.send({ a: 'ping' });
    }, 20000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.hello();
    });
  }

  async hello() {
    if (this.admin) {
      if (this.status === 'ok') this.link.pub(`${this.base}/mjin`, await seal(this.adminKey, { a: 'hello' }));
    } else if (this.pkey) {
      this.send({ a: 'hello' });
    }
  }

  async register(name) {
    const kp = await newKeyPair();
    this.id = { pid: randomId(9), pub: kp.pub, priv: kp.priv, name };
    store.set(this.idKey, this.id);
    await this.ensureKey();
    this.emit();
  }

  forget() {
    store.del(this.idKey);
    location.reload();
  }

  async ensureKey() {
    if (this.pkey || this.keying || !this.id || !this.pub || !this.pub.hostPub) return;
    this.keying = true;
    try {
      this.pkey = await sharedKey(this.id.priv, this.pub.hostPub);
    } catch {
      this.keying = false;
      return;
    }
    this.link.sub(`${this.base}/to/${this.id.pid}`, async (t, b) => {
      const v = await unseal(this.pkey, b);
      if (!v) return;
      this.priv = v;
      this.emit();
    });
    this.sendJoin();
    this.joiner = setInterval(() => {
      if (this.priv) { clearInterval(this.joiner); return; }
      this.sendJoin();
    }, 3000);
  }

  async sendJoin() {
    if (this.status !== 'ok' || !this.id) return;
    const { pid, pub, name } = this.id;
    this.link.pub(`${this.base}/join`, await seal(this.roomKey, { pid, pub, name }));
  }

  // les actions importantes sont renvoyées jusqu'à ce que l'hôte en accuse réception
  send(msg) {
    if (msg && RELIABLE.has(msg.a) && !msg.n) {
      msg = { ...msg, n: randomId(6) };
      this.outbox.push({ msg, t: Date.now() });
      if (!this.retry) this.retry = setInterval(() => this.resend(), 3000);
    }
    return this.raw(msg);
  }

  resend() {
    const v = this.admin ? this.mj : this.priv;
    const acks = new Set((v && v.acks) || []);
    const now = Date.now();
    this.outbox = this.outbox.filter((o) => !acks.has(o.msg.n) && now - o.t < 180000);
    for (const o of this.outbox) if (now - (o.last || o.t) > 2500) { o.last = now; this.raw(o.msg); }
  }

  async raw(msg) {
    if (!this.link) return;
    if (this.admin) {
      this.link.pub(`${this.base}/mjin`, await seal(this.adminKey, msg));
    } else if (this.pkey) {
      this.link.pub(`${this.base}/in/${this.id.pid}`, await seal(this.pkey, msg));
    }
  }

  // raccourci : action d'un jeu
  act(g, a, extra) { return this.send({ g, a, ...(extra || {}) }); }

  names() {
    const m = {};
    for (const p of (this.pub && this.pub.players) || []) m[p.id] = p;
    return m;
  }
}

// Client branché directement sur l'hôte, sans relais : mode démo sur un seul appareil.
export class LocalClient {
  constructor(host, { admin = false } = {}) {
    this.host = host;
    this.admin = admin;
    this.listeners = new Set();
    this.status = 'ok';
    this.media = {};
    this.pub = null;
    this.priv = null;
    this.mj = null;
    this.local = true;
    this.idKey = 'hw.demo.id';
    this.id = admin ? null : store.get(this.idKey);
    this.off = host.on(() => this.refresh());
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(); }
  now() { return this.host.E.now(); }
  hostAlive() { return true; }
  async start() { this.refresh(); }
  stop() { this.off(); }

  refresh() {
    const E = this.host.E;
    this.pub = this.host.pubView ? { ...this.host.pubView, now: E.now() } : null;
    if (this.admin) this.mj = { ...E.mjView(), now: E.now() };
    else if (this.id && E.S.players[this.id.pid]) this.priv = E.playerView(this.id.pid);
    else this.priv = null;
    this.emit();
  }

  async register(name) {
    this.id = { pid: 'moi-' + randomId(4), name };
    store.set(this.idKey, this.id);
    this.host.E.addPlayer({ pid: this.id.pid, pub: null, name });
    this.host.changed();
  }

  forget() {
    if (this.id) this.host.local({ a: 'kick', pid: this.id.pid });
    store.del(this.idKey);
    this.id = null;
    this.priv = null;
    this.emit();
  }

  hello() {}

  async send(msg) {
    if (this.admin) this.host.local(msg);
    else if (this.id) this.host.localPlayer(this.id.pid, msg);
  }

  act(g, a, extra) { return this.send({ g, a, ...(extra || {}) }); }

  names() {
    const m = {};
    for (const p of (this.pub && this.pub.players) || []) m[p.id] = p;
    return m;
  }
}
