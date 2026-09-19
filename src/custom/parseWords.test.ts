import { describe, expect, it } from 'vitest';
import { formatWordLines, parseWordLines, validateCategoryName } from './parseWords';

const five = ['A', 'B', 'C', 'D', 'E'];

describe('parseWordLines', () => {
  it('accepts the three line formats', () => {
    const r = parseWordLines(['Pizza', 'Burger | Cookout', 'Taco | Crunchy | Burrito', 'D', 'E'].join('\n'));
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
    expect(r.entries.slice(0, 3)).toEqual([
      { word: 'Pizza', hint: '', decoy: '' },
      { word: 'Burger', hint: 'Cookout', decoy: '' },
      { word: 'Taco', hint: 'Crunchy', decoy: 'Burrito' },
    ]);
  });

  it('ignores blank lines and trims parts', () => {
    const r = parseWordLines('\n  A  |  h \n\n' + ['B', 'C', 'D', 'E'].join('\n') + '\n\n');
    expect(r.entries[0]).toEqual({ word: 'A', hint: 'h', decoy: '' });
    expect(r.entries).toHaveLength(5);
    expect(r.valid).toBe(true);
  });

  it('rejects empty words', () => {
    const r = parseWordLines([' | hint', ...five].join('\n'));
    expect(r.errors).toEqual([{ line: 1, message: 'Word is required' }]);
    expect(r.valid).toBe(false);
  });

  it('rejects parts over 40 characters', () => {
    const long = 'x'.repeat(41);
    const r = parseWordLines([...five, `Fine | ${long}`].join('\n'));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].line).toBe(6);
    expect(r.valid).toBe(false);
    expect(parseWordLines([...five, 'x'.repeat(40)].join('\n')).valid).toBe(true);
  });

  it('rejects duplicate words case-insensitively', () => {
    const r = parseWordLines([...five, 'a'].join('\n'));
    expect(r.errors).toEqual([{ line: 6, message: '"a" is already in this category' }]);
    expect(r.valid).toBe(false);
  });

  it('rejects fewer than 5 words', () => {
    const r = parseWordLines('A\nB\nC\nD');
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(false);
  });

  it('round-trips through formatWordLines', () => {
    const text = 'Pizza\nBurger | Cookout\nTaco | Crunchy | Burrito\nD\nE';
    expect(formatWordLines(parseWordLines(text).entries)).toBe(text);
  });
});

describe('validateCategoryName', () => {
  it('requires 1-30 characters and uniqueness', () => {
    expect(validateCategoryName('', [])).toBe('Name is required');
    expect(validateCategoryName('x'.repeat(31), [])).toMatch(/30/);
    expect(validateCategoryName('food', ['Food'])).toMatch(/already exists/);
    expect(validateCategoryName('Board Games', ['Food'])).toBeNull();
  });
});
