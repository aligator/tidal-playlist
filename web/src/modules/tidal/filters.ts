import type { TidalAlbum } from '../../types.ts';
export { parseListField } from './list-utils.ts';

export function applyArtistFilters(
  artistIds: string[],
  whitelist: string[],
  blacklist: string[],
): string[] {
  const low = (s: string): string => String(s).toLowerCase();
  const whiteSet = new Set(whitelist.map(low));
  const blackSet = new Set(blacklist.map(low));

  if (whiteSet.size > 0) {
    return artistIds.filter((id) => whiteSet.has(low(id)));
  }
  if (blackSet.size > 0) {
    return artistIds.filter((id) => !blackSet.has(low(id)));
  }
  return artistIds;
}

export function applyAlbumFilters(
  albums: TidalAlbum[],
  whitelist: string[],
  blacklist: string[],
): TidalAlbum[] {
  const low = (s: string): string => String(s).toLowerCase();
  const whiteSet = new Set(whitelist.map(low));
  const blackSet = new Set(blacklist.map(low));

  const hasAlbumMatch = (set: Set<string>, album: TidalAlbum): boolean => {
    const albumId = low(album.id ?? '');
    const albumTitle = low(album.title ?? '');
    return set.has(albumId) || (albumTitle !== '' && set.has(albumTitle));
  };

  if (whiteSet.size > 0) {
    return albums.filter((album) => hasAlbumMatch(whiteSet, album));
  }
  if (blackSet.size > 0) {
    return albums.filter((album) => !hasAlbumMatch(blackSet, album));
  }
  return albums;
}

export function randomPickWithReplacement<T>(items: T[], count: number): T[] {
  if (items.length === 0) {
    return [];
  }

  const out: T[] = [];
  for (let i = 0; i < count; i += 1) {
    const idx = Math.floor(Math.random() * items.length);
    out.push(items[idx]);
  }
  return out;
}
