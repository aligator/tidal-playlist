import { computed, signal } from '@lit-labs/signals';
import type { SelectedSong } from '../../types.ts';
import { settings } from '../settings/store.ts';
import { albums, artists } from '../library/store.ts';
import { TidalApi } from '../tidal/api.ts';
import { PlaylistBuilder } from './builder.ts';
import { handleAuthFailure } from '../auth/store.ts';

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

export type BuildStatus = 'idle' | 'building' | 'done' | 'error';

/** Current build lifecycle state. */
export const buildStatus = signal<BuildStatus>('idle');

/** Tracks selected by the last successful build. */
export const result = signal<SelectedSong[]>([]);

/** Human-readable error from the last failed build. */
export const buildError = signal<string | null>(null);

/** Build progress 0-100, or null when not building. */
export const buildProgress = signal<number | null>(null);

/** Save progress 0-100, or null when not saving. */
export const saveProgress = signal<number | null>(null);

// ---------------------------------------------------------------------------
// Derived / computed
// ---------------------------------------------------------------------------

/**
 * Reactive count of pool sources (artists + albums) for display in playlist-view.
 * Includes liked-artists/albums toggles when enabled.
 */
export const poolSourceCount = computed(() => {
  const s = settings.get();
  return {
    artistCount: artists.get().length,
    albumCount: albums.get().length,
    likedArtists: s.includeLikedArtistsPool,
    likedAlbums: s.includeLikedAlbumsPool,
  };
});

/** True when the pool has at least one source. */
export const hasPoolSources = computed(() => {
  const p = poolSourceCount.get();
  return p.artistCount > 0 || p.albumCount > 0 || p.likedArtists || p.likedAlbums;
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Resets build state to idle so the user can configure and rebuild. */
export function resetBuild(): void {
  buildStatus.set('idle');
  buildError.set(null);
  buildProgress.set(null);
}

/** Runs the playlist build algorithm and updates buildStatus / result / buildError. */
export async function buildPlaylist(): Promise<void> {
  buildStatus.set('building');
  buildError.set(null);
  buildProgress.set(0);

  const currentSettings = settings.get();
  const api = new TidalApi(currentSettings);

  const builder = new PlaylistBuilder({
    api,
    logger: (_msg: string) => {},
    randomPickWithReplacement: <T>(items: T[], count: number): T[] => {
      const out: T[] = [];
      for (let i = 0; i < count; i += 1) {
        out.push(items[Math.floor(Math.random() * items.length)]);
      }
      return out;
    },
    sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  });

  try {
    const buildResult = await builder.build(currentSettings, (pct) => buildProgress.set(pct));
    result.set(buildResult.selectedSongs);
    buildProgress.set(null);
    buildStatus.set('done');
  } catch (err: unknown) {
    buildProgress.set(null);
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes('401') ||
      message.toLowerCase().includes('unauthorized')
    ) {
      handleAuthFailure();
    }
    buildError.set(message);
    buildStatus.set('error');
  }
}

/** Creates or replaces a TIDAL playlist with the current result tracks. Throws on error. */
export async function savePlaylist(name: string, description: string): Promise<void> {
  const currentSettings = settings.get();
  const api = new TidalApi(currentSettings);
  const trackIds = result.get().map((song) => song.trackId);
  saveProgress.set(0);
  try {
    await api.replacePlaylist(name, description, trackIds, (pct) => saveProgress.set(pct));
    saveProgress.set(null);
  } catch (err: unknown) {
    saveProgress.set(null);
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes('401') ||
      message.toLowerCase().includes('unauthorized')
    ) {
      handleAuthFailure();
    }
    throw err;
  }
}
