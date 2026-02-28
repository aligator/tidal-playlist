import { describe, expect, it } from 'vitest';
import { TidalApi } from './api.ts';
import type { AppSettings, ItemMetaMap } from '../types.ts';

function settings(): AppSettings {
  return {
    countryCode: 'US',
    playlistName: 'x',
    playlistDescription: 'x',
    count: 2,
    includeLikedArtistsPool: false,
    includeLikedAlbumsPool: false,
    poolArtists: '',
    poolAlbums: '',
    blacklist: '',
    albumBlacklist: '',
    artistPoolMeta: {},
    artistBlacklistMeta: {},
    albumPoolMeta: {},
    albumBlacklistMeta: {},
  };
}

function testApi(client: unknown): TidalApi {
  const api = Object.create(TidalApi.prototype) as TidalApi;
  (api as unknown as { settings: AppSettings }).settings = settings();
  (api as unknown as { client: unknown }).client = client;
  return api;
}

function ok(data: unknown) {
  return Promise.resolve({ data, response: new Response('', { status: 200 }) });
}

function error(status = 404) {
  return Promise.resolve({
    error: { message: 'not found' },
    response: new Response('', { status }),
  });
}

describe('TidalApi', () => {
  it('searchAlbums derives artist names from included relationships without extra album calls', async () => {
    let albumGetCalls = 0;

    const client = {
      GET: (path: string) => {
        if (path === '/albums/{id}') {
          albumGetCalls += 1;
          return error();
        }
        if (path === '/searchResults/{id}') {
          return ok({
            included: [
              {
                type: 'artists',
                id: 'artist-1',
                attributes: { name: 'Artist One' },
              },
              {
                type: 'albums',
                id: 'album-1',
                attributes: { title: 'Record One' },
                relationships: { artists: { data: [{ type: 'artists', id: 'artist-1' }] } },
              },
            ],
          });
        }
        return error();
      },
    };

    const api = testApi(client);
    const rows = await api.searchAlbums('record', 10);
    expect(rows).toEqual([{ id: 'album-1', title: 'Record One', artistName: 'Artist One' }]);
    expect(albumGetCalls).toBe(0);
  });

  it('resolveAlbumPoolEntries resolves direct IDs and exact-title matches with artist tie-break', async () => {
    const meta: ItemMetaMap = {
      'blue sky': { label: 'Blue Sky', subLabel: 'Artist B' },
    };

    const client = {
      GET: (path: string, options?: { params?: { path?: Record<string, string> } }) => {
        if (path === '/albums/{id}') {
          const id = options?.params?.path?.id ?? '';
          if (id === 'album-id-1') {
            return ok({
              data: {
                type: 'albums',
                id: 'album-id-1',
                attributes: { title: 'First Album' },
              },
              included: [
                {
                  type: 'artists',
                  id: 'artist-1',
                  attributes: { name: 'Artist A' },
                },
              ],
            });
          }
          return error();
        }
        if (path === '/searchResults/{id}') {
          const query = options?.params?.path?.id ?? '';
          if (query === 'Blue Sky') {
            return ok({
              included: [
                { type: 'artists', id: 'artist-a', attributes: { name: 'Artist A' } },
                { type: 'artists', id: 'artist-b', attributes: { name: 'Artist B' } },
                {
                  type: 'albums',
                  id: 'album-a',
                  attributes: { title: 'Blue Sky' },
                  relationships: { artists: { data: [{ type: 'artists', id: 'artist-a' }] } },
                },
                {
                  type: 'albums',
                  id: 'album-b',
                  attributes: { title: 'Blue Sky' },
                  relationships: { artists: { data: [{ type: 'artists', id: 'artist-b' }] } },
                },
              ],
            });
          }
          return ok({ included: [] });
        }
        return error();
      },
    };

    const api = testApi(client);
    const resolved = await api.resolveAlbumPoolEntries(['album-id-1', 'Blue Sky', 'Unknown'], meta);
    expect(resolved).toEqual([
      {
        source: 'id',
        raw: 'album-id-1',
        albumId: 'album-id-1',
        title: 'First Album',
        artistId: 'artist-1',
        artistName: 'Artist A',
      },
      {
        source: 'title',
        raw: 'Blue Sky',
        albumId: 'album-b',
        title: 'Blue Sky',
        artistId: 'artist-b',
        artistName: 'Artist B',
      },
    ]);
  });
});
