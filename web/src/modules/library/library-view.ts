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
        display: block;
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

    return html`
      <ui-top-bar heading="Library" logo>
        ${this._tab === 'blocked'
          ? html`
            <ui-icon-label-button
              icon="playlist_remove"
              label="From playlist"
              aria-label="Block from playlist"
              @click="${this._onPlaylistImportClick}"
            ></ui-icon-label-button>
          `
          : html`
            <ui-icon-label-button
              icon="add"
              label="Add"
              aria-label="Add ${this._tab === 'artists' ? 'artist' : 'album'}"
              @click="${this._onAddClick}"
            ></ui-icon-label-button>
          `}
      </ui-top-bar>

      <md-tabs @change="${this._onTabChange}">
        <md-primary-tab ?active="${this._tab === 'artists'}">Artists</md-primary-tab>
        <md-primary-tab ?active="${this._tab === 'albums'}">Albums</md-primary-tab>
        <md-primary-tab ?active="${this._tab === 'blocked'}">Blocked</md-primary-tab>
      </md-tabs>

      ${this._tab === 'artists'
        ? this._renderArtistsTab(artistList, s.includeLikedArtistsPool)
        : this._tab === 'albums'
        ? this._renderAlbumsTab(albumList, s.includeLikedAlbumsPool)
        : this._renderBlockedTab(blockedSets)}

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

  private _renderArtistsTab(list: string[], likedEnabled: boolean) {
    return html`
      <div class="liked-row">
        <div class="liked-row-info">
          <div class="liked-row-title">Liked artists</div>
          <div class="liked-row-sub">Include your TIDAL liked artists in pool</div>
        </div>
        <md-switch
          ?selected="${likedEnabled}"
          aria-label="Include liked artists"
          @change="${this._onToggleLikedArtists}"
        ></md-switch>
      </div>
      <md-divider></md-divider>
      ${list.length === 0
        ? html`
          <div class="empty-state">No custom artists added</div>
        `
        : html`
          <md-list>
            ${list.map(
              (name) =>
                html`
                  <md-list-item>
                    <span slot="headline">${name}</span>
                    <md-icon-button
                      slot="end"
                      aria-label="Remove ${name}"
                      @click="${() => this._onRemoveArtist(name)}"
                    >
                      <md-icon>delete</md-icon>
                    </md-icon-button>
                  </md-list-item>
                `,
            )}
          </md-list>
        `}
    `;
  }

  private _renderAlbumsTab(list: string[], likedEnabled: boolean) {
    return html`
      <div class="liked-row">
        <div class="liked-row-info">
          <div class="liked-row-title">Liked albums</div>
          <div class="liked-row-sub">Include your TIDAL liked albums in pool</div>
        </div>
        <md-switch
          ?selected="${likedEnabled}"
          aria-label="Include liked albums"
          @change="${this._onToggleLikedAlbums}"
        ></md-switch>
      </div>
      <md-divider></md-divider>
      ${list.length === 0
        ? html`
          <div class="empty-state">No custom albums added</div>
        `
        : html`
          <md-list>
            ${list.map(
              (name) =>
                html`
                  <md-list-item>
                    <span slot="headline">${name}</span>
                    <md-icon-button
                      slot="end"
                      aria-label="Remove ${name}"
                      @click="${() => this._onRemoveAlbum(name)}"
                    >
                      <md-icon>delete</md-icon>
                    </md-icon-button>
                  </md-list-item>
                `,
            )}
          </md-list>
        `}
    `;
  }

  private _renderBlockedTab(blockedSets: { artists: string[]; albums: string[] }) {
    const hasAny = blockedSets.artists.length > 0 || blockedSets.albums.length > 0;

    if (!hasAny) {
      return html`
        <div class="empty-state">No blocked items</div>
      `;
    }

    return html`
      ${blockedSets.artists.length > 0
        ? html`
          <div class="section-header">Blocked Artists</div>
          <md-list>
            ${blockedSets.artists.map(
              (name) =>
                html`
                  <md-list-item>
                    ${name}
                    <md-icon-button
                      slot="end"
                      aria-label="Unblock ${name}"
                      @click="${() => this._onUnblockArtist(name)}"
                    >
                      <md-icon>block</md-icon>
                    </md-icon-button>
                  </md-list-item>
                `,
            )}
          </md-list>
        `
        : ''} ${blockedSets.albums.length > 0
        ? html`
          <div class="section-header">Blocked Albums</div>
          <md-list>
            ${blockedSets.albums.map(
              (name) =>
                html`
                  <md-list-item>
                    ${name}
                    <md-icon-button
                      slot="end"
                      aria-label="Unblock ${name}"
                      @click="${() => this._onUnblockAlbum(name)}"
                    >
                      <md-icon>block</md-icon>
                    </md-icon-button>
                  </md-list-item>
                `,
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
    const kind = this._tab === 'albums' ? 'album' : 'artist';
    showSnackbar(`Added ${kind}: ${itemName}`, 'success');
    this._searchOpen = false;
  }

  private _onRemoveArtist(artistName: string): void {
    removeArtist(artistName);
    showSnackbar(`Removed "${artistName}"`, 'info', {
      duration: 5000,
      action: {
        label: 'Undo',
        callback: () => addArtist(artistName),
      },
    });
  }

  private _onRemoveAlbum(albumName: string): void {
    removeAlbum(albumName);
    showSnackbar(`Removed "${albumName}"`, 'info', {
      duration: 5000,
      action: {
        label: 'Undo',
        callback: () => addAlbum(albumName),
      },
    });
  }

  private _onUnblockArtist(artistName: string): void {
    unblockArtist(artistName);
    showSnackbar(`Unblocked artist "${artistName}"`, 'info', {
      duration: 5000,
      action: {
        label: 'Undo',
        callback: () => blockArtist(artistName),
      },
    });
  }

  private _onUnblockAlbum(albumName: string): void {
    unblockAlbum(albumName);
    showSnackbar(`Unblocked album "${albumName}"`, 'info', {
      duration: 5000,
      action: {
        label: 'Undo',
        callback: () => blockAlbum(albumName),
      },
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: LibraryView;
  }
}
