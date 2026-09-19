export interface WordEntry {
  word: string;
  hint: string;
  decoy: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  words: WordEntry[];
}

export type Mode = 'classic' | 'undercover';
export type ClueMode = 'category' | 'category-hint' | 'none';
export type TimerMinutes = 0 | 1 | 2 | 3 | 5;

export interface Settings {
  imposters: number;
  mode: Mode;
  clue: ClueMode;
  categoryIds: string[];
  timerMinutes: TimerMinutes;
  trollMode: boolean;
}

/** A word drawn from the combined pool; `id` is `categoryId + "::" + word`. */
export interface PoolWord {
  id: string;
  categoryId: string;
  categoryName: string;
  word: string;
  hint: string;
  decoy: string;
}
