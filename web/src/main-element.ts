import { css, html } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { StyledElement } from './styled-element.ts';
import { TidalAuth } from './modules/tidal/tidal-auth.ts';
import { TidalApi } from './modules/tidal/api.ts';
import { randomPickWithReplacement } from './modules/tidal/filters.ts';
import { PlaylistBuilder } from './modules/playlist-builder.ts';
import { AppSettingsStore } from './modules/app-settings-store.ts';
import type { AppSettings, LookupProvider, SelectedSong } from './types.ts';
import type { AppToolbar } from './components/app-toolbar.ts';
import type { LogPanel } from './components/log-panel.ts';
import type { SelectedSongsPanel } from './components/selected-songs-panel.ts';
import type { PlaylistSettings } from './components/playlist-settings.ts';
import type { ListManager } from './components/list-manager.ts';

const name = 'main-element';

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@customElement(name)
export class MainElement extends StyledElement {
  static override localStyles = css`
    :host {
      display: block;
    }
  `;

  @state()
  private initialized = false;

  private pendingTrackIds: string[] = [];
  private selectedSongs: SelectedSong[] = [];
  private settings!: AppSettings;
  private auth!: TidalAuth;
  private api!: TidalApi;
  private settingsStore!: AppSettingsStore;
  private playlistBuilder!: PlaylistBuilder;

  @query('app-toolbar')
  private $toolbar!: AppToolbar;
  @query('log-panel')
  private $log!: LogPanel;
  @query('selected-songs-panel')
  private $songs!: SelectedSongsPanel;
  @query('playlist-settings')
  private $settings!: PlaylistSettings;
  @query('#artist-pool')
  private $artistPool!: ListManager;
  @query('#artist-blacklist')
  private $artistBlacklist!: ListManager;
  @query('#album-pool')
  private $albumPool!: ListManager;
  @query('#album-blacklist')
  private $albumBlacklist!: ListManager;
  @query('#include-liked-artists-pool')
  private $includeLikedArtistsPool!: HTMLInputElement;
  @query('#include-liked-albums-pool')
  private $includeLikedAlbumsPool!: HTMLInputElement;

  override render() {
    return html`
      <auth-guard @auth-ready="${this.handleAuthReady}">
        <div class="app">
          <h1>TIDAL Playlist Builder</h1>
          <p class="subtitle">Build your own playlist - just as you want</p>
          <app-toolbar></app-toolbar>
          <div class="grid">
            <div>
              <playlist-settings></playlist-settings>
              <div class="pool-toggle">
                <input type="checkbox" id="include-liked-artists-pool" checked />
                <label for="include-liked-artists-pool">Include liked artists</label>
              </div>
              <div class="pool-toggle">
                <input type="checkbox" id="include-liked-albums-pool" checked />
                <label for="include-liked-albums-pool">Include liked albums</label>
              </div>
            </div>
            <div class="grid">
              <div class="list-group">
                <h3>Artist pool</h3>
                <div class="list-managers">
                  <list-manager
                    id="artist-pool"
                    title="Artists"
                    lookup-placeholder="Search artists"
                  ></list-manager>
                </div>
                <div class="list-managers">
                  <list-manager
                    id="artist-blacklist"
                    title="Artist blacklist"
                    lookup-placeholder="Search artists"
                  ></list-manager>
                </div>
              </div>
              <div class="list-group">
                <h3>Album pool</h3>
                <div class="list-managers">
                  <list-manager
                    id="album-pool"
                    title="Albums"
                    lookup-placeholder="Search albums"
                  ></list-manager>
                </div>
                <div class="list-managers">
                  <list-manager
                    id="album-blacklist"
                    title="Album blacklist"
                    lookup-placeholder="Search albums"
                  ></list-manager>
                </div>
              </div>
            </div>
          </div>
          <selected-songs-panel></selected-songs-panel>
          <log-panel></log-panel>
          <div class="app-footer">
            <impressum-modal></impressum-modal>
          </div>
        </div>
      </auth-guard>
    `;
  }

  private handleAuthReady = async (event: Event): Promise<void> => {
    if (this.initialized) return;

    const e = event as CustomEvent<TidalAuth>;
    this.auth = e.detail;
    this.settingsStore = new AppSettingsStore(300);
    this.settings = this.settingsStore.load();
    this.api = new TidalApi(this.settings);
    this.playlistBuilder = new PlaylistBuilder({
      api: this.api,
      logger: (msg) => this.$log.log(msg),
      randomPickWithReplacement,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      requestGapMs: 250,
    });
    this.initialized = true;
    await this.updateComplete;
    this.settingsStore.applyToUi(this.settings, this.settingsWidgets());
    this.bindEvents();
    this.configureLookupProviders();
    this.$toolbar.setStatus(this.auth.isLoggedIn() ? 'Authenticated' : 'Not authenticated');
  };

  private settingsWidgets() {
    return {
      settingsForm: this.$settings,
      artistPool: this.$artistPool,
      artistBlacklist: this.$artistBlacklist,
      albumPool: this.$albumPool,
      albumBlacklist: this.$albumBlacklist,
      includeLikedArtistsPool: this.$includeLikedArtistsPool,
      includeLikedAlbumsPool: this.$includeLikedAlbumsPool,
    };
  }

