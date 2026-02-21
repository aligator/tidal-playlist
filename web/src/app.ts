import {
  applyAlbumFilters,
  loadRuntimeConfig,
  loadSettings,
  parseListField,
  randomPickWithReplacement,
  saveSettings,
  TidalApi,
  TidalAuth,
} from './tidal.ts';
import type { PlaylistSettings } from './components/playlist-settings.ts';
import type { ListManager } from './components/list-manager.ts';
import type { AppToolbar } from './components/app-toolbar.ts';
import type { LogPanel } from './components/log-panel.ts';
import type {
  SelectedSongRow,
  SelectedSongsPanel,
} from './components/selected-songs-panel.ts';
import './components/define-all.ts';
import type {
  AppSettings,
  ItemMetaMap,
  LookupProvider,
  OAuthConfig,
  TidalArtist,
} from './types.ts';

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

function normalizeMeta(value: unknown): ItemMetaMap {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const out: ItemMetaMap = {};
  for (const [id, meta] of Object.entries(value)) {
    if (!meta || typeof meta !== 'object') {
      continue;
    }
    const metaObj = meta as { label?: unknown; subLabel?: unknown };
    out[String(id).toLowerCase()] = {
      label: String(metaObj.label ?? ''),
      subLabel: String(metaObj.subLabel ?? ''),
    };
  }
  return out;
}

