import { loadRuntimeConfig, randomPickWithReplacement, TidalApi, TidalAuth } from './tidal.ts';
import type { PlaylistSettings } from './components/playlist-settings.ts';
import type { ListManager } from './components/list-manager.ts';
import type { AppToolbar } from './components/app-toolbar.ts';
import type { LogPanel } from './components/log-panel.ts';
import type { SelectedSongRow, SelectedSongsPanel } from './components/selected-songs-panel.ts';
import './components/index.ts';
import type { AppSettings, LookupProvider, OAuthConfig } from './types.ts';
import { PlaylistBuilder } from './domain/playlist-builder.ts';
import { AppSettingsStore } from './state/app-settings-store.ts';
import type { SettingsWidgets } from './state/app-settings-store.ts';

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector(selector);
  if (!(element instanceof Element)) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element as T;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

export class TidalPlaylistController {
  private readonly requestGapMs = 250;
  private pendingTrackIds: string[] = [];
  private selectedSongs: SelectedSongRow[] = [];
  private settings: AppSettings;
  private oauth: OAuthConfig;
  private auth: TidalAuth;
  private api: TidalApi;
  private readonly settingsStore: AppSettingsStore;
  private readonly playlistBuilder: PlaylistBuilder;

  private readonly $settings: PlaylistSettings;
  private readonly $artistPool: ListManager;
  private readonly $artistBlacklist: ListManager;
  private readonly $albumPool: ListManager;
  private readonly $albumBlacklist: ListManager;
  private readonly $includeLikedPool: HTMLInputElement;
  private readonly $toolbar: AppToolbar;
  private readonly $songs: SelectedSongsPanel;
  private readonly $log: LogPanel;

  constructor(root: ParentNode = document) {
    this.$settings = requireElement<PlaylistSettings>(
      root,
      'playlist-settings',
    );
    this.$artistPool = requireElement<ListManager>(
      root,
      '#artist-pool',
    );
    this.$artistBlacklist = requireElement<ListManager>(
      root,
      '#artist-blacklist',
    );
    this.$albumPool = requireElement<ListManager>(
      root,
      '#album-pool',
    );
    this.$albumBlacklist = requireElement<ListManager>(
      root,
      '#album-blacklist',
    );
    this.$includeLikedPool = requireElement<HTMLInputElement>(
      root,
      '#include-liked-pool',
    );
    this.$toolbar = requireElement<AppToolbar>(root, 'app-toolbar');
    this.$songs = requireElement<SelectedSongsPanel>(root, 'selected-songs-panel');
    this.$log = requireElement<LogPanel>(root, 'log-panel');

    this.settingsStore = new AppSettingsStore(300);
    this.settings = this.settingsStore.getSettings();
    this.oauth = { clientId: '', redirectUri: '' };
    this.auth = new TidalAuth(this.settings, this.oauth);
    this.api = new TidalApi(this.settings);
    this.playlistBuilder = new PlaylistBuilder({
      api: this.api,
      logger: (message) => this.log(message),
      randomPickWithReplacement,
      sleep,
      requestGapMs: this.requestGapMs,
    });
  }

  async init(): Promise<void> {
    this.settings = this.settingsStore.load();
    this.settingsStore.applyToUi(this.settings, this.settingsWidgets());

    this.configureLookupProviders();
    this.bindEvents();

    this.$toolbar.setBusy(true);
    this.syncStatus();

    try {
      this.oauth = await loadRuntimeConfig();
      this.auth.updateOAuth(this.oauth);
      await this.handleCallback();
    } catch (error: unknown) {
      this.log(`Config error: ${toErrorMessage(error)}`);
    } finally {
      this.$toolbar.setBusy(false);
      this.$toolbar.setCanSavePlaylist(this.pendingTrackIds.length > 0);
      this.syncStatus();
    }
  }

  private settingsWidgets(): SettingsWidgets {
    return {
      settingsForm: this.$settings,
      artistPool: this.$artistPool,
      artistBlacklist: this.$artistBlacklist,
      albumPool: this.$albumPool,
      albumBlacklist: this.$albumBlacklist,
      includeLikedPool: this.$includeLikedPool,
    };
  }

