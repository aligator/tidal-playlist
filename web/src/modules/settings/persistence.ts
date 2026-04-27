import type { AppSettings } from '../../types.ts';
import {
  DEFAULT_TRACK_COUNT,
  defaultSettingsState,
  normalizeMeta,
  normalizeTrackCount,
  readJson,
  SETTINGS_KEY,
  writeJson,
} from '../tidal/shared.ts';

/** Loads AppSettings from localStorage, falling back to defaults for missing/invalid fields. */
export function loadSettings(): AppSettings {
  const raw = readJson<Record<string, unknown>>(SETTINGS_KEY, {});
  const defaults = defaultSettingsState();
  const rawAlbumPoolWeight = Number(raw.albumPoolWeight ?? defaults.albumPoolWeight);
  const albumPoolWeight = Number.isFinite(rawAlbumPoolWeight)
    ? Math.min(1, Math.max(0, rawAlbumPoolWeight))
    : defaults.albumPoolWeight;

  return {
    countryCode: String(raw.countryCode ?? defaults.countryCode).trim().toUpperCase() || 'DE',
    playlistName: String(raw.playlistName ?? defaults.playlistName),
    playlistDescription: String(raw.playlistDescription ?? defaults.playlistDescription),
    count: normalizeTrackCount(raw.count, DEFAULT_TRACK_COUNT),
    albumPoolWeight,
    shufflePlaylist: Boolean(raw.shufflePlaylist ?? defaults.shufflePlaylist),
    includeLikedArtistsPool: Boolean(raw.includeLikedArtists ?? defaults.includeLikedArtistsPool),
    includeLikedAlbumsPool: Boolean(raw.includeLikedAlbums ?? defaults.includeLikedAlbumsPool),
    poolArtists: String(raw.poolArtists ?? raw.whitelist ?? defaults.poolArtists),
    poolAlbums: String(raw.poolAlbums ?? raw.albumWhitelist ?? defaults.poolAlbums),
    blacklist: String(raw.blacklist ?? defaults.blacklist),
    albumBlacklist: String(raw.albumBlacklist ?? defaults.albumBlacklist),
    artistPoolMeta: normalizeMeta(raw.artistPoolMeta ?? raw.artistWhitelistMeta),
    artistBlacklistMeta: normalizeMeta(raw.artistBlacklistMeta),
    albumPoolMeta: normalizeMeta(raw.albumPoolMeta ?? raw.albumWhitelistMeta),
    albumBlacklistMeta: normalizeMeta(raw.albumBlacklistMeta),
  };
}

/** Persists AppSettings to localStorage. */
export function saveSettings(s: AppSettings): void {
  writeJson(SETTINGS_KEY, s);
}
