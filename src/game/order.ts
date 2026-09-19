import { cryptoRng, randomInt, type Rng } from './random';

/** Uniform pick among all players, imposters included. */
export function pickFirstSpeaker(playerCount: number, rng: Rng = cryptoRng): number {
  return randomInt(playerCount, rng);
}

/** Entry order starting at `first`, wrapping around. */
export function speakingOrder(playerCount: number, first: number): number[] {
  return Array.from({ length: playerCount }, (_, i) => (first + i) % playerCount);
}
