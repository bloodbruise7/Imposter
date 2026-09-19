import { cryptoRng, pickDistinct, type Rng } from './random';
import type { Mode } from './types';

export const TROLL_CHANCE = 0.07;

export interface DealInput {
  playerCount: number;
  imposters: number;
  mode: Mode;
  trollMode: boolean;
}

export interface Deal {
  /** Player indexes (entry order) who are imposters. In a troll round, every player. */
  imposterIndexes: number[];
  troll: boolean;
}

/**
 * Chooses the round's imposters. In Classic with Troll Mode on, the first draw
 * from the generator is the troll roll; below TROLL_CHANCE everyone is an imposter.
 */
export function dealRoles(input: DealInput, rng: Rng = cryptoRng): Deal {
  const { playerCount, imposters, mode, trollMode } = input;
  if (mode === 'classic' && trollMode && rng() < TROLL_CHANCE) {
    return { imposterIndexes: Array.from({ length: playerCount }, (_, i) => i), troll: true };
  }
  return { imposterIndexes: pickDistinct(imposters, playerCount, rng), troll: false };
}
