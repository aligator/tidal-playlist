import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/tabs/tabs.js';
import '@material/web/tabs/primary-tab.js';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '@material/web/divider/divider.js';
import '@material/web/switch/switch.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/icon/icon.js';
import '../../components/ui-top-bar.ts';
import '../../components/ui-icon-label-button.ts';
import { listStyles } from '../../styles/list.ts';
import { showSnackbar } from '../../components/ui-snackbar.ts';
import { t } from '../../i18n/index.ts';
import { settings, updateSettings } from '../settings/store.ts';
import {
  addAlbum,
  addArtist,
  albums,
  artists,
  blockAlbum,
  blockArtist,
  blocked,
  removeAlbum,
  removeArtist,
  unblockAlbum,
  unblockArtist,
} from './store.ts';
import './search-sheet.ts';
import './playlist-import-sheet.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LibraryTab = 'artists' | 'albums' | 'blocked';

// ---------------------------------------------------------------------------
// Element
// ---------------------------------------------------------------------------

const name = 'library-view';

/** Full-page library screen with tabbed lists for artists, albums, and blocked items. */
@customElement(name)
export class LibraryView extends SignalWatcher(LitElement) {
  static override styles = [
    listStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }

      .scrollable {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
      }

      md-tabs {
        width: 100%;
      }

      .empty-state {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        font-size: 0.9375rem;
        color: var(--md-sys-color-on-surface-variant);
        text-align: center;
      }

