import { createAPIClient } from '@tidal-music/api';
import { credentialsProvider as sdkCredentialsProvider } from '@tidal-music/auth';
import { refreshAccessToken } from '../auth/api.ts';
import { handleAuthFailure } from '../auth/store.ts';
import type {
  AlbumPoolEntryResolved,
  AppSettings,
  ItemMetaMap,
  PlaylistSummary,
  SelectedSong,
  TidalAlbum,
  TidalArtist,
  TidalTrack,
} from '../../types.ts';
import { asObject, asString } from './shared.ts';
import type { JsonObject } from './shared.ts';
import { normalizeTextMatch, uniqueCaseInsensitive } from './list-utils.ts';

type ApiResult<T> = {
  data?: T;
  error?: unknown;
  response: Response;
};

type JsonLike = JsonObject & {
  data?: unknown;
  included?: unknown;
  links?: unknown;
};

export class TidalApi {
  private settings: AppSettings;
  private client: ReturnType<typeof createAPIClient>;

  constructor(settings: AppSettings) {
    this.settings = settings;
    this.client = createAPIClient(sdkCredentialsProvider);
  }

  updateSettings(settings: AppSettings): void {
    this.settings = settings;
  }

  private unwrap<T>(result: ApiResult<T>): T {
    if (result.error) {
      throw new Error(
        `TIDAL API ${result.response.status}: ${JSON.stringify(result.error)}`,
      );
    }
    if (!result.data) {
      throw new Error('TIDAL API returned no data.');
    }
    return result.data;
  }

  private async call<T>(fn: () => Promise<ApiResult<T>>): Promise<T> {
    const first = await fn();
    if (first.response.status !== 401) {
      return this.unwrap(first);
    }
    try {
      await refreshAccessToken();
    } catch {
      handleAuthFailure();
      throw new Error('Session expired. Please log in again.');
    }
    return this.unwrap(await fn());
  }

  private ensureWriteSucceeded(result: ApiResult<unknown>): void {
    if (result.error) {
      throw new Error(
        `TIDAL API ${result.response.status}: ${JSON.stringify(result.error)}`,
      );
    }
  }

  private included(doc: JsonLike): JsonObject[] {
    const raw = Array.isArray(doc.included) ? doc.included : [];
    return raw.map((entry) => asObject(entry)).filter(
      (entry): entry is JsonObject => entry !== null,
    );
  }

  private byType(entries: JsonObject[], type: string): JsonObject[] {
    return entries.filter(
      (entry) => entry.type === type && typeof entry.id === 'string',
    );
  }

  private albumRowsFromIncluded(
    included: JsonObject[],
  ): Array<{ id: string; title: string; artistName: string; artistId: string }> {
    const artistsById = new Map<string, string>();
    for (const artistEntry of this.byType(included, 'artists')) {
      const artistId = asString(artistEntry.id);
      if (!artistId) {
        continue;
      }
      const artistAttributes = asObject(artistEntry.attributes);
      artistsById.set(artistId, asString(artistAttributes?.name, artistId));
    }

    return this.byType(included, 'albums').map((albumEntry) => {
      const attributes = asObject(albumEntry.attributes);
      const relationships = asObject(albumEntry.relationships);
      const artistsRel = asObject(relationships?.artists);
      const relData = Array.isArray(artistsRel?.data) ? artistsRel.data : [];
      const firstRelArtist = asObject(relData[0]);
      const artistId = asString(firstRelArtist?.id);
      const artistName = artistId ? (artistsById.get(artistId) ?? '') : '';

      return {
        id: asString(albumEntry.id),
        title: asString(attributes?.title, asString(albumEntry.id)),
        artistId,
        artistName,
      };
    });
  }

  private async getUserId(): Promise<string> {
    const data = await this.call(() => this.client.GET('/users/me', { parseAs: 'json' }));
    const user = asObject((data as JsonObject).data);
    const userId = user?.id;
    if (typeof userId !== 'string' || !userId) {
      throw new Error('No user id returned by /v2/users/me');
    }
    return userId;
  }

