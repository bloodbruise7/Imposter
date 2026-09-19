export interface RoundOutcome {
  playerCount: number;
  imposterIndexes: number[];
  /** Player indexes the group accused. */
  votedIndexes: number[];
  /** For each caught imposter index, whether they guessed the word. */
  guessed: Record<number, boolean>;
  troll: boolean;
}

export const ESCAPE_POINTS = 2;
export const GUESS_POINTS = 2;
export const CATCH_POINTS = 1;

/**
 * Points per player for one round, applied once per imposter:
 * - got away: that imposter +ESCAPE_POINTS
 * - caught: every non-imposter +CATCH_POINTS, and if the imposter then
 *   guesses the word they also get +GUESS_POINTS; if they miss, nothing.
 */
export function scoreRound(o: RoundOutcome): number[] {
  const points = new Array<number>(o.playerCount).fill(0);
  if (o.troll) return points;
  const imposters = new Set(o.imposterIndexes);
  const voted = new Set(o.votedIndexes);
  for (const imp of o.imposterIndexes) {
    if (!voted.has(imp)) {
      points[imp] += ESCAPE_POINTS;
      continue;
    }
    for (let p = 0; p < o.playerCount; p++) {
      if (!imposters.has(p)) points[p] += CATCH_POINTS;
    }
    if (o.guessed[imp]) points[imp] += GUESS_POINTS;
  }
  return points;
}

export interface Standing {
  index: number;
  total: number;
  rank: number;
}

/** Sorted by total descending; equal totals share a rank (1, 1, 3). */
export function standings(totals: number[]): Standing[] {
  const sorted = totals
    .map((total, index) => ({ index, total, rank: 0 }))
    .sort((a, b) => b.total - a.total || a.index - b.index);
  let rank = 0;
  sorted.forEach((s, i) => {
    if (i === 0 || s.total !== sorted[i - 1].total) rank = i + 1;
    s.rank = rank;
  });
  return sorted;
}
