import { describe, expect, it } from 'vitest';
import { PlaylistBuilder } from './builder.ts';
import type { PlaylistBuilderApi } from './builder.ts';
import type { AppSettings } from '../../types.ts';

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    countryCode: 'US',
    playlistName: 'Test',
    playlistDescription: '',
    count: 3,
    shufflePlaylist: false,
    includeLikedArtistsPool: false,
    includeLikedAlbumsPool: false,
    poolArtists: ['artist1', 'artist2'],
    poolAlbums: [],
    blacklistedArtists: [],
    blacklistedAlbums: [],
    artistPoolMeta: {},
    artistBlacklistMeta: {},
    albumPoolMeta: {},
    albumBlacklistMeta: {},
    ...overrides,
  };
}

function makeApi(overrides: Partial<PlaylistBuilderApi> = {}): PlaylistBuilderApi {
  return {
    favoriteArtistIds: () => Promise.resolve([]),
    favoriteAlbumIds: () => Promise.resolve([]),
    resolveAlbumPoolEntries: () => Promise.resolve([]),
    primaryArtistFromAlbum: () => Promise.resolve(null),
    artist: (id) => Promise.resolve({ id, attributes: { name: `Artist ${id}` } }),
    artistAlbums: (id) => Promise.resolve([{ id: `album-${id}`, title: `Album of ${id}` }]),
    albumTracks: (id) =>
      Promise.resolve([
        { id: `track-${id}-1`, title: 'Track 1' },
        { id: `track-${id}-2`, title: 'Track 2' },
      ]),
    ...overrides,
  };
}

function makeBuilder(api: PlaylistBuilderApi): PlaylistBuilder {
  return new PlaylistBuilder({
    api,
    logger: () => {},
    randomPickWithReplacement: (items, count) => Array(count).fill(items[0]),
    sleep: async () => {},
    requestGapMs: 0,
  });
}

describe('PlaylistBuilder', () => {
  it('builds a playlist with the requested track count', async () => {
    const builder = makeBuilder(makeApi());
    const result = await builder.build(makeSettings({ count: 3 }));
    expect(result.trackIds).toHaveLength(3);
    expect(result.selectedSongs).toHaveLength(3);
  });

  it('throws when pool is empty', async () => {
    const builder = makeBuilder(makeApi());
    await expect(
      builder.build(makeSettings({ poolArtists: [], poolAlbums: [] })),
    ).rejects.toThrow('Pool is empty');
  });

  it('throws for count < 1', async () => {
    const builder = makeBuilder(makeApi());
    await expect(builder.build(makeSettings({ count: 0 }))).rejects.toThrow(
      'Track count must be at least 1',
    );
  });

  it('throws when no tracks collected', async () => {
    const api = makeApi({ albumTracks: () => Promise.resolve([]) });
    const builder = makeBuilder(api);
    await expect(builder.build(makeSettings({ count: 1 }))).rejects.toThrow('No tracks collected');
  });

  it('includes diagnostics', async () => {
    const builder = makeBuilder(makeApi());
    const result = await builder.build(makeSettings({ count: 2 }));
    expect(result.diagnostics.artistPoolCount).toBeGreaterThan(0);
    expect(result.diagnostics.skippedNoAlbums).toBe(0);
  });

  it('respects artist blacklist', async () => {
    const api = makeApi({
      artist: (id) => Promise.resolve({ id, attributes: { name: id } }),
      artistAlbums: (id) => Promise.resolve([{ id: `album-${id}`, title: `Album ${id}` }]),
      albumTracks: (id) => Promise.resolve([{ id: `track-${id}`, title: 'T' }]),
    });
    const builder = makeBuilder(api);
    const result = await builder.build(
      makeSettings({ poolArtists: ['artist1', 'artist2'], blacklistedArtists: ['artist1'], count: 2 }),
    );
    expect(result.selectedSongs.every((s) => s.artistId !== 'artist1')).toBe(true);
  });
});