  private bindEvents(): void {
    this.$toolbar.addEventListener('export-config', () => {
      try {
        this.exportConfig();
        this.$log.log('Config exported.');
      } catch (error: unknown) {
        this.$log.log(`Export failed: ${toErrorMessage(error)}`);
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
        this.$log.log('Config imported and saved.');
      } catch (error: unknown) {
        this.$log.log(`Import failed: ${toErrorMessage(error)}`);
      }
    });

    this.$toolbar.addEventListener('login', async () => {
      try {
        this.syncSettingsImmediate();
        await this.auth.beginLogin();
      } catch (error: unknown) {
        this.$log.log(toErrorMessage(error));
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
      this.$log.log('Logged out, token cleared.');
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
        this.$log.log(
          `Fetched ${result.trackIds.length} tracks. Click 'Save Playlist' to write playlist changes.`,
        );
        this.$toolbar.setStatus(`Fetched ${result.trackIds.length} tracks`);
      } catch (error: unknown) {
        this.$log.log(toErrorMessage(error));
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
        this.$log.log(`Replacing playlist '${this.settings.playlistName}'...`);
        const playlistId = await this.api.replacePlaylist(
          this.settings.playlistName,
          this.settings.playlistDescription,
          this.pendingTrackIds,
        );
        this.$log.log(`Done. Playlist id: ${playlistId}`);
        this.pendingTrackIds = [];
        this.$toolbar.setCanSavePlaylist(false);
        this.$toolbar.setStatus('Saved');
      } catch (error: unknown) {
        this.$log.log(toErrorMessage(error));
        this.$toolbar.setStatus('Failed');
      } finally {
        this.$toolbar.setBusy(false);
      }
    });

    this.$songs.addEventListener('add-artist-blacklist', (event: Event) => {
      const customEvent = event as CustomEvent<{ id: string; label: string }>;
      const detail = customEvent.detail;
      if (!detail?.id) return;
      this.addToBlacklist(this.$artistBlacklist, detail.id, {
        label: detail.label || detail.id,
        subLabel: '',
      });
      this.removeSelectedSongs(
        (song) => song.artistId.toLowerCase() === detail.id.toLowerCase(),
      );
      this.$log.log(`Artist blacklisted: ${detail.label || detail.id} (${detail.id}).`);
    });

    this.$songs.addEventListener('add-album-blacklist', (event: Event) => {
      const customEvent = event as CustomEvent<{
        id: string;
        label: string;
        subLabel: string;
      }>;
      const detail = customEvent.detail;
      if (!detail?.id) return;
      this.addToBlacklist(this.$albumBlacklist, detail.id, {
        label: detail.label || detail.id,
        subLabel: detail.subLabel || '',
      });
      this.removeSelectedSongs(
        (song) => song.albumId.toLowerCase() === detail.id.toLowerCase(),
      );
      this.$log.log(`Album blacklisted: ${detail.label || detail.id} (${detail.id}).`);
    });

    const debouncedSync = () => this.syncSettingsDebounced();
    this.$settings.addEventListener('input', debouncedSync);
    this.$settings.addEventListener('change', debouncedSync);
    this.$artistPool.addEventListener('items-change', debouncedSync);
    this.$artistBlacklist.addEventListener('items-change', debouncedSync);
    this.$albumPool.addEventListener('items-change', debouncedSync);
    this.$albumBlacklist.addEventListener('items-change', debouncedSync);
    this.$includeLikedArtistsPool.addEventListener('change', debouncedSync);
    this.$includeLikedAlbumsPool.addEventListener('change', debouncedSync);
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
    currentMeta[key] = { label: meta.label, subLabel: meta.subLabel };
    manager.setItemMeta(currentMeta);
    this.syncSettingsImmediate();
  }

  private removeSelectedSongs(predicate: (song: SelectedSong) => boolean): void {
    const keepSongs = this.selectedSongs.filter((song) => !predicate(song));
    if (keepSongs.length === this.selectedSongs.length) return;
    this.selectedSongs = keepSongs;
    this.pendingTrackIds = keepSongs.map((song) => song.trackId);
    this.$songs.setSongs(this.selectedSongs);
    this.$toolbar.setCanSavePlaylist(this.pendingTrackIds.length > 0);
  }

  private syncSettingsDebounced(): void {
    this.settings = this.settingsStore.updateFromUiDebounced(this.settingsWidgets());
    this.api.updateSettings(this.settings);
  }

  private syncSettingsImmediate(): void {
    this.settings = this.settingsStore.updateFromUiImmediate(this.settingsWidgets());
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
    this.api.updateSettings(this.settings);
  }

  private syncStatus(): void {
    this.$toolbar.setStatus(
      this.auth.isLoggedIn() ? 'Authenticated' : 'Not authenticated',
    );
    this.configureLookupProviders();
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
      return rows.map((row) => ({ id: row.id, label: row.name }));
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

declare global {
  interface HTMLElementTagNameMap {
    [name]: MainElement;
  }
}