  private async favoriteCollectionIds(
    type: 'artists' | 'albums',
  ): Promise<string[]> {
    const userId = await this.getUserId();
    const all: string[] = [];
    let cursor = '';

    for (;;) {
      const makeRequest = type === 'artists'
        ? () => this.client.GET('/userCollections/{id}/relationships/artists', {
          params: {
            path: { id: userId },
            query: {
              'page[cursor]': cursor || undefined,
              countryCode: this.settings.countryCode,
            },
          },
        })
        : () => this.client.GET('/userCollections/{id}/relationships/albums', {
          params: {
            path: { id: userId },
            query: {
              'page[cursor]': cursor || undefined,
              countryCode: this.settings.countryCode,
            },
          },
        });
      const page = await this.call(makeRequest) as JsonLike;

      const items = Array.isArray(page.data) ? page.data : [];
      for (const item of items) {
        const id = asObject(item)?.id;
        if (typeof id === 'string' && id) {
          all.push(id);
        }
      }

      const nextCursor = asString(asObject(asObject(page.links)?.meta)?.nextCursor);
      if (!nextCursor) {
        break;
      }
      cursor = nextCursor;
    }

    return all;
  }

  favoriteArtistIds(): Promise<string[]> {
    return this.favoriteCollectionIds('artists');
  }

  favoriteAlbumIds(): Promise<string[]> {
    return this.favoriteCollectionIds('albums');
  }

  async artist(artistId: string): Promise<TidalArtist> {
    const data = await this.call(() => this.client.GET('/artists/{id}', {
      params: {
        path: { id: artistId },
        query: { countryCode: this.settings.countryCode },
      },
    })) as JsonLike;

    const artist = asObject(data.data);
    const attributes = asObject(artist?.attributes);

    return {
      id: asString(artist?.id, artistId),
      attributes: {
        name: asString(attributes?.name, artistId),
      },
    };
  }

  async artistAlbums(artistId: string, limit = 100): Promise<TidalAlbum[]> {
    const data = await this.call(() => this.client.GET('/artists/{id}', {
      params: {
        path: { id: artistId },
        query: { include: ['albums'], countryCode: this.settings.countryCode },
      },
    })) as JsonLike;

    return this.byType(this.included(data), 'albums')
      .map((entry) => {
        const attributes = asObject(entry.attributes);
        return {
          id: asString(entry.id),
          title: asString(attributes?.title, asString(entry.id)),
        };
      })
      .slice(0, limit);
  }

  async albumTracks(albumId: string): Promise<TidalTrack[]> {
    const data = await this.call(() => this.client.GET('/albums/{id}', {
      params: {
        path: { id: albumId },
        query: { include: ['items'], countryCode: this.settings.countryCode },
      },
    })) as JsonLike;

    return this.byType(this.included(data), 'tracks').map((entry) => {
      const attributes = asObject(entry.attributes);
      return {
        id: asString(entry.id),
        title: asString(attributes?.title, asString(entry.id)),
      };
    });
  }

  async primaryArtistFromAlbum(
    albumId: string,
  ): Promise<{ id: string; name: string } | null> {
    try {
      const data = await this.call(() => this.client.GET('/albums/{id}', {
        params: {
          path: { id: albumId },
          query: {
            include: ['artists'],
            countryCode: this.settings.countryCode,
          },
        },
      })) as JsonLike;

      const artist = this.byType(this.included(data), 'artists')[0];
      const attributes = asObject(artist?.attributes);
      const id = asString(artist?.id);
      if (!id) {
        return null;
      }
      return {
        id,
        name: asString(attributes?.name, id),
      };
    } catch {
      return null;
    }
  }

  async searchArtists(
    query: string,
    limit = 30,
  ): Promise<Array<{ id: string; name: string }>> {
    const data = await this.call(() => this.client.GET('/searchResults/{id}/relationships/artists', {
      params: {
        path: { id: query },
        query: {
          countryCode: this.settings.countryCode,
          include: ['artists'],
        },
      },
    })) as JsonLike;

    return this.byType(this.included(data), 'artists')
      .map((entry) => {
        const attributes = asObject(entry.attributes);
        return {
          id: asString(entry.id),
          name: asString(attributes?.name, asString(entry.id)),
        };
      })
      .slice(0, limit);
  }

  async searchAlbums(
    query: string,
    limit = 30,
  ): Promise<Array<{ id: string; title: string; artistName: string }>> {
    const searchData = await this.call(() => this.client.GET('/searchResults/{id}', {
      params: {
        path: { id: query },
        query: {
          countryCode: this.settings.countryCode,
          include: ['albums'],
        },
      },
    })) as JsonLike;

    const searchAlbumEntries = this.byType(this.included(searchData), 'albums').slice(0, limit);
    const albumIds = searchAlbumEntries.map((a) => asString(a.id)).filter(Boolean);
    if (albumIds.length === 0) return [];

    const artistNameById = new Map<string, string>();
    const albumArtistIdMap = new Map<string, string>();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const batchResult = await (this.client as any).GET('/albums', {
        params: {
          query: {
            'filter[id]': albumIds,
            include: ['artists'],
            countryCode: this.settings.countryCode,
          },
        },
      });
      const batchData = batchResult.data as JsonLike | undefined;
      if (batchData) {
        for (const artist of this.byType(this.included(batchData), 'artists')) {
          const id = asString(artist.id);
          const name = asString(asObject(artist.attributes)?.name);
          if (id) artistNameById.set(id, name);
        }
        const batchAlbums = Array.isArray(batchData.data) ? batchData.data as JsonObject[] : [];
        for (const album of batchAlbums) {
          const albumId = asString(album.id);
          const rels = asObject(album.relationships);
          const artistsRel = asObject(rels?.artists);
          const relData = Array.isArray(artistsRel?.data) ? artistsRel.data : [];
          const artistId = asString(asObject(relData[0])?.id);
          if (albumId && artistId) albumArtistIdMap.set(albumId, artistId);
        }
      }
    } catch {
      // artist names best-effort — proceed without
    }

