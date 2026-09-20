/**
 * Tiny synthesized sounds via the Web Audio API. No audio files.
 * Browsers only allow audio after a user gesture, so `unlockAudio` runs on
 * the first tap anywhere in the app and keeps the context alive.
 */

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function getCtor(): AudioContextCtor | null {
  const w = globalThis as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Create or resume the audio context. Safe to call on every user gesture. */
export function unlockAudio(): void {
  try {
    const Ctor = getCtor();
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch {
    ctx = null;
  }
}

function tone(at: number, freq: number, duration: number, gainPeak: number): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(gainPeak, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

/** Three rising notes for "Time's up". Silent where audio is unavailable or locked. */
export function playTimesUp(): void {
  try {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.02;
    tone(t, 784, 0.18, 0.35);
    tone(t + 0.22, 784, 0.18, 0.35);
    tone(t + 0.44, 1175, 0.45, 0.4);
  } catch {
    /* never let a sound break the game */
  }
}
