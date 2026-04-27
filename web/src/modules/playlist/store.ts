import { signal, computed } from '@lit-labs/signals';
import type { SelectedSong } from '../../types.ts';
import { settings } from '../settings/store.ts';
import { artists, albums } from '../library/store.ts';
import { TidalApi } from '../tidal/api.ts';
import { PlaylistBuilder } from './builder.ts';

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

// ---------------------------------------------------------------------------
// Derived / computed
// ---------------------------------------------------------------------------

/**
 * Reactive count of pool sources (artists + albums) for display in playlist-view.
 * Includes liked-artists/albums toggles when enabled.
 */
export const poolSourceCount = computed(() => {
  const s = settings.get();
  const artistCount = artists.get().length + (s.includeLikedArtistsPool ? 1 : 0);
  const albumCount = albums.get().length + (s.includeLikedAlbumsPool ? 1 : 0);
  return { artistCount, albumCount, total: artistCount + albumCount };
});

/** True when the pool has at least one source. */
export const hasPoolSources = computed(() => poolSourceCount.get().total > 0);

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Runs the playlist build algorithm and updates buildStatus / result / buildError. */
export async function buildPlaylist(): Promise<void> {
  buildStatus.set('building');
  buildError.set(null);

  const currentSettings = settings.get();
  const api = new TidalApi(currentSettings);

  const builder = new PlaylistBuilder({
    api,
    logger: (_msg: string) => {
      // No-op logger for the UI path; diagnostics surfaced via result signal.
    },
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
    const buildResult = await builder.build(currentSettings);
    result.set(buildResult.selectedSongs);
    buildStatus.set('done');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    buildError.set(message);
    buildStatus.set('error');
  }
}

/** Creates or replaces a TIDAL playlist with the current result tracks. Throws on error. */
export async function savePlaylist(name: string, description: string): Promise<void> {
  const currentSettings = settings.get();
  const api = new TidalApi(currentSettings);
  const trackIds = result.get().map((song) => song.trackId);
  await api.replacePlaylist(name, description, trackIds);
}
