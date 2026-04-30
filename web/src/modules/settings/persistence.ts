import type { AppSettings, ItemMetaMap } from '../../types.ts';
import {
  DEFAULT_TRACK_COUNT,
  defaultSettingsState,
  normalizeMeta,
  normalizeTrackCount,
  readJson,
  SETTINGS_KEY,
  writeJson,
} from '../tidal/shared.ts';

const CURRENT_VERSION = 1;

function toIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => v.trim());
}

function parseIdString(value: unknown): string[] | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  return value.split(/[\n,]/).map((v) => v.trim()).filter(Boolean);
}

function migrateRaw(raw: Record<string, unknown>): Record<string, unknown> {
  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (version >= CURRENT_VERSION) {
    return raw;
  }
  // v0 → v1: field renames + string→array conversion for id lists
  return {
    ...raw,
    poolArtists: raw.poolArtists ?? parseIdString(raw.whitelist) ?? raw.whitelist,
    poolAlbums: raw.poolAlbums ?? parseIdString(raw.albumWhitelist) ?? raw.albumWhitelist,
    blacklistedArtists: raw.blacklistedArtists ?? parseIdString(raw.blacklist) ?? raw.blacklist,
    blacklistedAlbums: raw.blacklistedAlbums ?? parseIdString(raw.albumBlacklist) ?? raw.albumBlacklist,
    artistPoolMeta: raw.artistPoolMeta ?? raw.artistWhitelistMeta,
    albumPoolMeta: raw.albumPoolMeta ?? raw.albumWhitelistMeta,
    includeLikedArtistsPool: raw.includeLikedArtistsPool ?? raw.includeLikedArtists,
    includeLikedAlbumsPool: raw.includeLikedAlbumsPool ?? raw.includeLikedAlbums,
    version: CURRENT_VERSION,
  };
}

/** Loads AppSettings from localStorage, falling back to defaults for missing/invalid fields. */
export function loadSettings(): AppSettings {
  const raw = migrateRaw(readJson<Record<string, unknown>>(SETTINGS_KEY, {}));
  const defaults = defaultSettingsState();

  return {
    countryCode: String(raw.countryCode ?? defaults.countryCode).trim().toUpperCase() || 'DE',
    playlistName: String(raw.playlistName ?? defaults.playlistName),
    playlistDescription: String(raw.playlistDescription ?? defaults.playlistDescription),
    count: normalizeTrackCount(raw.count, DEFAULT_TRACK_COUNT),
    shufflePlaylist: Boolean(raw.shufflePlaylist ?? defaults.shufflePlaylist),
    includeLikedArtistsPool: Boolean(raw.includeLikedArtistsPool ?? defaults.includeLikedArtistsPool),
    includeLikedAlbumsPool: Boolean(raw.includeLikedAlbumsPool ?? defaults.includeLikedAlbumsPool),
    poolArtists: toIdArray(raw.poolArtists),
    poolAlbums: toIdArray(raw.poolAlbums),
    blacklistedArtists: toIdArray(raw.blacklistedArtists),
    blacklistedAlbums: toIdArray(raw.blacklistedAlbums),
    artistPoolMeta: normalizeMeta(raw.artistPoolMeta) as ItemMetaMap,
    artistBlacklistMeta: normalizeMeta(raw.artistBlacklistMeta) as ItemMetaMap,
    albumPoolMeta: normalizeMeta(raw.albumPoolMeta) as ItemMetaMap,
    albumBlacklistMeta: normalizeMeta(raw.albumBlacklistMeta) as ItemMetaMap,
  };
}

/** Persists AppSettings to localStorage. */
export function saveSettings(s: AppSettings): void {
  writeJson(SETTINGS_KEY, { version: CURRENT_VERSION, ...s });
}
