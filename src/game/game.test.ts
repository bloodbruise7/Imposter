import { describe, expect, it } from 'vitest';
import { maxImposters, clampImposters } from './imposters';
import { dealRoles, TROLL_CHANCE } from './deal';
import { buildPool, pickWord } from './words';
import { pickFirstSpeaker, speakingOrder } from './order';
import { scoreRound, standings } from './scoring';
import { pickDistinct, sequenceRng } from './random';
import type { Category } from './types';

describe('maxImposters', () => {
  it('is 1 for 3-6 players', () => {
    for (const p of [3, 4, 5, 6]) expect(maxImposters(p)).toBe(1);
  });
  it('is 2 for 7-9 players', () => {
    for (const p of [7, 8, 9]) expect(maxImposters(p)).toBe(2);
  });
  it('is 3 for 10-12 players', () => {
    for (const p of [10, 11, 12]) expect(maxImposters(p)).toBe(3);
  });
  it('clamps when the player count drops', () => {
    expect(clampImposters(2, 6)).toBe(1);
    expect(clampImposters(0, 8)).toBe(1);
    expect(clampImposters(2, 8)).toBe(2);
  });
});

describe('dealRoles', () => {
  it('gives exactly K distinct imposters', () => {
    for (let trial = 0; trial < 200; trial++) {
      const deal = dealRoles({ playerCount: 9, imposters: 2, mode: 'classic', trollMode: false });
      expect(deal.troll).toBe(false);
      expect(deal.imposterIndexes).toHaveLength(2);
      expect(new Set(deal.imposterIndexes).size).toBe(2);
      for (const i of deal.imposterIndexes) expect(i).toBeGreaterThanOrEqual(0);
      for (const i of deal.imposterIndexes) expect(i).toBeLessThan(9);
    }
  });

  it('pickDistinct covers every index over many draws', () => {
    const seen = new Set<number>();
    for (let t = 0; t < 500; t++) for (const i of pickDistinct(1, 5)) seen.add(i);
    expect(seen.size).toBe(5);
  });

  it('troll triggers below 0.07 and not at or above it', () => {
    const base = { playerCount: 5, imposters: 1, mode: 'classic' as const, trollMode: true };
    const below = dealRoles(base, sequenceRng([0.0699, 0.5]));
    expect(below.troll).toBe(true);
    expect(below.imposterIndexes).toEqual([0, 1, 2, 3, 4]);

    const at = dealRoles(base, sequenceRng([TROLL_CHANCE, 0.5]));
    expect(at.troll).toBe(false);
    expect(at.imposterIndexes).toHaveLength(1);

    const above = dealRoles(base, sequenceRng([0.9, 0.5]));
    expect(above.troll).toBe(false);
  });

  it('never trolls in Undercover or with Troll Mode off', () => {
    const rng = () => 0;
    expect(dealRoles({ playerCount: 5, imposters: 1, mode: 'undercover', trollMode: true }, rng).troll).toBe(false);
    expect(dealRoles({ playerCount: 5, imposters: 1, mode: 'classic', trollMode: false }, rng).troll).toBe(false);
  });
});

const cats: Category[] = [
  {
    id: 'a',
    name: 'A',
    icon: '🅰️',
    words: [
      { word: 'One', hint: 'h1', decoy: 'd1' },
      { word: 'Two', hint: 'h2', decoy: '' },
      { word: 'Three', hint: 'h3', decoy: 'd3' },
    ],
  },
  { id: 'b', name: 'B', icon: '🅱️', words: [{ word: 'Four', hint: 'h4', decoy: 'd4' }] },
];

describe('word picker', () => {
  it('draws from the combined pool of selected categories only', () => {
    const pool = buildPool(cats, ['a'], 'classic');
    expect(pool.map((w) => w.word)).toEqual(['One', 'Two', 'Three']);
    expect(buildPool(cats, ['a', 'b'], 'classic')).toHaveLength(4);
    expect(pool[0].categoryName).toBe('A');
  });

  it('excludes decoy-less words in Undercover', () => {
    const pool = buildPool(cats, ['a', 'b'], 'undercover');
    expect(pool.map((w) => w.word)).toEqual(['One', 'Three', 'Four']);
  });

  it('never repeats a word until the pool is exhausted, then reshuffles', () => {
    const pool = buildPool(cats, ['a', 'b'], 'classic');
    let played: string[] = [];
    const seen: string[] = [];
    for (let i = 0; i < pool.length; i++) {
      const pick = pickWord(pool, played);
      expect(pick.reshuffled).toBe(false);
      expect(seen).not.toContain(pick.word.id);
      seen.push(pick.word.id);
      played = pick.playedIds;
    }
    expect(seen).toHaveLength(4);
    const again = pickWord(pool, played);
    expect(again.reshuffled).toBe(true);
    expect(again.playedIds).toEqual([again.word.id]);
  });

  it('reshuffle keeps played ids from categories outside the pool', () => {
    const pool = buildPool(cats, ['b'], 'classic');
    const pick = pickWord(pool, ['a::One', 'b::Four']);
    expect(pick.reshuffled).toBe(true);
    expect(pick.playedIds.sort()).toEqual(['a::One', 'b::Four']);
  });
});

describe('speaking order', () => {
  it('picks the first speaker from all players', () => {
    expect(pickFirstSpeaker(4, () => 0.99)).toBe(3);
    expect(pickFirstSpeaker(4, () => 0)).toBe(0);
  });
  it('continues in entry order and wraps', () => {
    expect(speakingOrder(5, 3)).toEqual([3, 4, 0, 1, 2]);
  });
});

describe('scoring', () => {
  const base = { playerCount: 5, troll: false };

  it('got away: that imposter +2', () => {
    const pts = scoreRound({ ...base, imposterIndexes: [2], votedIndexes: [0], guessed: {} });
    expect(pts).toEqual([0, 0, 2, 0, 0]);
  });

  it('caught then guessed: that imposter +2', () => {
    const pts = scoreRound({ ...base, imposterIndexes: [2], votedIndexes: [2], guessed: { 2: true } });
    expect(pts).toEqual([0, 0, 2, 0, 0]);
  });

  it('caught then missed: every non-imposter +1', () => {
    const pts = scoreRound({ ...base, imposterIndexes: [2], votedIndexes: [2], guessed: { 2: false } });
    expect(pts).toEqual([1, 1, 0, 1, 1]);
  });

  it('two imposters: one escapes, one caught and missed', () => {
    const pts = scoreRound({
      playerCount: 7,
      troll: false,
      imposterIndexes: [1, 4],
      votedIndexes: [4, 6],
      guessed: { 4: false },
    });
    expect(pts).toEqual([1, 2, 1, 1, 0, 1, 1]);
  });

  it('troll round scores zero', () => {
    const pts = scoreRound({
      playerCount: 4,
      troll: true,
      imposterIndexes: [0, 1, 2, 3],
      votedIndexes: [1],
      guessed: {},
    });
    expect(pts).toEqual([0, 0, 0, 0]);
  });

  it('standings share ranks on ties', () => {
    expect(standings([3, 5, 5, 1]).map((s) => [s.index, s.rank])).toEqual([
      [1, 1],
      [2, 1],
      [0, 3],
      [3, 4],
    ]);
  });
});
