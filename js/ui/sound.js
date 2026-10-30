// Effets sonores synthétisés (aucun fichier audio à charger).
let ctx = null;
let enabled = true;

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {}
}

export function setSound(on) { enabled = on; }
export function soundOn() { return enabled; }

function tone(freq, start, dur, { type = 'sine', gain = 0.2, to = null } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (to) o.frequency.exponentialRampToValueAtTime(to, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(start);
  o.stop(start + dur + 0.05);
}

function noise(start, dur, gain = 0.15, freq = 500) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(start);
}

export function play(kind) {
  if (!enabled || !ctx) return;
  const t = ctx.currentTime + 0.02;
  switch (kind) {
    case 'death':
    case 'curse':
      tone(55, t, 2.4, { type: 'sawtooth', gain: 0.12 });
      tone(58.3, t, 2.4, { type: 'sawtooth', gain: 0.1 });
      tone(880, t, 0.9, { type: 'triangle', gain: 0.08, to: 440 });
      break;
    case 'reveal':
    case 'win':
      [196, 233.1, 293.7, 349.2].forEach((f, i) => tone(f, t + i * 0.18, 2.6, { type: 'triangle', gain: 0.09 }));
      tone(49, t, 3, { type: 'sine', gain: 0.25 });
      break;
    case 'clue':
      tone(1318.5, t, 1.6, { type: 'sine', gain: 0.12 });
      tone(1975.5, t + 0.12, 1.4, { type: 'sine', gain: 0.06 });
      break;
    case 'capture':
    case 'wanted':
      for (let i = 0; i < 3; i++) tone(620, t + i * 0.5, 0.45, { type: 'square', gain: 0.05, to: 980 });
      break;
    case 'night':
      noise(t, 3, 0.12, 380);
      tone(73.4, t, 3, { type: 'sine', gain: 0.18 });
      break;
    case 'alarm':
      for (let i = 0; i < 4; i++) tone(700, t + i * 0.42, 0.38, { type: 'square', gain: 0.09, to: 1150 });
      break;
    case 'ping':
      tone(880, t, 0.25, { type: 'triangle', gain: 0.07 });
      break;
    case 'bad':
      tone(330, t, 0.35, { type: 'square', gain: 0.06, to: 220 });
      tone(220, t + 0.3, 0.45, { type: 'square', gain: 0.06, to: 160 });
      break;
    case 'tick':
      tone(1600, t, 0.05, { type: 'square', gain: 0.03 });
      break;
    default:
      tone(392, t, 0.5, { type: 'triangle', gain: 0.1 });
      tone(587.3, t + 0.15, 0.7, { type: 'triangle', gain: 0.08 });
  }
}
