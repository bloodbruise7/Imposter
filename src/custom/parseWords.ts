import type { WordEntry } from '../game/types';

export const MAX_PART_LENGTH = 40;
export const MIN_WORDS = 5;
export const MAX_NAME_LENGTH = 30;

export interface LineError {
  /** 1-based line number in the textarea. */
  line: number;
  message: string;
}

export interface ParseResult {
  entries: WordEntry[];
  errors: LineError[];
  /** True when there are no line errors and at least MIN_WORDS entries. */
  valid: boolean;
}

/**
 * Parses `word | hint | decoy` lines. Hint and decoy are optional.
 * Blank lines are ignored. Errors are reported per line.
 */
export function parseWordLines(text: string): ParseResult {
  const entries: WordEntry[] = [];
  const errors: LineError[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);

  lines.forEach((raw, i) => {
    const line = i + 1;
    if (raw.trim() === '') return;
    const parts = raw.split('|').map((p) => p.trim());
    const [word = '', hint = '', decoy = ''] = parts;
    if (parts.length > 3) {
      errors.push({ line, message: 'Use at most three parts: word | hint | decoy' });
      return;
    }
    if (!word) {
      errors.push({ line, message: 'Word is required' });
      return;
    }
    const tooLong = [word, hint, decoy].find((p) => p.length > MAX_PART_LENGTH);
    if (tooLong !== undefined) {
      errors.push({ line, message: `Each part must be ${MAX_PART_LENGTH} characters or fewer` });
      return;
    }
    const key = word.toLowerCase();
    if (seen.has(key)) {
      errors.push({ line, message: `"${word}" is already in this category` });
      return;
    }
    seen.add(key);
    entries.push({ word, hint, decoy });
  });

  const valid = errors.length === 0 && entries.length >= MIN_WORDS;
  return { entries, errors, valid };
}

/** Renders entries back into the textarea format. */
export function formatWordLines(entries: WordEntry[]): string {
  return entries
    .map((e) => {
      if (e.decoy) return `${e.word} | ${e.hint} | ${e.decoy}`;
      if (e.hint) return `${e.word} | ${e.hint}`;
      return e.word;
    })
    .join('\n');
}

/** Returns an error message for a category name, or null when it is valid. */
export function validateCategoryName(name: string, takenNames: string[]): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 1) return 'Name is required';
  if (trimmed.length > MAX_NAME_LENGTH) return `Name must be ${MAX_NAME_LENGTH} characters or fewer`;
  const lower = trimmed.toLowerCase();
  if (takenNames.some((n) => n.trim().toLowerCase() === lower)) return 'A category with that name already exists';
  return null;
}
