// Transport : relais MQTT public + chiffrement de bout en bout (AES-GCM / ECDH).
// Le relais ne voit que des octets chiffrés : la clé de la salle ne circule
// que dans le fragment (#) du lien d'invitation, jamais envoyé à un serveur.
import mqtt from '../vendor/mqtt.esm.js';

export const BROKERS = [
  { id: 0, label: 'HiveMQ', url: 'wss://broker.hivemq.com:8884/mqtt' },
  { id: 1, label: 'EMQX', url: 'wss://broker.emqx.io:8084/mqtt' },
  { id: 2, label: 'Mosquitto', url: 'wss://test.mosquitto.org:8081/mqtt' },
];

export function brokerUrl(b) {
  if (b == null || b === '') return BROKERS[0].url;
  if (/^\d+$/.test(String(b))) return (BROKERS[Number(b)] || BROKERS[0]).url;
  return decodeURIComponent(String(b));
}

const te = new TextEncoder();
const td = new TextDecoder();

export function b64u(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomId(n = 12) {
  return b64u(crypto.getRandomValues(new Uint8Array(n)));
}

export async function sha256hex(s) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(s)));
  return [...d].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function keyFromSecret(secret, label) {
  const raw = await crypto.subtle.digest('SHA-256', te.encode(label + ':' + secret));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function seal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj))));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv, 0);
  out.set(ct, 12);
  return out;
}

export async function unseal(key, bytes) {
  try {
    if (!bytes || bytes.length < 13) return null;
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, key, b.slice(12));
    return JSON.parse(td.decode(pt));
  } catch {
    return null;
  }
}

export async function newKeyPair() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  return {
    pub: await crypto.subtle.exportKey('jwk', kp.publicKey),
    priv: await crypto.subtle.exportKey('jwk', kp.privateKey),
  };
}

export async function sharedKey(privJwk, pubJwk) {
  const priv = await crypto.subtle.importKey('jwk', privJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
  const pub = await crypto.subtle.importKey('jwk', pubJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  return crypto.subtle.deriveKey({ name: 'ECDH', public: pub }, priv, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function roomTopic(roomSecret) {
  return 'hw26/' + (await sha256hex('topic:' + roomSecret)).slice(0, 24);
}

// Petite enveloppe autour de mqtt.js
export class Link {
  constructor(url, onStatus) {
    this.url = url;
    this.handlers = [];
    this.onStatus = onStatus || (() => {});
    this.status = 'connexion';
  }

  connect() {
    this.client = mqtt.connect(this.url, {
      clientId: 'hw_' + randomId(8),
      clean: true,
      keepalive: 30,
      reconnectPeriod: 2500,
      connectTimeout: 10000,
      resubscribe: true,
    });
    this.client.on('connect', () => this.setStatus('ok'));
    this.client.on('reconnect', () => this.setStatus('connexion'));
    this.client.on('offline', () => this.setStatus('hors-ligne'));
    this.client.on('close', () => this.status === 'ok' && this.setStatus('connexion'));
    this.client.on('error', () => this.setStatus('erreur'));
    this.client.on('message', (topic, payload) => {
      for (const h of this.handlers) {
        if (match(h.filter, topic)) h.fn(topic, payload);
      }
    });
  }

  setStatus(s) {
    this.status = s;
    this.onStatus(s);
  }

  sub(filter, fn) {
    this.handlers.push({ filter, fn });
    this.client.subscribe(filter, { qos: 1 });
  }

  pub(topic, bytes, retain = false) {
    if (!this.client) return;
    this.client.publish(topic, bytes, { qos: 1, retain });
  }

  clear(topic) {
    if (this.client) this.client.publish(topic, new Uint8Array(0), { qos: 1, retain: true });
  }

  end() {
    try { this.client && this.client.end(true); } catch {}
  }
}

function match(filter, topic) {
  const f = filter.split('/');
  const t = topic.split('/');
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '#') return true;
    if (f[i] === '+') { if (t[i] == null) return false; continue; }
    if (f[i] !== t[i]) return false;
  }
  return f.length === t.length;
}

export const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
