import { cryptoRng, pickDistinct, pickWeighted, type Rng } from './random';
import type { Mode } from './types';

export const TROLL_CHANCE = 0.07;

export interface DealInput {
  playerCount: number;
  imposters: number;
  mode: Mode;
  trollMode: boolean;
  /**
   * Rounds since each player was last the imposter (0 at game start or right
   * after being it). When given, the draw is weighted toward long droughts.
   */
  droughts?: number[];
}

export interface Deal {
  /** Player indexes (entry order) who are imposters. In a troll round, every player. */
  imposterIndexes: number[];
  troll: boolean;
}

/** Fairness weight: a player one round out of the imposter seat has weight 2, two rounds out weight 3, and so on. */
export function fairnessWeights(droughts: number[]): number[] {
  return droughts.map((d) => Math.max(0, d) + 1);
}

/** Droughts after a deal: imposters reset to 0, everyone else grows by one. */
export function nextDroughts(droughts: number[], deal: Deal): number[] {
  const imposters = new Set(deal.imposterIndexes);
  return droughts.map((d, i) => (imposters.has(i) ? 0 : d + 1));
}

/**
 * Chooses the round's imposters. In Classic with Troll Mode on, the first draw
 * from the generator is the troll roll; below TROLL_CHANCE everyone is an imposter.
 * With `droughts`, players who have waited longer are proportionally more likely.
 */
export function dealRoles(input: DealInput, rng: Rng = cryptoRng): Deal {
  const { playerCount, imposters, mode, trollMode, droughts } = input;
  if (mode === 'classic' && trollMode && rng() < TROLL_CHANCE) {
    return { imposterIndexes: Array.from({ length: playerCount }, (_, i) => i), troll: true };
  }
  const usable = droughts && droughts.length === playerCount ? droughts : null;
  const imposterIndexes = usable
    ? pickWeighted(imposters, fairnessWeights(usable), rng)
    : pickDistinct(imposters, playerCount, rng);
  return { imposterIndexes, troll: false };
}
