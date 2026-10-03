/**
 * Screen Wake Lock helper.
 *
 * A browser tab is throttled and eventually suspended once the phone screen
 * turns off, which stalls a running build or save. Holding a screen wake lock
 * for the duration keeps the work alive. The lock is reference counted so a
 * build and a save can overlap, and it is re-acquired on `visibilitychange`
 * because the browser drops it whenever the document becomes hidden.
 */

type WakeLockSentinelLike = {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>;
  };
};

let holders = 0;
let sentinel: WakeLockSentinelLike | null = null;
let listenerAttached = false;

function wakeLockApi() {
  return (navigator as WakeLockNavigator).wakeLock;
}

async function acquire(): Promise<void> {
  const api = wakeLockApi();
  if (!api) {
    return;
  }
  if (sentinel && !sentinel.released) {
    return;
  }
  if (document.visibilityState !== 'visible') {
    return;
  }

  try {
    const next = await api.request('screen');
    next.addEventListener('release', () => {
      if (sentinel === next) {
        sentinel = null;
      }
    });
    sentinel = next;
  } catch {
    sentinel = null;
  }
}

function onVisibilityChange(): void {
  if (holders > 0 && document.visibilityState === 'visible') {
    void acquire();
  }
}

/**
 * Runs `task` while holding a screen wake lock. The lock is always released
 * afterwards, including when `task` throws. Resolves to whatever `task`
 * returns. On browsers without the API this is a plain pass-through.
 */
export async function withScreenWakeLock<T>(task: () => Promise<T>): Promise<T> {
  holders += 1;

  if (!listenerAttached) {
    document.addEventListener('visibilitychange', onVisibilityChange);
    listenerAttached = true;
  }

  await acquire();

  try {
    return await task();
  } finally {
    holders -= 1;
    if (holders <= 0) {
      holders = 0;
      const current = sentinel;
      sentinel = null;
      if (current && !current.released) {
        await current.release().catch(() => {});
      }
    }
  }
}