  private bindEvents(): void {
    this.$toolbar.addEventListener('save-settings', () => {
      this.syncSettingsImmediate();
      this.log('Settings saved.');
    });

    this.$toolbar.addEventListener('export-config', () => {
      try {
        this.exportConfig();
        this.log('Config exported.');
      } catch (error: unknown) {
        this.log(`Export failed: ${toErrorMessage(error)}`);
      }
    });

    this.$toolbar.addEventListener('import-config', async (event: Event) => {
      try {
        const customEvent = event as CustomEvent<{ file?: File }>;
        const file = customEvent.detail?.file;
        if (!(file instanceof File)) {
          throw new Error('No config file selected.');
        }
        await this.importConfigFile(file);
        this.log('Config imported and saved.');
      } catch (error: unknown) {
        this.log(`Import failed: ${toErrorMessage(error)}`);
      }
    });

    this.$toolbar.addEventListener('login', async () => {
      try {
        this.syncSettingsImmediate();
        if (!this.oauth.clientId || !this.oauth.redirectUri) {
          throw new Error(
            'OAuth runtime config is missing. Check backend env.',
          );
        }
        await this.auth.beginLogin();
      } catch (error: unknown) {
        this.log(toErrorMessage(error));
      }
    });

    this.$toolbar.addEventListener('logout', () => {
      this.auth.logout();
      this.pendingTrackIds = [];
      this.selectedSongs = [];
      this.$songs.clear();
      this.$toolbar.setCanSavePlaylist(false);
      this.configureLookupProviders();
      this.syncStatus();
      this.log('Logged out, token cleared.');
    });

    this.$toolbar.addEventListener('fetch', async () => {
      this.$toolbar.setBusy(true);
      this.$toolbar.setStatus('Fetching...');
      try {
        this.syncSettingsImmediate();
        const result = await this.playlistBuilder.build(this.settings);
        this.pendingTrackIds = result.trackIds;
        this.selectedSongs = result.selectedSongs;
        this.$songs.setSongs(this.selectedSongs);
        this.$toolbar.setCanSavePlaylist(true);
        this.log(
          `Fetched ${result.trackIds.length} tracks. Click 'Save Playlist' to write playlist changes.`,
        );
        this.$toolbar.setStatus(`Fetched ${result.trackIds.length} tracks`);
      } catch (error: unknown) {
        this.log(toErrorMessage(error));
        this.$toolbar.setStatus('Failed');
      } finally {
        this.$toolbar.setBusy(false);
      }
    });

    this.$toolbar.addEventListener('save-playlist', async () => {
      this.$toolbar.setBusy(true);
      this.$toolbar.setStatus('Saving...');
      try {
        this.syncSettingsImmediate();
        if (this.pendingTrackIds.length === 0) {
          throw new Error("No fetched tracks. Run 'Fetch Tracks' first.");
        }

        this.log(`Replacing playlist '${this.settings.playlistName}'...`);
        const playlistId = await this.api.replacePlaylist(
          this.settings.playlistName,
          this.settings.playlistDescription,
          this.pendingTrackIds,
        );
        this.log(`Done. Playlist id: ${playlistId}`);
        this.pendingTrackIds = [];
        this.$toolbar.setCanSavePlaylist(false);
        this.$toolbar.setStatus('Saved');
      } catch (error: unknown) {
        this.log(toErrorMessage(error));
        this.$toolbar.setStatus('Failed');
      } finally {
        this.$toolbar.setBusy(false);
      }
    });

    this.$songs.addEventListener('add-artist-blacklist', (event: Event) => {
      const customEvent = event as CustomEvent<{ id: string; label: string }>;
      const detail = customEvent.detail;
      if (!detail?.id) {
        return;
      }
      this.addToBlacklist(
        this.$artistBlacklist,
        detail.id,
        {
          label: detail.label || detail.id,
          subLabel: '',
        },
      );
      this.removeSelectedSongs((song) => song.artistId.toLowerCase() === detail.id.toLowerCase());
      this.log(`Artist blacklisted: ${detail.label || detail.id} (${detail.id}).`);
    });

    this.$songs.addEventListener('add-album-blacklist', (event: Event) => {
      const customEvent = event as CustomEvent<{
        id: string;
        label: string;
        subLabel: string;
      }>;
      const detail = customEvent.detail;
      if (!detail?.id) {
        return;
      }
      this.addToBlacklist(
        this.$albumBlacklist,
        detail.id,
        {
          label: detail.label || detail.id,
          subLabel: detail.subLabel || '',
        },
      );
      this.removeSelectedSongs((song) => song.albumId.toLowerCase() === detail.id.toLowerCase());
      this.log(`Album blacklisted: ${detail.label || detail.id} (${detail.id}).`);
    });

    const debouncedSync = () => this.syncSettingsDebounced();
    this.$settings.addEventListener('input', debouncedSync);
    this.$settings.addEventListener('change', debouncedSync);
    this.$artistPool.addEventListener('items-change', debouncedSync);
    this.$artistBlacklist.addEventListener('items-change', debouncedSync);
    this.$albumPool.addEventListener('items-change', debouncedSync);
    this.$albumBlacklist.addEventListener('items-change', debouncedSync);
    this.$includeLikedPool.addEventListener('change', debouncedSync);
  }

