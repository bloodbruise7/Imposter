import { describe, expect, it } from 'vitest';
import { createStore, type StorageLike } from './storage';

function fakeBackend(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('createStore', () => {
  it('returns saved values', () => {
    const s = createStore(fakeBackend());
    s.set('k', { a: 1, b: ['x'] });
    expect(s.get('k')).toEqual({ a: 1, b: ['x'] });
    expect(s.get('missing')).toBeNull();
  });

  it('removes unparseable values and treats them as absent', () => {
    const b = fakeBackend();
    b.data.set('bad', '{not json');
    const s = createStore(b);
    expect(s.get('bad')).toBeNull();
    expect(b.data.has('bad')).toBe(false);
  });

  it('falls back to memory without throwing when the backend throws on every call', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    const s = createStore(throwing);
    expect(() => s.set('k', 42)).not.toThrow();
    expect(s.get('k')).toBe(42);
    expect(() => s.remove('k')).not.toThrow();
    expect(s.get('k')).toBeNull();
  });

  it('works with no backend at all', () => {
    const s = createStore(null);
    s.set('k', 'v');
    expect(s.get('k')).toBe('v');
  });
});
