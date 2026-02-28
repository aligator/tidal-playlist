import { describe, expect, it } from 'vitest';
import { PlaylistBuilder } from './playlist-builder.ts';
import type { AlbumPoolEntryResolved, AppSettings } from '../types.ts';

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    countryCode: 'US',
    playlistName: 'mix',
    playlistDescription: 'mix',
    count: 2,
    albumPoolWeight: 0.2,
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
    ...overrides,
  };
}

describe('PlaylistBuilder', () => {
  it('handles artist-only pool', async () => {
    const logs: string[] = [];
    const builder = new PlaylistBuilder({
      api: {
        favoriteArtistIds: () => Promise.resolve([]),
        favoriteAlbumIds: () => Promise.resolve([]),
        resolveAlbumPoolEntries: () => Promise.resolve([]),
        primaryArtistFromAlbum: () => Promise.resolve(null),
        artist: (artistId) => Promise.resolve({ id: artistId, attributes: { name: 'Artist One' } }),
        artistAlbums: () => Promise.resolve([{ id: 'album-1', title: 'Album One' }]),
        albumTracks: () => Promise.resolve([{ id: 'track-1', title: 'Track One' }]),
      },
      logger: (message) => logs.push(message),
      randomPickWithReplacement: (items, count) => new Array(count).fill(items[0]),
      sleep: async () => {},
      requestGapMs: 0,
    });

    const result = await builder.build(settings({ poolArtists: 'artist-1', count: 2 }));
    expect(result.trackIds).toEqual(['track-1', 'track-1']);
    expect(result.selectedSongs.length).toBe(2);
    expect(result.diagnostics.unresolvedAlbumInputs).toEqual([]);
    expect(logs.some((line) => line.includes('Collected 2 tracks.'))).toBe(true);
  });

  it('resolves album-only pools and reports unresolved entries once', async () => {
    const logs: string[] = [];
    const resolvedAlbums: AlbumPoolEntryResolved[] = [{
      source: 'title',
      raw: 'Good Album',
      albumId: 'album-good',
      title: 'Good Album',
      artistId: 'artist-2',
      artistName: 'Artist Two',
    }];
    const builder = new PlaylistBuilder({
      api: {
        favoriteArtistIds: () => Promise.resolve([]),
        favoriteAlbumIds: () => Promise.resolve([]),
        resolveAlbumPoolEntries: () => Promise.resolve(resolvedAlbums),
        primaryArtistFromAlbum: () => Promise.resolve({ id: 'artist-2', name: 'Artist Two' }),
        artist: () => Promise.resolve({ id: '', attributes: { name: '' } }),
        artistAlbums: () => Promise.resolve([]),
        albumTracks: () => Promise.resolve([{ id: 'track-2', title: 'Track Two' }]),
      },
      logger: (message) => logs.push(message),
      randomPickWithReplacement: (items, count) => new Array(count).fill(items[0]),
      sleep: async () => {},
      requestGapMs: 0,
    });

    const result = await builder.build(
      settings({ poolAlbums: 'Good Album\nMissing Album', count: 1 }),
    );
    expect(result.trackIds).toEqual(['track-2']);
    expect(result.diagnostics.unresolvedAlbumInputs).toEqual(['Missing Album']);
    expect(logs.some((line) => line.includes('Unresolved album entries skipped'))).toBe(true);
  });

  it('keeps album blacklist filtering in artist flow', async () => {
    const builder = new PlaylistBuilder({
      api: {
        favoriteArtistIds: () => Promise.resolve([]),
        favoriteAlbumIds: () => Promise.resolve([]),
        resolveAlbumPoolEntries: () => Promise.resolve([]),
        primaryArtistFromAlbum: () => Promise.resolve(null),
        artist: (artistId) => Promise.resolve({ id: artistId, attributes: { name: artistId } }),
        artistAlbums: () =>
          Promise.resolve([
            { id: 'blocked-id', title: 'Blocked Album' },
            { id: 'good-id', title: 'Good Album' },
          ]),
        albumTracks: (albumId) => Promise.resolve([{ id: `${albumId}-track`, title: 'Track' }]),
      },
      logger: () => {},
      randomPickWithReplacement: (items, count) => new Array(count).fill(items[0]),
      sleep: async () => {},
      requestGapMs: 0,
    });

    const previousRandom = Math.random;
    Math.random = () => 0;
    try {
      const result = await builder.build(
        settings({
          poolArtists: 'artist-3',
          albumBlacklist: 'Blocked Album',
          count: 1,
        }),
      );
      expect(result.selectedSongs[0]?.albumId).toBe('good-id');
      expect(result.trackIds).toEqual(['good-id-track']);
    } finally {
      Math.random = previousRandom;
    }
  });
});
