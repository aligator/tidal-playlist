import { computed } from '@lit-labs/signals';
import type { AppSettings, ItemMeta } from '../../types.ts';
import { settings, updateSettings } from '../settings/store.ts';

// ---------------------------------------------------------------------------
// Computed views (read-only)
// ---------------------------------------------------------------------------

/** Reactive list of pool artist IDs. */
export const artists = computed(() => settings.get().poolArtists);

/** Reactive list of pool album IDs. */
export const albums = computed(() => settings.get().poolAlbums);

/** Reactive blocked ID sets. */
export const blocked = computed(() => ({
  artists: settings.get().blacklistedArtists,
  albums: settings.get().blacklistedAlbums,
}));

// ---------------------------------------------------------------------------
// Actions — all mutations go through updateSettings(); no in-place mutation
// ---------------------------------------------------------------------------

/** Add an artist ID to the pool (no-op if already present). Optionally stores display meta. */
export function addArtist(id: string, meta?: ItemMeta): void {
  const current = settings.get();
  if (current.poolArtists.includes(id)) {
    return;
  }
  const patch: Partial<AppSettings> = { poolArtists: [...current.poolArtists, id] };
  if (meta) {
    patch.artistPoolMeta = { ...current.artistPoolMeta, [id]: meta };
  }
  updateSettings(patch);
}

/** Remove an artist ID from the pool. */
export function removeArtist(id: string): void {
  const current = settings.get();
  const newMeta = { ...current.artistPoolMeta };
  delete newMeta[id];
  updateSettings({ poolArtists: current.poolArtists.filter((a) => a !== id), artistPoolMeta: newMeta });
}

/** Add an album ID to the pool (no-op if already present). Optionally stores display meta. */
export function addAlbum(id: string, meta?: ItemMeta): void {
  const current = settings.get();
  if (current.poolAlbums.includes(id)) {
    return;
  }
  const patch: Partial<AppSettings> = { poolAlbums: [...current.poolAlbums, id] };
  if (meta) {
    patch.albumPoolMeta = { ...current.albumPoolMeta, [id]: meta };
  }
  updateSettings(patch);
}

/** Remove an album ID from the pool. */
export function removeAlbum(id: string): void {
  const current = settings.get();
  const newMeta = { ...current.albumPoolMeta };
  delete newMeta[id];
  updateSettings({ poolAlbums: current.poolAlbums.filter((a) => a !== id), albumPoolMeta: newMeta });
}

/** Add an artist ID to the blocked list (no-op if already present). Optionally stores display meta. */
export function blockArtist(id: string, meta?: ItemMeta): void {
  const current = settings.get();
  if (current.blacklistedArtists.includes(id)) {
    return;
  }
  const patch: Partial<AppSettings> = { blacklistedArtists: [...current.blacklistedArtists, id] };
  if (meta) {
    patch.artistBlacklistMeta = { ...current.artistBlacklistMeta, [id]: meta };
  }
  updateSettings(patch);
}

/** Remove an artist ID from the blocked list. */
export function unblockArtist(id: string): void {
  const current = settings.get();
  const newMeta = { ...current.artistBlacklistMeta };
  delete newMeta[id];
  updateSettings({ blacklistedArtists: current.blacklistedArtists.filter((a) => a !== id), artistBlacklistMeta: newMeta });
}

/** Add an album ID to the blocked list (no-op if already present). Optionally stores display meta. */
export function blockAlbum(id: string, meta?: ItemMeta): void {
  const current = settings.get();
  if (current.blacklistedAlbums.includes(id)) {
    return;
  }
  const patch: Partial<AppSettings> = { blacklistedAlbums: [...current.blacklistedAlbums, id] };
  if (meta) {
    patch.albumBlacklistMeta = { ...current.albumBlacklistMeta, [id]: meta };
  }
  updateSettings(patch);
}

/** Remove an album ID from the blocked list. */
export function unblockAlbum(id: string): void {
  const current = settings.get();
  const newMeta = { ...current.albumBlacklistMeta };
  delete newMeta[id];
  updateSettings({ blacklistedAlbums: current.blacklistedAlbums.filter((a) => a !== id), albumBlacklistMeta: newMeta });
}