  private addToBlacklist(
    manager: ListManager,
    itemId: string,
    meta: { label: string; subLabel: string },
  ): void {
    const key = itemId.toLowerCase();
    const currentItems = manager.getItems();
    if (!currentItems.some((existing) => existing.toLowerCase() === key)) {
      manager.setItems([...currentItems, itemId]);
    }

    const currentMeta = manager.getItemMeta();
    currentMeta[key] = {
      label: meta.label,
      subLabel: meta.subLabel,
    };
    manager.setItemMeta(currentMeta);
    this.syncSettingsImmediate();
  }

  private removeSelectedSongs(
    predicate: (song: SelectedSongRow) => boolean,
  ): void {
    const keepSongs = this.selectedSongs.filter((song) => !predicate(song));
    if (keepSongs.length === this.selectedSongs.length) {
      return;
    }

    this.selectedSongs = keepSongs;
    this.pendingTrackIds = keepSongs.map((song) => song.trackId);
    this.$songs.setSongs(this.selectedSongs);
    this.$toolbar.setCanSavePlaylist(this.pendingTrackIds.length > 0);
  }

  private syncSettingsDebounced(): void {
    this.settings = this.settingsStore.updateFromUiDebounced(this.settingsWidgets());
    this.auth.updateSettings(this.settings);
    this.api.updateSettings(this.settings);
  }

  private syncSettingsImmediate(): void {
    this.settings = this.settingsStore.updateFromUiImmediate(this.settingsWidgets());
    this.auth.updateSettings(this.settings);
    this.api.updateSettings(this.settings);
  }

  private exportConfig(): void {
    this.syncSettingsImmediate();
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: this.settings,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const stamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tidal-playlist-config-${stamp}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  private async importConfigFile(file: File): Promise<void> {
    const text = await file.text();
    const parsed = JSON.parse(text) as { settings?: unknown } | unknown;
    const raw = parsed && typeof parsed === 'object' && 'settings' in parsed
      ? ((parsed as { settings?: unknown }).settings ?? parsed)
      : parsed;

    const next = this.settingsStore.importSettings(raw);
    this.settingsStore.replace(next);
    this.settingsStore.applyToUi(next, this.settingsWidgets());
    this.settings = next;
    this.auth.updateSettings(this.settings);
    this.api.updateSettings(this.settings);
  }

  private async handleCallback(): Promise<void> {
    try {
      const completed = await this.auth.finishLoginFromUrl();
      if (completed) {
        this.log('Login successful.');
      }
    } catch (error: unknown) {
      this.log(toErrorMessage(error));
    }
  }

  private syncStatus(): void {
    this.$toolbar.setStatus(
      this.auth.isLoggedIn() ? 'Authenticated' : 'Not authenticated',
    );
    this.configureLookupProviders();
  }

  private log(msg: string): void {
    this.$log.log(msg);
  }

  private configureLookupProviders(): void {
    if (!this.auth.isLoggedIn()) {
      this.$artistPool.setLookupProvider(null);
      this.$artistBlacklist.setLookupProvider(null);
      this.$albumPool.setLookupProvider(null);
      this.$albumBlacklist.setLookupProvider(null);
      return;
    }

    const artistProvider: LookupProvider = async (query: string) => {
      const rows = await this.api.searchArtists(query, 10);
      return rows.map((row) => ({
        id: row.id,
        label: row.name,
      }));
    };

    const albumProvider: LookupProvider = async (query: string) => {
      const rows = await this.api.searchAlbums(query, 10);
      return rows.map((row) => ({
        id: row.id,
        label: row.artistName ? `${row.title} - ${row.artistName}` : row.title,
        subLabel: row.artistName || '',
      }));
    };

    this.$artistPool.setLookupProvider(artistProvider);
    this.$artistBlacklist.setLookupProvider(artistProvider);
    this.$albumPool.setLookupProvider(albumProvider);
    this.$albumBlacklist.setLookupProvider(albumProvider);
  }
}
