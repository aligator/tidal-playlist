import { createAPIClient } from '@tidal-music/api';
import { credentialsProvider as sdkCredentialsProvider } from '@tidal-music/auth';
import type {
  AppSettings,
  PlaylistSummary,
  TidalAlbum,
  TidalArtist,
  TidalTrack,
} from '../types.ts';
import { asObject, asString } from './shared.ts';
import type { JsonObject } from './shared.ts';
import type { TidalAuth } from './auth.ts';

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

  constructor(_auth: TidalAuth, settings: AppSettings) {
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

  private async getUserId(): Promise<string> {
    const data = this.unwrap(
      await this.client.GET('/users/me', { parseAs: 'json' }),
    );
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
      const request = type === 'artists'
        ? this.client.GET('/userCollections/{id}/relationships/artists', {
          params: {
            path: { id: userId },
            query: {
              'page[cursor]': cursor || undefined,
              countryCode: this.settings.countryCode,
            },
          },
        })
        : this.client.GET('/userCollections/{id}/relationships/albums', {
          params: {
            path: { id: userId },
            query: {
              'page[cursor]': cursor || undefined,
              countryCode: this.settings.countryCode,
            },
          },
        });
      const page = this.unwrap(
        await request,
      ) as JsonLike;

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
    const data = this.unwrap(
      await this.client.GET('/artists/{id}', {
        params: {
          path: { id: artistId },
          query: { countryCode: this.settings.countryCode },
        },
      }),
    ) as JsonLike;

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
    const data = this.unwrap(
      await this.client.GET('/artists/{id}', {
        params: {
          path: { id: artistId },
          query: { include: ['albums'], countryCode: this.settings.countryCode },
        },
      }),
    ) as JsonLike;

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
    const data = this.unwrap(
      await this.client.GET('/albums/{id}', {
        params: {
          path: { id: albumId },
          query: { include: ['items'], countryCode: this.settings.countryCode },
        },
      }),
    ) as JsonLike;

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
      const data = this.unwrap(
        await this.client.GET('/albums/{id}', {
          params: {
            path: { id: albumId },
            query: {
              include: ['artists'],
              countryCode: this.settings.countryCode,
            },
          },
        }),
      ) as JsonLike;

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
    const data = this.unwrap(
      await this.client.GET('/searchResults/{id}/relationships/artists', {
        params: {
          path: { id: query },
          query: {
            countryCode: this.settings.countryCode,
            include: ['artists'],
          },
        },
      }),
    ) as JsonLike;

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
    const data = this.unwrap(
      await this.client.GET('/searchResults/{id}', {
        params: {
          path: { id: query },
          query: {
            countryCode: this.settings.countryCode,
            include: ['albums', 'artists'],
          },
        },
      }),
    ) as JsonLike;

    const included = this.included(data);
    const albums = this.byType(included, 'albums')
      .map((entry) => {
        const attributes = asObject(entry.attributes);
        return {
          id: asString(entry.id),
          title: asString(attributes?.title, asString(entry.id)),
          artistName: '',
        };
      })
      .slice(0, limit);

    const enriched = await Promise.all(
      albums.map(async (album) => ({
        ...album,
        artistName: await this.primaryArtistNameFromAlbumInclude(album.id),
      })),
    );

    return enriched;
  }

  private async primaryArtistNameFromAlbumInclude(albumId: string): Promise<string> {
    try {
      const data = this.unwrap(
        await this.client.GET('/albums/{id}', {
          params: {
            path: { id: albumId },
            query: {
              include: ['artists'],
              countryCode: this.settings.countryCode,
            },
          },
        }),
      ) as JsonLike;

      const artist = this.byType(this.included(data), 'artists')[0];
      const attributes = asObject(artist?.attributes);
      return asString(attributes?.name);
    } catch {
      return '';
    }
  }

  async userPlaylists(): Promise<PlaylistSummary[]> {
    const userId = await this.getUserId();
    const data = this.unwrap(
      await this.client.GET('/playlists', {
        params: {
          query: { 'filter[owners.id]': [userId] },
        },
      }),
    ) as JsonLike;

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
    const data = this.unwrap(
      await this.client.POST('/playlists', {
        body: {
          data: {
            type: 'playlists' as const,
            attributes: {
              name,
              description,
            },
          },
        },
      }),
    ) as JsonLike;

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
  ): Promise<string> {
    const existing = await this.userPlaylists();
    const matches = existing.filter((playlist) => playlist.name === name);
    for (const playlist of matches) {
      await this.deletePlaylist(playlist.id);
    }

    const playlistId = await this.createPlaylist(name, description);

    const batchSize = 20;
    for (let i = 0; i < trackIds.length; i += batchSize) {
      await this.addPlaylistTracks(playlistId, trackIds.slice(i, i + batchSize));
    }

    return playlistId;
  }
}
