import { afterEach, describe, expect, it, vi } from 'vitest';
import { TidalApi } from './api.ts';
import type { AppSettings } from '../../types.ts';

type ClientResult = { data?: unknown; error?: unknown; response: Response };

function apiWithClient(
  results: ClientResult[],
  fallback: () => ClientResult,
): { api: TidalApi; calls: () => number } {
  const queue = [...results];
  let calls = 0;
  const next = () => {
    calls++;
    return Promise.resolve(queue.shift() ?? fallback());
  };

  const api = new TidalApi({ countryCode: 'DE' } as AppSettings);
  // deno-lint-ignore no-explicit-any
  (api as any).client = { GET: next, POST: next, DELETE: next };
  return { api, calls: () => calls };
}

const throttled = (): ClientResult => ({ response: new Response(null, { status: 429 }) });
const ok = (data: unknown): ClientResult => ({
  data,
  response: new Response(null, { status: 200 }),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TidalApi rate limiting', () => {
  it('retries a throttled read and returns the eventual payload', async () => {
    vi.stubGlobal('setTimeout', (fn: () => void) => fn());
    const { api, calls } = apiWithClient(
      [throttled(), throttled(), ok({ data: { id: '200280562', type: 'users' } })],
      () => ok({ data: [] }),
    );

    await expect(api.userPlaylists()).resolves.toEqual([]);
    expect(calls()).toBe(4);
  });

  it('fails a write that stays throttled instead of reporting success', async () => {
    vi.stubGlobal('setTimeout', (fn: () => void) => fn());
    const { api, calls } = apiWithClient([], throttled);

    await expect(api.addPlaylistTracks('playlist-1', ['1'])).rejects.toThrow('TIDAL API 429');
    expect(calls()).toBe(4);
  });

  it('fails a write on any error status without an error body', async () => {
    const { api } = apiWithClient([], () => ({ response: new Response(null, { status: 500 }) }));

    await expect(api.deletePlaylist('playlist-1')).rejects.toThrow('TIDAL API 500');
  });
});
