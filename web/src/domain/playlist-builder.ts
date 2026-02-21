import { applyAlbumFilters } from '../tidal/filters.ts';
import { parseListField, uniqueCaseInsensitive } from '../tidal/list-utils.ts';
import type {
  AlbumPoolEntryResolved,
  AppSettings,
  SelectedSong,
  TidalAlbum,
  TidalArtist,
  TidalTrack,
} from '../types.ts';

export type PlaylistBuilderApi = {
  favoriteArtistIds(): Promise<string[]>;
  favoriteAlbumIds(): Promise<string[]>;
  resolveAlbumPoolEntries(
    inputs: string[],
    metaMap: AppSettings['albumPoolMeta'],
  ): Promise<AlbumPoolEntryResolved[]>;
  primaryArtistFromAlbum(albumId: string): Promise<{ id: string; name: string } | null>;
  artist(artistId: string): Promise<TidalArtist>;
  artistAlbums(artistId: string, limit?: number): Promise<TidalAlbum[]>;
  albumTracks(albumId: string): Promise<TidalTrack[]>;
};

export type PlaylistBuildDiagnostics = {
  artistPoolCount: number;
  albumPoolCount: number;
  unresolvedAlbumInputs: string[];
  skippedNoAlbums: number;
  skippedTrackLookupFailures: number;
  skippedEmptyTracks: number;
};

export type PlaylistBuildResult = {
  trackIds: string[];
  selectedSongs: SelectedSong[];
  diagnostics: PlaylistBuildDiagnostics;
};

