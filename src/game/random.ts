/** Returns a number in [0, 1). Every random choice in the game goes through one of these. */
export type Rng = () => number;

const MAX_UINT32 = 0x100000000;

/** Crypto-backed generator. Falls back to Math.random only where crypto is unavailable. */
export const cryptoRng: Rng = () => {
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return buf[0] / MAX_UINT32;
  }
  return Math.random();
};

/** Integer in [0, n). */
export function randomInt(n: number, rng: Rng = cryptoRng): number {
  if (n <= 0) throw new Error('randomInt: n must be positive');
  return Math.min(n - 1, Math.floor(rng() * n));
}

/** k distinct integers from [0, n), chosen uniformly (partial Fisher-Yates). */
export function pickDistinct(k: number, n: number, rng: Rng = cryptoRng): number[] {
  if (k > n) throw new Error('pickDistinct: k exceeds n');
  const pool = Array.from({ length: n }, (_, i) => i);
  const out: number[] = [];
  for (let i = 0; i < k; i++) {
    const j = i + randomInt(n - i, rng);
    [pool[i], pool[j]] = [pool[j], pool[i]];
    out.push(pool[i]);
  }
  return out.sort((a, b) => a - b);
}

/**
 * k distinct indexes drawn without replacement, each draw proportional to its
 * weight. Zero-weight entries are only drawn once every positive weight is used up.
 */
export function pickWeighted(k: number, weights: number[], rng: Rng = cryptoRng): number[] {
  const n = weights.length;
  if (k > n) throw new Error('pickWeighted: k exceeds weights length');
  const remaining = weights.map((w, i) => ({ i, w: Math.max(0, w) }));
  const out: number[] = [];
  while (out.length < k) {
    let total = remaining.reduce((s, r) => s + r.w, 0);
    if (total <= 0) {
      // Everything left is zero-weight: fall back to a uniform draw among the rest.
      remaining.forEach((r) => (r.w = 1));
      total = remaining.length;
    }
    let roll = rng() * total;
    let chosen = remaining.length - 1;
    for (let idx = 0; idx < remaining.length; idx++) {
      roll -= remaining[idx].w;
      if (roll < 0) {
        chosen = idx;
        break;
      }
    }
    out.push(remaining[chosen].i);
    remaining.splice(chosen, 1);
  }
  return out.sort((a, b) => a - b);
}

/** Builds a deterministic generator from a fixed sequence of values, for tests. */
export function sequenceRng(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}