    return searchAlbumEntries.map((album) => {
      const albumId = asString(album.id);
      const attributes = asObject(album.attributes);
      const title = asString(attributes?.title, albumId);
      const artistId = albumArtistIdMap.get(albumId) ?? '';
      const artistName = artistId ? (artistNameById.get(artistId) ?? '') : '';
      return { id: albumId, title, artistName };
    });
  }

  async resolveAlbumPoolEntries(
    inputs: string[],
    metaMap: ItemMetaMap,
  ): Promise<AlbumPoolEntryResolved[]> {
    const cache = new Map<string, AlbumPoolEntryResolved | null>();
    const uniques = uniqueCaseInsensitive(inputs);
    const resolved: AlbumPoolEntryResolved[] = [];

    for (const raw of uniques) {
      const key = raw.toLowerCase();
      if (cache.has(key)) {
        const cached = cache.get(key);
        if (cached) {
          resolved.push(cached);
        }
        continue;
      }

      const next = await this.resolveAlbumPoolEntry(raw, metaMap[key]);
      cache.set(key, next);
      if (next) {
        resolved.push(next);
      }
    }

    return resolved;
  }

  private async resolveAlbumPoolEntry(
    raw: string,
    meta: { label: string; subLabel: string } | undefined,
  ): Promise<AlbumPoolEntryResolved | null> {
    const byId = await this.fetchAlbumById(raw);
    if (byId) {
      return {
        source: 'id',
        raw,
        albumId: byId.id,
        title: byId.title,
        artistId: byId.artistId || undefined,
        artistName: meta?.subLabel || byId.artistName || undefined,
      };
    }

    const data = await this.call(() => this.client.GET('/searchResults/{id}', {
      params: {
        path: { id: raw },
        query: {
          countryCode: this.settings.countryCode,
          include: ['albums', 'albums.artists'],
        },
      },
    })) as JsonLike;

    const rows = this.albumRowsFromIncluded(this.included(data));
    const targetTitle = normalizeTextMatch(raw);
    const exactTitleRows = rows.filter((row) => normalizeTextMatch(row.title) === targetTitle);
    if (exactTitleRows.length === 0) {
      return null;
    }

    const wantedArtist = normalizeTextMatch(meta?.subLabel ?? '');
    const match = wantedArtist
      ? exactTitleRows.find((row) => normalizeTextMatch(row.artistName) === wantedArtist)
      : exactTitleRows[0];
    if (!match) {
      return null;
    }

    return {
      source: 'title',
      raw,
      albumId: match.id,
      title: match.title || raw,
      artistId: match.artistId || undefined,
      artistName: match.artistName || meta?.subLabel || undefined,
    };
  }

  private async fetchAlbumById(
    albumId: string,
  ): Promise<{ id: string; title: string; artistId: string; artistName: string } | null> {
    try {
      const data = await this.call(() => this.client.GET('/albums/{id}', {
        params: {
          path: { id: albumId },
          query: {
            include: ['artists'],
            countryCode: this.settings.countryCode,
          },
        },
      })) as JsonLike;

      const albumData = asObject(data.data);
      const albumAttributes = asObject(albumData?.attributes);
      const artist = this.byType(this.included(data), 'artists')[0];
      const attributes = asObject(artist?.attributes);
      return {
        id: asString(albumData?.id, albumId),
        title: asString(albumAttributes?.title, albumId),
        artistId: asString(artist?.id),
        artistName: asString(attributes?.name, asString(artist?.id)),
      };
    } catch {
      return null;
    }
  }

  async getPlaylistTracks(playlistId: string): Promise<SelectedSong[]> {
    const data = await this.call(() => this.client.GET('/playlists/{id}', {
      params: {
        path: { id: playlistId },
        query: {
          include: ['items', 'items.artists', 'items.albums'],
          countryCode: this.settings.countryCode,
        },
      },
    })) as JsonLike;

    const inc = this.included(data);

    const artistsById = new Map<string, string>();
    for (const a of this.byType(inc, 'artists')) {
      const id = asString(a.id);
      const name = asString(asObject(a.attributes)?.name, id);
      if (id) artistsById.set(id, name);
    }

    const albumsById = new Map<string, string>();
    for (const al of this.byType(inc, 'albums')) {
      const id = asString(al.id);
      const title = asString(asObject(al.attributes)?.title, id);
      if (id) albumsById.set(id, title);
    }

    return this.byType(inc, 'tracks').map((track) => {
      const trackId = asString(track.id);
      const attributes = asObject(track.attributes);
      const trackTitle = asString(attributes?.title, trackId);

      const relationships = asObject(track.relationships);

      const artistsRel = asObject(relationships?.artists);
      const artistData = Array.isArray(artistsRel?.data) ? artistsRel.data : [];
      const firstArtist = asObject(artistData[0]);
      const artistId = asString(firstArtist?.id, '');
      const artistName = artistId ? (artistsById.get(artistId) ?? '') : '';

      const albumsRel = asObject(relationships?.albums);
      const albumData = Array.isArray(albumsRel?.data) ? albumsRel.data : [];
      const firstAlbum = asObject(albumData[0]);
      const albumId = asString(firstAlbum?.id, '');
      const albumTitle = albumId ? (albumsById.get(albumId) ?? '') : '';

      return { trackId, trackTitle, artistId, artistName, albumId, albumTitle };
    });
  }

  async userPlaylists(): Promise<PlaylistSummary[]> {
    const userId = await this.getUserId();
    const data = await this.call(() => this.client.GET('/playlists', {
      params: {
        query: { 'filter[owners.id]': [userId] },
      },
    })) as JsonLike;

    const entries = Array.isArray(data.data) ? data.data : [];

    return entries
      .map((entry) => asObject(entry))
      .filter((entry): entry is JsonObject => entry !== null)
      .map((entry) => {
        const attributes = asObject(entry.attributes);
        return {
          id: asString(entry.id),
          name: asString(attributes?.name),
        };
      })
      .filter((playlist) => Boolean(playlist.id));
  }

  async deletePlaylist(playlistId: string): Promise<void> {
    const result = await this.client.DELETE('/playlists/{id}', {
      params: { path: { id: playlistId } },
    });
    this.ensureWriteSucceeded(result);
  }

  async createPlaylist(name: string, description: string): Promise<string> {
    const data = await this.call(() => this.client.POST('/playlists', {
      body: {
        data: {
          type: 'playlists' as const,
          attributes: {
            name,
            description,
          },
        },
      },
    })) as JsonLike;

    const id = asObject(data.data)?.id;
    if (typeof id !== 'string' || !id) {
      throw new Error('Playlist create response missing id');
    }
    return id;
  }

  async addPlaylistTracks(
    playlistId: string,
    trackIds: string[],
  ): Promise<void> {
    const result = await this.client.POST('/playlists/{id}/relationships/items', {
      params: { path: { id: playlistId } },
      body: {
        data: trackIds.map((trackId) => ({ type: 'tracks' as const, id: trackId })),
      },
    });

    this.ensureWriteSucceeded(result);
  }

  async replacePlaylist(
    name: string,
    description: string,
    trackIds: string[],
    onProgress?: (pct: number) => void,
  ): Promise<string> {
    onProgress?.(0);

    const existing = await this.userPlaylists();
    const matches = existing.filter((playlist) => playlist.name === name);
    if (matches.length > 1) {
      console.warn(
        `replacePlaylist: ${matches.length} playlists named "${name}" found — deleting all`,
      );
    }
    if (matches.length > 0) {
      const results = await Promise.allSettled(matches.map((p) => this.deletePlaylist(p.id)));
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        throw new Error(`Failed to delete ${failed.length} existing playlist(s) named "${name}"`);
      }
    }

    onProgress?.(10);
    const playlistId = await this.createPlaylist(name, description);
    onProgress?.(15);

    const batchSize = 20;
    const totalBatches = Math.ceil(trackIds.length / batchSize) || 1;
    for (let i = 0; i < trackIds.length; i += batchSize) {
      await this.addPlaylistTracks(playlistId, trackIds.slice(i, i + batchSize));
      const batchIndex = Math.floor(i / batchSize) + 1;
      onProgress?.(15 + Math.round((batchIndex / totalBatches) * 85));
    }

    onProgress?.(100);
    return playlistId;
  }
}
