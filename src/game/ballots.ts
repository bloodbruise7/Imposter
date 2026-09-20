/**
 * Individual voting: every player casts a private ballot of K names.
 * The K players with the most votes are accused. A tie across the cut is
 * handed back to the group to break.
 */

export interface Ballot {
  voter: number;
  picks: number[];
}

export interface Tally {
  /** Votes received, by player index. */
  counts: number[];
  /** Players accused outright: strictly more votes than the cut. */
  accused: number[];
  /** When a tie straddles the cut: the tied candidates and how many of them still need choosing. */
  tie: { candidates: number[]; slots: number } | null;
}

export function tallyBallots(playerCount: number, ballots: Ballot[], k: number): Tally {
  const counts = new Array<number>(playerCount).fill(0);
  for (const b of ballots) for (const p of b.picks) if (p >= 0 && p < playerCount) counts[p]++;

  const order = counts.map((c, i) => ({ i, c })).sort((a, b) => b.c - a.c || a.i - b.i);
  const slots = Math.min(k, playerCount);
  if (slots <= 0) return { counts, accused: [], tie: null };

  const cut = order[slots - 1].c;
  const above = order.filter((o) => o.c > cut).map((o) => o.i);
  const atCut = order.filter((o) => o.c === cut).map((o) => o.i);
  const remaining = slots - above.length;

  if (atCut.length === remaining) {
    return { counts, accused: [...above, ...atCut].sort((a, b) => a - b), tie: null };
  }
  return { counts, accused: above.sort((a, b) => a - b), tie: { candidates: atCut.sort((a, b) => a - b), slots: remaining } };
}

/** +1 to each non-imposter voter for every imposter on their ballot. Nothing in a troll round. */
export function voteScores(playerCount: number, ballots: Ballot[], imposterIndexes: number[], troll: boolean): number[] {
  const points = new Array<number>(playerCount).fill(0);
  if (troll) return points;
  const imposters = new Set(imposterIndexes);
  for (const b of ballots) {
    if (imposters.has(b.voter)) continue;
    for (const p of b.picks) if (imposters.has(p)) points[b.voter]++;
  }
  return points;
}
