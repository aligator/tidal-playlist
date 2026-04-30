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
import { detectLocale, SUPPORTED_LOCALES, type SupportedLocale } from '../../i18n/index.ts';

function coerceSupportedLocale(value: unknown): SupportedLocale {
  if (typeof value === 'string' && (SUPPORTED_LOCALES as string[]).includes(value)) {
    return value as SupportedLocale;
  }
  return detectLocale();
}

const CURRENT_VERSION = 1;

function coerceIdList(value: unknown, fallback?: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => v.trim());
  }
  if (typeof value === 'string') {
    return value.split(/[\n,]/).map((v) => v.trim()).filter(Boolean);
  }
  if (fallback !== undefined) {
    return coerceIdList(fallback);
  }
  return [];
}

export function migrateRaw(raw: Record<string, unknown>): Record<string, unknown> {
  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (version >= CURRENT_VERSION) {
    return raw;
  }
  // v0 → v1: field renames + string→array conversion for id lists
  return {
    ...raw,
    poolArtists: coerceIdList(raw.poolArtists, raw.whitelist),
    poolAlbums: coerceIdList(raw.poolAlbums, raw.albumWhitelist),
    blacklistedArtists: coerceIdList(raw.blacklistedArtists, raw.blacklist),
    blacklistedAlbums: coerceIdList(raw.blacklistedAlbums, raw.albumBlacklist),
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
    locale: coerceSupportedLocale(raw.locale),
    countryCode: String(raw.countryCode ?? defaults.countryCode).trim().toUpperCase() || 'DE',
    playlistName: String(raw.playlistName ?? defaults.playlistName),
    playlistDescription: String(raw.playlistDescription ?? defaults.playlistDescription),
    count: normalizeTrackCount(raw.count, DEFAULT_TRACK_COUNT),
    shufflePlaylist: Boolean(raw.shufflePlaylist ?? defaults.shufflePlaylist),
    includeLikedArtistsPool: Boolean(raw.includeLikedArtistsPool ?? defaults.includeLikedArtistsPool),
    includeLikedAlbumsPool: Boolean(raw.includeLikedAlbumsPool ?? defaults.includeLikedAlbumsPool),
    poolArtists: raw.poolArtists as string[],
    poolAlbums: raw.poolAlbums as string[],
    blacklistedArtists: raw.blacklistedArtists as string[],
    blacklistedAlbums: raw.blacklistedAlbums as string[],
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
