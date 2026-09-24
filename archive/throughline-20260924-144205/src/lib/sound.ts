/** Tiny synthesised sounds so the app has no audio assets. */
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) { enabled = v; }

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.12, when = 0, slideTo?: number) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + when);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + when + dur);
  g.gain.setValueAtTime(0, c.currentTime + when);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + when + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + when);
  o.stop(c.currentTime + when + dur + 0.02);
}

function noise(dur: number, gain = 0.08, when = 0) {
  const c = ac();
  if (!c) return;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const s = c.createBufferSource();
  s.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1400;
  const g = c.createGain();
  g.gain.value = gain;
  s.connect(f).connect(g).connect(c.destination);
  s.start(c.currentTime + when);
}

export const sound = {
  move() { noise(0.06, 0.14); tone(520, 0.05, 'triangle', 0.05); },
  capture() { noise(0.09, 0.2); tone(300, 0.08, 'triangle', 0.08); },
  correct() { tone(660, 0.09, 'sine', 0.08); tone(990, 0.12, 'sine', 0.08, 0.07); },
  wrong() { tone(220, 0.18, 'sawtooth', 0.06, 0, 160); },
  hint() { tone(440, 0.1, 'sine', 0.06); },
  lineDone() { tone(523, 0.1, 'sine', 0.08); tone(659, 0.1, 'sine', 0.08, 0.09); tone(784, 0.14, 'sine', 0.08, 0.18); tone(1047, 0.2, 'sine', 0.08, 0.27); },
};