type PlaylistBuilderDeps = {
  api: PlaylistBuilderApi;
  logger: (message: string) => void;
  randomPickWithReplacement: <T>(items: T[], count: number) => T[];
  sleep: (ms: number) => Promise<void>;
  requestGapMs?: number;
};

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class PlaylistBuilder {
  private readonly api: PlaylistBuilderApi;
  private readonly logger: (message: string) => void;
  private readonly randomPickWithReplacement: <T>(items: T[], count: number) => T[];
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly requestGapMs: number;

  constructor(deps: PlaylistBuilderDeps) {
    this.api = deps.api;
    this.logger = deps.logger;
    this.randomPickWithReplacement = deps.randomPickWithReplacement;
    this.sleep = deps.sleep;
    this.requestGapMs = deps.requestGapMs ?? 250;
  }

  async build(settings: AppSettings): Promise<PlaylistBuildResult> {
    if (!Number.isInteger(settings.count) || settings.count < 1) {
      throw new Error('Track count must be at least 1.');
    }

    const poolArtists = parseListField(settings.poolArtists);
    const poolAlbums = parseListField(settings.poolAlbums);
    const artistBlacklist = parseListField(settings.blacklist);
    const albumBlacklist = parseListField(settings.albumBlacklist);

    const likedArtists = settings.includeLikedPool ? await this.api.favoriteArtistIds() : [];
    const likedAlbums = settings.includeLikedPool ? await this.api.favoriteAlbumIds() : [];

    const artistPool = uniqueCaseInsensitive([
      ...likedArtists,
      ...poolArtists,
    ]).filter((id) => !artistBlacklist.some((b) => b.toLowerCase() === id.toLowerCase()));

    const requestedAlbumInputs = uniqueCaseInsensitive([
      ...likedAlbums,
      ...poolAlbums,
    ]).filter((idOrTitle) => {
      const value = idOrTitle.toLowerCase();
      return !albumBlacklist.some((blocked) => blocked.toLowerCase() === value);
    });

    const resolvedAlbums = await this.api.resolveAlbumPoolEntries(
      requestedAlbumInputs,
      settings.albumPoolMeta,
    );
    const unresolvedAlbumInputs = requestedAlbumInputs.filter((value) =>
      !resolvedAlbums.some((entry) => entry.raw.toLowerCase() === value.toLowerCase())
    );
    if (unresolvedAlbumInputs.length > 0) {
      this.logger(
        `Unresolved album entries skipped: ${unresolvedAlbumInputs.join(', ')}`,
      );
    }

    this.logger(
      `Pool prepared: ${artistPool.length} artist(s), ${resolvedAlbums.length} album(s).`,
    );

    if (artistPool.length === 0 && resolvedAlbums.length === 0) {
      throw new Error('Pool is empty. Add artists/albums or include liked pool.');
    }

    const trackIds: string[] = [];
    const selectedSongs: SelectedSong[] = [];
    const pickFromArtists = this.randomPickWithReplacement(artistPool, settings.count);
    const pickFromAlbums = this.randomPickWithReplacement(resolvedAlbums, settings.count);
    const diagnostics: PlaylistBuildDiagnostics = {
      artistPoolCount: artistPool.length,
      albumPoolCount: resolvedAlbums.length,
      unresolvedAlbumInputs,
      skippedNoAlbums: 0,
      skippedTrackLookupFailures: 0,
      skippedEmptyTracks: 0,
    };

    for (let i = 0; i < settings.count; i += 1) {
      if (i > 0 && this.requestGapMs > 0) {
        await this.sleep(this.requestGapMs);
      }
      const useAlbumPool = resolvedAlbums.length > 0 &&
        (artistPool.length === 0 || Math.random() < 0.5);

      const chosenAlbumFromPool = useAlbumPool ? pickFromAlbums[i] : null;
      let chosenAlbumId = '';
      let chosenAlbumTitle = '';
      let chosenArtistId = '';
      let chosenArtistName = '';

      if (chosenAlbumFromPool) {
        chosenAlbumId = chosenAlbumFromPool.albumId;
        chosenAlbumTitle = chosenAlbumFromPool.title || chosenAlbumFromPool.raw;
        chosenArtistId = chosenAlbumFromPool.artistId ?? '';
        chosenArtistName = chosenAlbumFromPool.artistName ?? '';

        if (!chosenArtistName || !chosenArtistId) {
          const primaryArtist = await this.api.primaryArtistFromAlbum(chosenAlbumId);
          if (primaryArtist) {
            chosenArtistId = primaryArtist.id;
            if (!chosenArtistName) {
              chosenArtistName = primaryArtist.name;
            }
          }
        }
      } else {
        const artistId = pickFromArtists[i];
        const artist = await this.api.artist(artistId).catch(
          (): TidalArtist => ({
            id: artistId,
            attributes: { name: artistId },
          }),
        );
        chosenArtistId = artistId;
        chosenArtistName = artist.attributes.name || artistId;
        const albums = await this.api.artistAlbums(artistId, 100);
        const filteredAlbums = applyAlbumFilters(albums, [], albumBlacklist);
        if (filteredAlbums.length === 0) {
          this.logger(`${chosenArtistName}: no albums available in pool.`);
          diagnostics.skippedNoAlbums += 1;
          continue;
        }
        const album = filteredAlbums[Math.floor(Math.random() * filteredAlbums.length)];
        chosenAlbumId = album.id;
        chosenAlbumTitle = album.title;
      }

      const chosenAlbumLabel = chosenArtistName
        ? `${chosenArtistName}: ${chosenAlbumTitle}`
        : chosenAlbumTitle;

      let tracks: Array<{ id: string; title: string }> = [];
      try {
        tracks = await this.api.albumTracks(chosenAlbumId);
      } catch (error: unknown) {
        this.logger(
          `${chosenAlbumLabel}: track lookup failed (${toErrorMessage(error)}).`,
        );
        diagnostics.skippedTrackLookupFailures += 1;
        continue;
      }
      if (tracks.length === 0) {
        this.logger(`${chosenAlbumLabel}: has no tracks.`);
        diagnostics.skippedEmptyTracks += 1;
        continue;
      }

      const track = tracks[Math.floor(Math.random() * tracks.length)];
      trackIds.push(track.id);
      selectedSongs.push({
        trackId: track.id,
        trackTitle: track.title,
        artistId: chosenArtistId,
        artistName: chosenArtistName,
        albumId: chosenAlbumId,
        albumTitle: chosenAlbumTitle,
      });
      this.logger(`${chosenAlbumLabel} -> ${track.title}`);
    }

    if (trackIds.length === 0) {
      throw new Error('No tracks collected.');
    }

    this.logger(`Collected ${trackIds.length} tracks.`);
    return { trackIds, selectedSongs, diagnostics };
  }
}
