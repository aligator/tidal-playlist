import { afterEach, describe, expect, it } from 'vitest';
import { loadSettings } from './settings.ts';
import { SETTINGS_KEY } from './shared.ts';

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
};

function createStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

const originalStorage = (globalThis as { localStorage?: StorageLike }).localStorage;

afterEach(() => {
  if (originalStorage) {
    (globalThis as { localStorage?: StorageLike }).localStorage = originalStorage;
  } else {
    delete (globalThis as { localStorage?: StorageLike }).localStorage;
  }
});

describe('loadSettings', () => {
  it('falls back to default count when persisted count is invalid', () => {
    const localStorage = createStorage();
    (globalThis as { localStorage?: StorageLike }).localStorage = localStorage;
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        count: 'NaN',
      }),
    );

    const loaded = loadSettings();
    expect(loaded.count).toBe(25);
  });

  it('keeps persisted count when valid integer', () => {
    const localStorage = createStorage();
    (globalThis as { localStorage?: StorageLike }).localStorage = localStorage;
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        count: 42,
      }),
    );

    const loaded = loadSettings();
    expect(loaded.count).toBe(42);
  });
});
