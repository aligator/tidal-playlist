import { computed } from '@lit-labs/signals';
import { settings, updateSettings } from '../settings/store.ts';

// ---------------------------------------------------------------------------
// Helpers — convert between newline-separated on-disk strings and string[]
// ---------------------------------------------------------------------------

function fromField(value: string): string[] {
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function toField(arr: string[]): string {
  return arr.join('\n');
}

// ---------------------------------------------------------------------------
// Computed views (read-only)
// ---------------------------------------------------------------------------

/** Reactive list of pool artists (newline string → string[]). */
export const artists = computed(() => fromField(settings.get().poolArtists ?? ''));

/** Reactive list of pool albums (newline string → string[]). */
export const albums = computed(() => fromField(settings.get().poolAlbums ?? ''));

/** Reactive blocked sets (blacklist → string[], albumBlacklist → string[]). */
export const blocked = computed(() => ({
  artists: fromField(settings.get().blacklist ?? ''),
  albums: fromField(settings.get().albumBlacklist ?? ''),
}));

// ---------------------------------------------------------------------------
// Actions — all mutations go through updateSettings(); no in-place mutation
// ---------------------------------------------------------------------------

/** Add an artist name to the pool (no-op if already present). */
export function addArtist(name: string): void {
  const current = fromField(settings.get().poolArtists ?? '');
  if (current.includes(name)) {
    return;
  }
  updateSettings({ poolArtists: toField([...current, name]) });
}

/** Remove an artist name from the pool. */
export function removeArtist(name: string): void {
  const current = fromField(settings.get().poolArtists ?? '');
  updateSettings({ poolArtists: toField(current.filter((a) => a !== name)) });
}

/** Add an album name to the pool (no-op if already present). */
export function addAlbum(name: string): void {
  const current = fromField(settings.get().poolAlbums ?? '');
  if (current.includes(name)) {
    return;
  }
  updateSettings({ poolAlbums: toField([...current, name]) });
}

/** Remove an album name from the pool. */
export function removeAlbum(name: string): void {
  const current = fromField(settings.get().poolAlbums ?? '');
  updateSettings({ poolAlbums: toField(current.filter((a) => a !== name)) });
}

/** Add an artist name to the blocked list (no-op if already present). */
export function blockArtist(name: string): void {
  const current = fromField(settings.get().blacklist ?? '');
  if (current.includes(name)) {
    return;
  }
  updateSettings({ blacklist: toField([...current, name]) });
}

/** Remove an artist name from the blocked list. */
export function unblockArtist(name: string): void {
  const current = fromField(settings.get().blacklist ?? '');
  updateSettings({ blacklist: toField(current.filter((a) => a !== name)) });
}

/** Add an album name to the blocked list (no-op if already present). */
export function blockAlbum(name: string): void {
  const current = fromField(settings.get().albumBlacklist ?? '');
  if (current.includes(name)) {
    return;
  }
  updateSettings({ albumBlacklist: toField([...current, name]) });
}

/** Remove an album name from the blocked list. */
export function unblockAlbum(name: string): void {
  const current = fromField(settings.get().albumBlacklist ?? '');
  updateSettings({ albumBlacklist: toField(current.filter((a) => a !== name)) });
}
