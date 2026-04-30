import type { AppSettings, ItemMetaMap } from '../../types.ts';
import {
  DEFAULT_TRACK_COUNT,
  defaultSettingsState,
  normalizeMeta,
  normalizeTrackCount,
  readJson,
  SETTINGS_KEY,
  TOKEN_KEY,
  writeJson,
} from '../tidal/shared.ts';

const CURRENT_VERSION = 1;

export let storageCleared = false;

function toIdArray(value: unknown, legacyString?: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
      .map((v) => v.trim());
  }
  // migrate old newline/comma-separated string
  let raw = '';
  if (typeof value === 'string') {
    raw = value;
  } else if (typeof legacyString === 'string') {
    raw = legacyString;
  }
  return raw.split(/[\n,]/).map((v) => v.trim()).filter(Boolean);
}

/** Loads AppSettings from localStorage, falling back to defaults for missing/invalid fields. */
export function loadSettings(): AppSettings {
  const hasData = localStorage.getItem(SETTINGS_KEY) !== null;
  const raw = readJson<Record<string, unknown>>(SETTINGS_KEY, {});

  if (hasData && raw.version !== CURRENT_VERSION) {
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(TOKEN_KEY);
    storageCleared = true;
    return defaultSettingsState();
  }
  const defaults = defaultSettingsState();

  return {
    countryCode: String(raw.countryCode ?? defaults.countryCode).trim().toUpperCase() || 'DE',
    playlistName: String(raw.playlistName ?? defaults.playlistName),
    playlistDescription: String(raw.playlistDescription ?? defaults.playlistDescription),
    count: normalizeTrackCount(raw.count, DEFAULT_TRACK_COUNT),
    shufflePlaylist: Boolean(raw.shufflePlaylist ?? defaults.shufflePlaylist),
    includeLikedArtistsPool: Boolean(raw.includeLikedArtists ?? defaults.includeLikedArtistsPool),
    includeLikedAlbumsPool: Boolean(raw.includeLikedAlbums ?? defaults.includeLikedAlbumsPool),
    poolArtists: toIdArray(raw.poolArtists, raw.whitelist),
    poolAlbums: toIdArray(raw.poolAlbums, raw.albumWhitelist),
    blacklistedArtists: toIdArray(raw.blacklistedArtists, raw.blacklist),
    blacklistedAlbums: toIdArray(raw.blacklistedAlbums, raw.albumBlacklist),
    artistPoolMeta: normalizeMeta(raw.artistPoolMeta ?? raw.artistWhitelistMeta) as ItemMetaMap,
    artistBlacklistMeta: normalizeMeta(raw.artistBlacklistMeta) as ItemMetaMap,
    albumPoolMeta: normalizeMeta(raw.albumPoolMeta ?? raw.albumWhitelistMeta) as ItemMetaMap,
    albumBlacklistMeta: normalizeMeta(raw.albumBlacklistMeta) as ItemMetaMap,
  };
}

/** Persists AppSettings to localStorage. */
export function saveSettings(s: AppSettings): void {
  writeJson(SETTINGS_KEY, { version: CURRENT_VERSION, ...s });
}
