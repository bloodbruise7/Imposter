import data from '../data/categories.json';
import type { Category, ClueMode, Mode, Settings, TimerMinutes } from '../game/types';
import { MAX_PLAYERS, MIN_PLAYERS, clampImposters } from '../game/imposters';
import { KEYS, store } from '../storage/storage';

export const BUILTIN: Category[] = data.categories as Category[];

export const TIMER_OPTIONS: TimerMinutes[] = [0, 1, 2, 3, 5];

export const DEFAULT_SETTINGS: Settings = {
  imposters: 1,
  mode: 'classic',
  clue: 'category-hint',
  categoryIds: BUILTIN.map((c) => c.id),
  timerMinutes: 2,
  trollMode: false,
};

export interface SavedPlayers {
  count: number;
  /** Raw names as typed, index = entry order. May be longer than count. */
  names: string[];
}

export interface ActiveGame {
  players: string[];
  settings: Settings;
  scores: number[];
  playedIds: string[];
  /** Number of completed rounds (the round shown on the last scoreboard). */
  round: number;
  /** Points from the last completed round, so Resume can show them. */
  lastPoints?: number[];
  /** Rounds since each player was last the imposter; drives the fairness weighting. */
  droughts?: number[];
  /** One entry per completed round, oldest first. */
  history?: RoundRecord[];
}

export interface RoundRecord {
  round: number;
  word: string;
  category: string;
  /** Decoy shown to imposters in Undercover; absent in Classic. */
  decoy?: string;
  /** Imposter names, with whether each was caught. Empty in a troll round. */
  imposters: { name: string; caught: boolean; guessed?: boolean }[];
  troll: boolean;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isNumberArray = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => typeof x === 'number');

export function loadPlayers(): SavedPlayers {
  const v = store.get<unknown>(KEYS.players);
  if (isRecord(v) && typeof v.count === 'number' && isStringArray(v.names)) {
    const count = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.round(v.count)));
    return { count, names: v.names };
  }
  return { count: 4, names: [] };
}

export function sanitizeSettings(v: unknown): Settings {
  if (!isRecord(v)) return DEFAULT_SETTINGS;
  const mode: Mode = v.mode === 'undercover' ? 'undercover' : 'classic';
  const clue: ClueMode = v.clue === 'category' || v.clue === 'none' ? v.clue : 'category-hint';
  const timer = TIMER_OPTIONS.includes(v.timerMinutes as TimerMinutes)
    ? (v.timerMinutes as TimerMinutes)
    : DEFAULT_SETTINGS.timerMinutes;
  return {
    imposters: typeof v.imposters === 'number' ? Math.max(1, Math.round(v.imposters)) : 1,
    mode,
    clue,
    categoryIds: isStringArray(v.categoryIds) ? v.categoryIds : DEFAULT_SETTINGS.categoryIds,
    timerMinutes: timer,
    trollMode: v.trollMode === true,
  };
}

export function loadSettings(): Settings {
  return sanitizeSettings(store.get<unknown>(KEYS.settings));
}

export function loadCustomCategories(): Category[] {
  const v = store.get<unknown>(KEYS.customCategories);
  if (!Array.isArray(v)) return [];
  return v.filter(
    (c): c is Category =>
      isRecord(c) &&
      typeof c.id === 'string' &&
      typeof c.name === 'string' &&
      Array.isArray(c.words) &&
      c.words.every((w) => isRecord(w) && typeof w.word === 'string'),
  ).map((c) => ({
    id: c.id,
    name: c.name,
    icon: typeof c.icon === 'string' && c.icon.trim() ? c.icon : '📝',
    words: c.words.map((w) => ({ word: w.word, hint: String(w.hint ?? ''), decoy: String(w.decoy ?? '') })),
  }));
}

export function saveCustomCategories(list: Category[]): void {
  store.set(KEYS.customCategories, list);
}

export function loadActiveGame(): ActiveGame | null {
  const v = store.get<unknown>(KEYS.activeGame);
  if (
    isRecord(v) &&
    isStringArray(v.players) &&
    isNumberArray(v.scores) &&
    isStringArray(v.playedIds) &&
    typeof v.round === 'number' &&
    v.players.length === v.scores.length &&
    v.players.length >= MIN_PLAYERS
  ) {
    const settings = sanitizeSettings(v.settings);
    return {
      players: v.players,
      settings: { ...settings, imposters: clampImposters(settings.imposters, v.players.length) },
      scores: v.scores,
      playedIds: v.playedIds,
      round: v.round,
      lastPoints: isNumberArray(v.lastPoints) && v.lastPoints.length === v.players.length ? v.lastPoints : undefined,
      droughts: isNumberArray(v.droughts) && v.droughts.length === v.players.length ? v.droughts : undefined,
      history: Array.isArray(v.history)
        ? v.history.filter(
            (h): h is RoundRecord =>
              isRecord(h) && typeof h.round === 'number' && typeof h.word === 'string' && Array.isArray(h.imposters),
          )
        : undefined,
    };
  }
  return null;
}

export function saveActiveGame(game: ActiveGame): void {
  store.set(KEYS.activeGame, game);
}

export function clearActiveGame(): void {
  store.remove(KEYS.activeGame);
}

/** Trimmed names with blanks replaced by "Player N". */
export function effectiveNames(names: string[], count: number): string[] {
  return Array.from({ length: count }, (_, i) => (names[i] ?? '').trim() || `Player ${i + 1}`);
}

/** Lower-cased names that appear more than once. */
export function duplicateNames(names: string[]): Set<string> {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const n of names) {
    const k = n.toLowerCase();
    if (seen.has(k)) dupes.add(k);
    seen.add(k);
  }
  return dupes;
}