      .section-header {
        padding: 16px 16px 4px;
        font-size: 0.75rem;
        font-weight: 500;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--md-sys-color-on-surface-variant);
      }

      .liked-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 16px 14px 16px;
        background: var(--md-sys-color-surface-container-low);
      }

      .liked-row-info {
        flex: 1;
        min-width: 0;
      }

      .liked-row-title {
        font-size: 0.9375rem;
        color: var(--md-sys-color-on-surface);
      }

      .liked-row-sub {
        font-size: 0.8125rem;
        color: var(--md-sys-color-on-surface-variant);
        margin-top: 2px;
      }
    `,
  ];

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  @state()
  private _tab: LibraryTab = 'artists';

  @state()
  private _searchOpen = false;

  @state()
  private _playlistImportOpen = false;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  override render() {
    const s = settings.get();
    const artistList = artists.get();
    const albumList = albums.get();
    const blockedSets = blocked.get();
    const artistPoolMeta = s.artistPoolMeta;
    const albumPoolMeta = s.albumPoolMeta;
    const artistBlacklistMeta = s.artistBlacklistMeta;
    const albumBlacklistMeta = s.albumBlacklistMeta;

    return html`
      <ui-top-bar heading="${t('library.heading')}" logo>
        ${this._tab === 'blocked'
          ? html`
            <ui-icon-label-button
              icon="playlist_remove"
              label="${t('library.fromPlaylist')}"
              aria-label="${t('library.fromPlaylist')}"
              @click="${this._onPlaylistImportClick}"
            ></ui-icon-label-button>
          `
          : html`
            <ui-icon-label-button
              icon="add"
              label="${t('library.add')}"
              aria-label="${t('library.add')} ${this._tab === 'artists' ? t('block.artist') : t('block.album')}"
              @click="${this._onAddClick}"
            ></ui-icon-label-button>
          `}
      </ui-top-bar>

      <md-tabs @change="${this._onTabChange}">
        <md-primary-tab ?active="${this._tab === 'artists'}">${t('library.tab.artists')}</md-primary-tab>
        <md-primary-tab ?active="${this._tab === 'albums'}">${t('library.tab.albums')}</md-primary-tab>
        <md-primary-tab ?active="${this._tab === 'blocked'}">${t('library.tab.blocked')}</md-primary-tab>
      </md-tabs>

      <div class="scrollable">
        ${this._tab === 'artists'
          ? this._renderArtistsTab(artistList, artistPoolMeta, s.includeLikedArtistsPool)
          : this._tab === 'albums'
          ? this._renderAlbumsTab(albumList, albumPoolMeta, s.includeLikedAlbumsPool)
          : this._renderBlockedTab(blockedSets, artistBlacklistMeta, albumBlacklistMeta)}
      </div>

      <library-search-sheet
        .open="${this._searchOpen}"
        .type="${this._tab === 'albums' ? 'album' : 'artist'}"
        @close="${this._onSearchClose}"
        @added="${this._onAdded}"
      ></library-search-sheet>

      <playlist-import-sheet
        .open="${this._playlistImportOpen}"
        @close="${this._onPlaylistImportClose}"
      ></playlist-import-sheet>
    `;
  }

  // -----------------------------------------------------------------------
  // Tab renderers
  // -----------------------------------------------------------------------

  private _renderArtistsTab(list: string[], meta: Record<string, { label: string }>, likedEnabled: boolean) {
    return html`
      <div class="liked-row">
        <div class="liked-row-info">
          <div class="liked-row-title">${t('library.likedArtists')}</div>
          <div class="liked-row-sub">${t('library.likedArtists.sub')}</div>
        </div>
        <md-switch
          ?selected="${likedEnabled}"
          aria-label="${t('library.likedArtists')}"
          @change="${this._onToggleLikedArtists}"
        ></md-switch>
      </div>
      <md-divider></md-divider>
      ${list.length === 0
        ? html`
          <div class="empty-state">${t('library.noCustomArtists')}</div>
        `
        : html`
          <md-list>
            ${list.map(
              (id) => {
                const label = meta[id]?.label ?? id;
                return html`
                  <md-list-item>
                    <span slot="headline">${label}</span>
                    <md-icon-button
                      slot="end"
                      aria-label="Remove ${label}"
                      @click="${() => this._onRemoveArtist(id)}"
                    >
                      <md-icon>delete</md-icon>
                    </md-icon-button>
                  </md-list-item>
                `;
              },
            )}
          </md-list>
        `}
    `;
  }

  private _renderAlbumsTab(list: string[], meta: Record<string, { label: string }>, likedEnabled: boolean) {
    return html`
      <div class="liked-row">
        <div class="liked-row-info">
          <div class="liked-row-title">${t('library.likedAlbums')}</div>
          <div class="liked-row-sub">${t('library.likedAlbums.sub')}</div>
        </div>
        <md-switch
          ?selected="${likedEnabled}"
          aria-label="${t('library.likedAlbums')}"
          @change="${this._onToggleLikedAlbums}"
        ></md-switch>
      </div>
      <md-divider></md-divider>
      ${list.length === 0
        ? html`
          <div class="empty-state">${t('library.noCustomAlbums')}</div>
        `
        : html`
          <md-list>
            ${list.map(
              (id) => {
                const label = meta[id]?.label ?? id;
                return html`
                  <md-list-item>
                    <span slot="headline">${label}</span>
                    <md-icon-button
                      slot="end"
                      aria-label="Remove ${label}"
                      @click="${() => this._onRemoveAlbum(id)}"
                    >
                      <md-icon>delete</md-icon>
                    </md-icon-button>
                  </md-list-item>
                `;
              },
            )}
          </md-list>
        `}
    `;
  }

  private _renderBlockedTab(
    blockedSets: { artists: string[]; albums: string[] },
    artistMeta: Record<string, { label: string }>,
    albumMeta: Record<string, { label: string }>,
  ) {
    const hasAny = blockedSets.artists.length > 0 || blockedSets.albums.length > 0;

    if (!hasAny) {
      return html`
        <div class="empty-state">${t('library.noBlocked')}</div>
      `;
    }

    return html`
      ${blockedSets.artists.length > 0
        ? html`
          <div class="section-header">${t('library.section.blockedArtists')}</div>
          <md-list>
            ${blockedSets.artists.map(
              (id) => {
                const label = artistMeta[id]?.label ?? id;
                return html`
                  <md-list-item>
                    ${label}
                    <md-icon-button
                      slot="end"
                      aria-label="Unblock ${label}"
                      @click="${() => this._onUnblockArtist(id)}"
                    >
                      <md-icon>block</md-icon>
                    </md-icon-button>
                  </md-list-item>
                `;
              },
            )}
          </md-list>
        `
        : ''} ${blockedSets.albums.length > 0
        ? html`
          <div class="section-header">${t('library.section.blockedAlbums')}</div>
          <md-list>
            ${blockedSets.albums.map(
              (id) => {
                const label = albumMeta[id]?.label ?? id;
                return html`
                  <md-list-item>
                    ${label}
                    <md-icon-button
                      slot="end"
                      aria-label="Unblock ${label}"
                      @click="${() => this._onUnblockAlbum(id)}"
                    >
                      <md-icon>block</md-icon>
                    </md-icon-button>
                  </md-list-item>
                `;
              },
            )}
          </md-list>
        `
        : ''}
    `;
  }

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  private _onTabChange(event: Event): void {
    const target = event.target as HTMLElement & { activeTabIndex?: number };
    const index = target.activeTabIndex ?? 0;
    const tabs: LibraryTab[] = ['artists', 'albums', 'blocked'];
    const next = tabs[index];
    if (next) {
      this._tab = next;
    }
  }

  private _onToggleLikedArtists(event: Event): void {
    const sw = event.target as HTMLElement & { selected?: boolean };
    updateSettings({ includeLikedArtistsPool: sw.selected ?? false });
  }

  private _onToggleLikedAlbums(event: Event): void {
    const sw = event.target as HTMLElement & { selected?: boolean };
    updateSettings({ includeLikedAlbumsPool: sw.selected ?? false });
  }

  private _onAddClick(): void {
    this._searchOpen = true;
  }

  private _onSearchClose(): void {
    this._searchOpen = false;
  }

  private _onPlaylistImportClick(): void {
    this._playlistImportOpen = true;
  }

  private _onPlaylistImportClose(): void {
    this._playlistImportOpen = false;
  }

  private _onAdded(event: Event): void {
    const e = event as CustomEvent<{ name: string }>;
    const itemName = e.detail?.name ?? '';
    const kind = this._tab === 'albums' ? t('block.album') : t('block.artist');
    showSnackbar(t('library.added', { kind, name: itemName }), 'success');
    this._searchOpen = false;
  }

  private _onRemoveArtist(id: string): void {
    const s = settings.get();
    const label = s.artistPoolMeta[id]?.label ?? id;
    const meta = s.artistPoolMeta[id];
    removeArtist(id);
    showSnackbar(t('library.removed', { name: label }), 'info', {
      duration: 5000,
      action: {
        label: t('block.undo'),
        callback: () => addArtist(id, meta),
      },
    });
  }

  private _onRemoveAlbum(id: string): void {
    const s = settings.get();
    const label = s.albumPoolMeta[id]?.label ?? id;
    const meta = s.albumPoolMeta[id];
    removeAlbum(id);
    showSnackbar(t('library.removed', { name: label }), 'info', {
      duration: 5000,
      action: {
        label: t('block.undo'),
        callback: () => addAlbum(id, meta),
      },
    });
  }

  private _onUnblockArtist(id: string): void {
    const s = settings.get();
    const label = s.artistBlacklistMeta[id]?.label ?? id;
    const meta = s.artistBlacklistMeta[id];
    unblockArtist(id);
    showSnackbar(t('library.unblocked.artist', { name: label }), 'info', {
      duration: 5000,
      action: {
        label: t('block.undo'),
        callback: () => blockArtist(id, meta),
      },
    });
  }

  private _onUnblockAlbum(id: string): void {
    const s = settings.get();
    const label = s.albumBlacklistMeta[id]?.label ?? id;
    const meta = s.albumBlacklistMeta[id];
    unblockAlbum(id);
    showSnackbar(t('library.unblocked.album', { name: label }), 'info', {
      duration: 5000,
      action: {
        label: t('block.undo'),
        callback: () => blockAlbum(id, meta),
      },
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: LibraryView;
  }
}
