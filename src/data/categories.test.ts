import { describe, expect, it } from 'vitest';
import data from './categories.json';
import type { Category } from '../game/types';

const categories = data.categories as Category[];

describe('built-in word data', () => {
  it('has unique category ids', () => {
    const ids = categories.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(0);
  });

  it('has a non-empty name and icon on every category', () => {
    for (const c of categories) {
      expect(c.name.trim(), c.id).not.toBe('');
      expect(c.icon.trim(), c.id).not.toBe('');
    }
  });

  it('has at least 10 words per category', () => {
    for (const c of categories) expect(c.words.length, c.id).toBeGreaterThanOrEqual(10);
  });

  it('has a non-empty word, hint, and decoy on every entry', () => {
    for (const c of categories) {
      for (const w of c.words) {
        expect(w.word.trim(), `${c.id}: ${w.word}`).not.toBe('');
        expect(w.hint.trim(), `${c.id}: ${w.word}`).not.toBe('');
        expect(w.decoy.trim(), `${c.id}: ${w.word}`).not.toBe('');
      }
    }
  });

  it('has no duplicate words across categories (case-insensitive)', () => {
    const seen = new Map<string, string>();
    for (const c of categories) {
      for (const w of c.words) {
        const key = w.word.toLowerCase();
        expect(seen.has(key), `"${w.word}" in ${c.id} and ${seen.get(key)}`).toBe(false);
        seen.set(key, c.id);
      }
    }
  });

  it('has no hint or decoy that contains its own word (case-insensitive)', () => {
    for (const c of categories) {
      for (const w of c.words) {
        const word = w.word.toLowerCase();
        expect(w.hint.toLowerCase().includes(word), `${c.id}: hint "${w.hint}" contains "${w.word}"`).toBe(false);
        expect(w.decoy.toLowerCase().includes(word), `${c.id}: decoy "${w.decoy}" contains "${w.word}"`).toBe(false);
      }
    }
  });
});
