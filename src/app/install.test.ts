import { describe, expect, it } from 'vitest';
import { PROMPT_INTERVAL_MS, shouldPromptInstall } from './install';

describe('shouldPromptInstall', () => {
  const now = 1_800_000_000_000;

  it('prompts on first load when not installed', () => {
    expect(shouldPromptInstall(null, now, false)).toBe(true);
    expect(shouldPromptInstall({}, now, false)).toBe(true);
  });

  it('never prompts when installed', () => {
    expect(shouldPromptInstall(null, now, true)).toBe(false);
    expect(shouldPromptInstall({ lastShown: 0 }, now, true)).toBe(false);
  });

  it('never prompts after "do not ask again"', () => {
    expect(shouldPromptInstall({ never: true }, now, false)).toBe(false);
    expect(shouldPromptInstall({ never: true, lastShown: 0 }, now, false)).toBe(false);
  });

  it('waits 24 hours between prompts', () => {
    expect(shouldPromptInstall({ lastShown: now - PROMPT_INTERVAL_MS + 1 }, now, false)).toBe(false);
    expect(shouldPromptInstall({ lastShown: now - PROMPT_INTERVAL_MS }, now, false)).toBe(true);
    expect(shouldPromptInstall({ lastShown: now - 2 * PROMPT_INTERVAL_MS }, now, false)).toBe(true);
  });
});
