import type { AppSettings, OAuthConfig } from '../types.ts';
import {
  DEFAULT_TRACK_COUNT,
  SETTINGS_KEY,
  asString,
  defaultSettingsState,
  normalizeTrackCount,
  normalizeMeta,
  readJson,
  writeJson,
} from './shared.ts';

export function defaultSettings(): AppSettings {
  return defaultSettingsState();
}

export function loadSettings(): AppSettings {
  const raw = readJson<Record<string, unknown>>(SETTINGS_KEY, {});
  const defaults = defaultSettingsState();

  return {
    countryCode: String(raw.countryCode ?? defaults.countryCode).trim().toUpperCase() || 'US',
    playlistName: String(raw.playlistName ?? defaults.playlistName),
    playlistDescription: String(raw.playlistDescription ?? defaults.playlistDescription),
    count: normalizeTrackCount(raw.count, DEFAULT_TRACK_COUNT),
    includeLikedPool: Boolean(raw.includeLikedPool ?? defaults.includeLikedPool),
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

export function saveSettings(settings: AppSettings): void {
  writeJson(SETTINGS_KEY, settings);
}

export async function loadRuntimeConfig(): Promise<OAuthConfig> {
  const res = await fetch('/api/config');
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    throw new Error(
      asString(payload.error) || `Config endpoint failed (${res.status})`,
    );
  }

  if (!payload.clientId) {
    throw new Error('Backend runtime config is missing OAuth client id.');
  }

  return {
    clientId: String(payload.clientId),
  };
}
