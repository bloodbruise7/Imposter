import { cryptoRng, randomInt, type Rng } from './random';
import type { Category, Mode, PoolWord } from './types';

export function wordId(categoryId: string, word: string): string {
  return `${categoryId}::${word}`;
}

/** Every word in the selected categories. Undercover drops words without a decoy. */
export function buildPool(categories: Category[], selectedIds: string[], mode: Mode): PoolWord[] {
  const selected = new Set(selectedIds);
  const pool: PoolWord[] = [];
  for (const c of categories) {
    if (!selected.has(c.id)) continue;
    for (const w of c.words) {
      if (mode === 'undercover' && !w.decoy) continue;
      pool.push({
        id: wordId(c.id, w.word),
        categoryId: c.id,
        categoryName: c.name,
        word: w.word,
        hint: w.hint,
        decoy: w.decoy,
      });
    }
  }
  return pool;
}

export interface Pick {
  word: PoolWord;
  /** Played ids after this pick, including the picked word. */
  playedIds: string[];
  /** True when the unplayed pool was empty and its words were marked unplayed again. */
  reshuffled: boolean;
}

/** Picks an unplayed word uniformly. When none remain, resets the pool's words and notes it. */
export function pickWord(pool: PoolWord[], playedIds: string[], rng: Rng = cryptoRng): Pick {
  if (pool.length === 0) throw new Error('pickWord: pool is empty');
  let played = new Set(playedIds);
  let unplayed = pool.filter((w) => !played.has(w.id));
  let reshuffled = false;
  if (unplayed.length === 0) {
    const poolIds = new Set(pool.map((w) => w.id));
    played = new Set([...played].filter((id) => !poolIds.has(id)));
    unplayed = pool;
    reshuffled = true;
  }
  const word = unplayed[randomInt(unplayed.length, rng)];
  played.add(word.id);
  return { word, playedIds: [...played], reshuffled };
}
