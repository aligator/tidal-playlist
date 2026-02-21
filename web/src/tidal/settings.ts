import type { AppSettings, OAuthConfig } from '../types.ts';
import {
  SETTINGS_KEY,
  asString,
  defaultSettingsState,
  normalizeMeta,
  readJson,
  writeJson,
} from './shared.ts';

export function defaultSettings(): AppSettings {
  return defaultSettingsState();
}

export function loadSettings(): AppSettings {
  const raw = readJson<Record<string, unknown>>(SETTINGS_KEY, {});
  const poolArtists = String(raw.poolArtists ?? raw.whitelist ?? '');
  const poolAlbums = String(raw.poolAlbums ?? raw.albumWhitelist ?? '');
  const includeLikedPool = Boolean(raw.includeLikedPool ?? true);

  return {
    ...defaultSettingsState(),
    ...raw,
    includeLikedPool,
    poolArtists,
    poolAlbums,
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

  if (!payload.clientId || !payload.redirectUri) {
    throw new Error('Backend runtime config is missing OAuth settings.');
  }

  return {
    clientId: String(payload.clientId),
    redirectUri: String(payload.redirectUri),
  };
}
