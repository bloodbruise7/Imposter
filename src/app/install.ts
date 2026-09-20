import { store } from '../storage/storage';

export const INSTALL_KEY = 'imposter.v1.installPrompt';
export const PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface InstallPromptState {
  /** Epoch ms of the last time the prompt was shown. */
  lastShown?: number;
  /** True once the player ticked "Don't ask me again". */
  never?: boolean;
}

/** Whether the app is running as an installed app rather than in a browser tab. */
export function isInstalled(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
    if (window.matchMedia?.('(display-mode: fullscreen)').matches) return true;
    const nav = navigator as Navigator & { standalone?: boolean };
    return nav.standalone === true;
  } catch {
    return false;
  }
}

/** iPhones and iPads have no install API; they need the Share sheet instructions. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iPadDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadDesktopMode;
}

/**
 * Show the prompt when the app isn't installed, the player hasn't opted out,
 * and it's been at least 24 hours since the last time (or never).
 */
export function shouldPromptInstall(state: InstallPromptState | null, now: number, installed: boolean): boolean {
  if (installed) return false;
  if (state?.never) return false;
  if (state?.lastShown === undefined) return true;
  return now - state.lastShown >= PROMPT_INTERVAL_MS;
}

export function loadInstallState(): InstallPromptState | null {
  const v = store.get<unknown>(INSTALL_KEY);
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  return {
    lastShown: typeof o.lastShown === 'number' ? o.lastShown : undefined,
    never: o.never === true,
  };
}

export function saveInstallState(state: InstallPromptState): void {
  store.set(INSTALL_KEY, state);
}

/** The event Chrome-based browsers fire when the app is installable. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