function uniqueCaseInsensitive(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = String(value).trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

export class TidalPlaylistController {
  private readonly requestGapMs = 250;
  private readonly root: ParentNode;
  private pendingTrackIds: string[] = [];
  private selectedSongs: SelectedSongRow[] = [];
  private settings: AppSettings;
  private oauth: OAuthConfig;
  private auth: TidalAuth;
  private api: TidalApi;

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
    this.root = root;

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

    this.settings = loadSettings();
    this.oauth = { clientId: '', redirectUri: '' };
    this.auth = new TidalAuth(this.settings, this.oauth);
    this.api = new TidalApi(this.auth, this.settings);
  }

  async init(): Promise<void> {
    this.settings = loadSettings();
    this.$settings.setValues(this.settings);
    this.$artistPool.setItems(parseListField(this.settings.poolArtists));
    this.$artistBlacklist.setItems(parseListField(this.settings.blacklist));
    this.$albumPool.setItems(parseListField(this.settings.poolAlbums));
    this.$albumBlacklist.setItems(parseListField(this.settings.albumBlacklist));
    this.$includeLikedPool.checked = this.settings.includeLikedPool;
    this.$artistPool.setItemMeta(this.settings.artistPoolMeta);
    this.$artistBlacklist.setItemMeta(this.settings.artistBlacklistMeta);
    this.$albumPool.setItemMeta(this.settings.albumPoolMeta);
    this.$albumBlacklist.setItemMeta(this.settings.albumBlacklistMeta);

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

  private bindEvents(): void {
    this.$toolbar.addEventListener('save-settings', () => {
      this.readForm();
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
        this.readForm();
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
        const trackIds = await this.buildPlaylist();
        this.pendingTrackIds = trackIds;
        this.$toolbar.setCanSavePlaylist(true);
        this.log(
          `Fetched ${trackIds.length} tracks. Click 'Save Playlist' to write playlist changes.`,
        );
        this.$toolbar.setStatus(`Fetched ${trackIds.length} tracks`);
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
        this.readForm();
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

    this.$settings.addEventListener('input', () => this.readForm());
    this.$settings.addEventListener('change', () => this.readForm());
    this.$artistPool.addEventListener('items-change', () => this.readForm());
    this.$artistBlacklist.addEventListener('items-change', () => this.readForm());
    this.$albumPool.addEventListener('items-change', () => this.readForm());
    this.$albumBlacklist.addEventListener('items-change', () => this.readForm());
    this.$includeLikedPool.addEventListener('change', () => this.readForm());
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
    this.readForm();
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

  private readForm(): void {
    const base = this.$settings.getValues();
    this.settings = {
      ...base,
      includeLikedPool: this.$includeLikedPool.checked,
      poolArtists: this.$artistPool.getItems().join('\n'),
      poolAlbums: this.$albumPool.getItems().join('\n'),
      blacklist: this.$artistBlacklist.getItems().join('\n'),
      albumBlacklist: this.$albumBlacklist.getItems().join('\n'),
      artistPoolMeta: this.$artistPool.getItemMeta(),
      artistBlacklistMeta: this.$artistBlacklist.getItemMeta(),
      albumPoolMeta: this.$albumPool.getItemMeta(),
      albumBlacklistMeta: this.$albumBlacklist.getItemMeta(),
    };

    saveSettings(this.settings);
    this.auth.updateSettings(this.settings);
    this.api.updateSettings(this.settings);
  }

  private exportConfig(): void {
    this.readForm();
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

    const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

    const next: AppSettings = {
      countryCode: String(source.countryCode ?? 'US')
        .trim()
        .toUpperCase() || 'US',
      playlistName: String(source.playlistName ?? 'My Artists Mix'),
      playlistDescription: String(
        source.playlistDescription ?? 'Generated by tidal-playlist-web',
      ),
      count: Number(source.count ?? 25),
      includeLikedPool: Boolean(source.includeLikedPool ?? true),
      poolArtists: String(source.poolArtists ?? source.whitelist ?? ''),
      poolAlbums: String(source.poolAlbums ?? source.albumWhitelist ?? ''),
      blacklist: String(source.blacklist ?? ''),
      albumBlacklist: String(source.albumBlacklist ?? ''),
      artistPoolMeta: normalizeMeta(source.artistPoolMeta ?? source.artistWhitelistMeta),
      artistBlacklistMeta: normalizeMeta(source.artistBlacklistMeta),
      albumPoolMeta: normalizeMeta(source.albumPoolMeta ?? source.albumWhitelistMeta),
      albumBlacklistMeta: normalizeMeta(source.albumBlacklistMeta),
    };

    this.$settings.setValues(next);
    this.$includeLikedPool.checked = next.includeLikedPool;
    this.$artistPool.setItems(parseListField(next.poolArtists));
    this.$artistBlacklist.setItems(parseListField(next.blacklist));
    this.$albumPool.setItems(parseListField(next.poolAlbums));
    this.$albumBlacklist.setItems(parseListField(next.albumBlacklist));
    this.$artistPool.setItemMeta(next.artistPoolMeta);
    this.$artistBlacklist.setItemMeta(next.artistBlacklistMeta);
    this.$albumPool.setItemMeta(next.albumPoolMeta);
    this.$albumBlacklist.setItemMeta(next.albumBlacklistMeta);
    this.readForm();
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
        label: row.artistName
          ? `${row.title} - ${row.artistName}`
          : row.title,
        subLabel: row.artistName || '',
      }));
    };

    this.$artistPool.setLookupProvider(artistProvider);
    this.$artistBlacklist.setLookupProvider(artistProvider);
    this.$albumPool.setLookupProvider(albumProvider);
    this.$albumBlacklist.setLookupProvider(albumProvider);
  }

  private async buildPlaylist(): Promise<string[]> {
    this.readForm();
    this.selectedSongs = [];
    this.$songs.clear();

    if (!Number.isInteger(this.settings.count) || this.settings.count < 1) {
      throw new Error('Track count must be at least 1.');
    }

    const poolArtists = parseListField(this.settings.poolArtists);
    const poolAlbums = parseListField(this.settings.poolAlbums);
    const artistBlacklist = parseListField(this.settings.blacklist);
    const albumBlacklist = parseListField(this.settings.albumBlacklist);

    const likedArtists = this.settings.includeLikedPool
      ? await this.api.favoriteArtistIds()
      : [];
    const likedAlbums = this.settings.includeLikedPool
      ? await this.api.favoriteAlbumIds()
      : [];

    const artistPool = uniqueCaseInsensitive([
      ...likedArtists,
      ...poolArtists,
    ]).filter((id) => !artistBlacklist.some((b) => b.toLowerCase() === id.toLowerCase()));

    const albumPool = uniqueCaseInsensitive([
      ...likedAlbums,
      ...poolAlbums,
    ]).filter((idOrTitle) => {
      const value = idOrTitle.toLowerCase();
      return !albumBlacklist.some((blocked) => blocked.toLowerCase() === value);
    });

    this.log(
      `Pool prepared: ${artistPool.length} artist(s), ${albumPool.length} album(s).`,
    );
    if (artistPool.length === 0 && albumPool.length === 0) {
      throw new Error('Pool is empty. Add artists/albums or include liked pool.');
    }

    const trackIds: string[] = [];
    const pickFromArtists = randomPickWithReplacement(artistPool, this.settings.count);
    const pickFromAlbums = randomPickWithReplacement(albumPool, this.settings.count);

    for (let i = 0; i < this.settings.count; i += 1) {
      if (i > 0 && this.requestGapMs > 0) {
        await sleep(this.requestGapMs);
      }
      const useAlbumPool = albumPool.length > 0 &&
        (artistPool.length === 0 || Math.random() < 0.5);

      const albumIdOrTitle = useAlbumPool ? pickFromAlbums[i] : '';
      let chosenAlbumId = '';
      let chosenAlbumTitle = '';
      let chosenArtistId = '';
      let chosenArtistName = '';

      if (useAlbumPool && albumIdOrTitle) {
        chosenAlbumId = albumIdOrTitle;
        const albumMeta = this.settings.albumPoolMeta[chosenAlbumId.toLowerCase()];
        chosenAlbumTitle = albumMeta?.label || chosenAlbumId;
        chosenArtistName = albumMeta?.subLabel || '';

        if (!chosenArtistName || !chosenArtistId) {
          const primaryArtist = await this.api.primaryArtistFromAlbum(chosenAlbumId);
          if (primaryArtist) {
            chosenArtistId = primaryArtist.id;
            if (!chosenArtistName) {
              chosenArtistName = primaryArtist.name;
            }
          }
        }
      } else {
        const artistId = pickFromArtists[i];
        const artist = await this.api.artist(artistId).catch(
          (): TidalArtist => ({
            id: artistId,
            attributes: { name: artistId },
          }),
        );
        chosenArtistId = artistId;
        chosenArtistName = artist.attributes.name || artistId;
        const albums = await this.api.artistAlbums(artistId, 100);
        const filteredAlbums = applyAlbumFilters(albums, [], albumBlacklist);
        if (filteredAlbums.length === 0) {
          this.log(`${chosenArtistName}: no albums available in pool.`);
          continue;
        }
        const album = filteredAlbums[Math.floor(Math.random() * filteredAlbums.length)];
        chosenAlbumId = album.id;
        chosenAlbumTitle = album.title;
      }

      const chosenAlbumLabel = chosenArtistName
        ? `${chosenArtistName}: ${chosenAlbumTitle}`
        : chosenAlbumTitle;

      let tracks: Array<{ id: string; title: string }> = [];
      try {
        tracks = await this.api.albumTracks(chosenAlbumId);
      } catch (error: unknown) {
        this.log(
          `${chosenAlbumLabel}: track lookup failed (${toErrorMessage(error)}).`,
        );
        continue;
      }
      if (tracks.length === 0) {
        this.log(`${chosenAlbumLabel}: has no tracks.`);
        continue;
      }

      const track = tracks[Math.floor(Math.random() * tracks.length)];
      trackIds.push(track.id);
      this.selectedSongs.push({
        trackId: track.id,
        trackTitle: track.title,
        artistId: chosenArtistId,
        artistName: chosenArtistName,
        albumId: chosenAlbumId,
        albumTitle: chosenAlbumTitle,
      });
      this.$songs.setSongs(this.selectedSongs);
      this.log(`${chosenAlbumLabel} -> ${track.title}`);
    }

    if (trackIds.length === 0) {
      throw new Error('No tracks collected.');
    }

    this.log(`Collected ${trackIds.length} tracks.`);
    return trackIds;
  }
}
