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

/** Validation result for a single entry, or null when it is fine. */
export function validateEntry(entry: WordEntry, seenWords: Set<string>): string | null {
  const word = entry.word.trim();
  if (!word) return 'Word is required';
  const tooLong = [word, entry.hint.trim(), entry.decoy.trim()].find((p) => p.length > MAX_PART_LENGTH);
  if (tooLong !== undefined) return `Each part must be ${MAX_PART_LENGTH} characters or fewer`;
  if (seenWords.has(word.toLowerCase())) return `"${word}" is already in this category`;
  return null;
}

export interface EntryError {
  /** 0-based index into the entries array passed in. */
  index: number;
  message: string;
}

/**
 * Validates a list of entries as typed in the editor. Entries that are
 * completely blank are ignored (like blank lines). Returns the cleaned,
 * trimmed entries that passed, errors by index, and whether the set is saveable.
 */
export function validateEntries(input: WordEntry[]): { entries: WordEntry[]; errors: EntryError[]; valid: boolean } {
  const entries: WordEntry[] = [];
  const errors: EntryError[] = [];
  const seen = new Set<string>();
  input.forEach((raw, index) => {
    const e = { word: raw.word.trim(), hint: raw.hint.trim(), decoy: raw.decoy.trim() };
    if (!e.word && !e.hint && !e.decoy) return;
    const message = validateEntry(e, seen);
    if (message) {
      errors.push({ index, message });
      return;
    }
    seen.add(e.word.toLowerCase());
    entries.push(e);
  });
  return { entries, errors, valid: errors.length === 0 && entries.length >= MIN_WORDS };
}

/**
 * Parses `word | hint | decoy` lines. Hint and decoy are optional.
 * Blank lines are ignored. Errors are reported per line.
 */
export function parseWordLines(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const rows: { line: number; entry: WordEntry }[] = [];
  const errors: LineError[] = [];
  lines.forEach((raw, i) => {
    const line = i + 1;
    if (raw.trim() === '') return;
    const parts = raw.split('|').map((p) => p.trim());
    if (parts.length > 3) {
      errors.push({ line, message: 'Use at most three parts: word | hint | decoy' });
      return;
    }
    const [word = '', hint = '', decoy = ''] = parts;
    rows.push({ line, entry: { word, hint, decoy } });
  });
  const result = validateEntries(rows.map((r) => r.entry));
  for (const e of result.errors) errors.push({ line: rows[e.index].line, message: e.message });
  errors.sort((a, b) => a.line - b.line);
  const valid = errors.length === 0 && result.entries.length >= MIN_WORDS;
  return { entries: result.entries, errors, valid };
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
