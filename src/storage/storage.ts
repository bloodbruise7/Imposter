export const KEYS = {
  players: 'imposter.v1.players',
  settings: 'imposter.v1.settings',
  customCategories: 'imposter.v1.customCategories',
  activeGame: 'imposter.v1.activeGame',
} as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Store {
  get<T>(key: string): T | null;
  set(key: string, value: unknown): void;
  remove(key: string): void;
}

/**
 * JSON storage over a StorageLike backend. Every call is guarded: if the
 * backend throws (private browsing, quota), the value lives in memory instead
 * and the app keeps running. Unparseable stored JSON is removed and treated as absent.
 */
export function createStore(backend: StorageLike | null | undefined): Store {
  const memory = new Map<string, string>();

  const read = (key: string): string | null => {
    if (backend) {
      try {
        const v = backend.getItem(key);
        if (v !== null) return v;
      } catch {
        /* fall through to memory */
      }
    }
    return memory.get(key) ?? null;
  };

  const write = (key: string, value: string) => {
    memory.set(key, value);
    if (backend) {
      try {
        backend.setItem(key, value);
      } catch {
        /* memory already holds it */
      }
    }
  };

  const remove = (key: string) => {
    memory.delete(key);
    if (backend) {
      try {
        backend.removeItem(key);
      } catch {
        /* nothing else to do */
      }
    }
  };

  return {
    get<T>(key: string): T | null {
      const raw = read(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        remove(key);
        return null;
      }
    },
    set(key, value) {
      write(key, JSON.stringify(value));
    },
    remove,
  };
}

function detectLocalStorage(): StorageLike | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = '__imposter_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

/** The app's single store. Reads localStorage where usable, memory otherwise. */
export const store: Store = createStore(detectLocalStorage());
