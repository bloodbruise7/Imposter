export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;

/** max imposters = floor((players - 1) / 3), never below 1. */
export function maxImposters(players: number): number {
  return Math.max(1, Math.floor((players - 1) / 3));
}

export function clampImposters(imposters: number, players: number): number {
  return Math.min(Math.max(1, imposters), maxImposters(players));
}
