import { describe, expect, it } from 'vitest';
import { tallyBallots, voteScores } from './ballots';
import { scoreRound } from './scoring';

const b = (voter: number, ...picks: number[]) => ({ voter, picks });

describe('tallyBallots', () => {
  it('accuses the plurality winner even without a majority', () => {
    const t = tallyBallots(5, [b(0, 1), b(1, 2), b(2, 1), b(3, 4), b(4, 3)], 1);
    expect(t.counts).toEqual([0, 2, 1, 1, 1]);
    expect(t.accused).toEqual([1]);
    expect(t.tie).toBeNull();
  });

  it('hands a tie at the cut back to the group', () => {
    const t = tallyBallots(5, [b(0, 1), b(1, 3), b(2, 1), b(3, 3), b(4, 0)], 1);
    expect(t.accused).toEqual([]);
    expect(t.tie).toEqual({ candidates: [1, 3], slots: 1 });
  });

  it('with two imposters, takes the top two and ties only the contested slot', () => {
    // 4 votes for 1, 2 for 3, 2 for 5, 1 for 6 (7 players, K=2)
    const ballots = [b(0, 1, 3), b(2, 1, 5), b(3, 1, 5), b(4, 1, 3), b(5, 6, 1)];
    const t = tallyBallots(7, ballots, 2);
    expect(t.accused).toEqual([1]);
    expect(t.tie).toEqual({ candidates: [3, 5], slots: 1 });
  });

  it('returns a clean top two when nothing is contested', () => {
    const t = tallyBallots(7, [b(0, 1, 3), b(2, 1, 3), b(4, 1, 5)], 2);
    expect(t.accused).toEqual([1, 3]);
    expect(t.tie).toBeNull();
  });
});

describe('voteScores', () => {
  it('gives +1 per imposter named, and nothing to imposters or in troll rounds', () => {
    const ballots = [b(0, 2), b(1, 2), b(2, 0), b(3, 4), b(4, 2)];
    expect(voteScores(5, ballots, [2], false)).toEqual([1, 1, 0, 0, 1]);
    expect(voteScores(5, ballots, [2], true)).toEqual([0, 0, 0, 0, 0]);
    // imposter 4 voting for fellow imposter 2 earns nothing
    expect(voteScores(5, [b(4, 2), b(0, 2, 4)], [2, 4], false)).toEqual([2, 0, 0, 0, 0]);
  });
});

describe('scoreRound without the crew catch bonus', () => {
  it('pays the imposter for escaping or guessing, and the crew nothing for a catch', () => {
    const base = { playerCount: 5, troll: false, catchBonus: false };
    expect(scoreRound({ ...base, imposterIndexes: [2], votedIndexes: [0], guessed: {} })).toEqual([0, 0, 2, 0, 0]);
    expect(scoreRound({ ...base, imposterIndexes: [2], votedIndexes: [2], guessed: { 2: true } })).toEqual([0, 0, 2, 0, 0]);
    expect(scoreRound({ ...base, imposterIndexes: [2], votedIndexes: [2], guessed: { 2: false } })).toEqual([0, 0, 0, 0, 0]);
  });
});
