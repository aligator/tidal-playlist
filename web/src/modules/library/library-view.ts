import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/tabs/tabs.js';
import '@material/web/tabs/primary-tab.js';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/icon/icon.js';
import '../../components/ui-top-bar.ts';
import { showSnackbar } from '../../components/ui-snackbar.ts';
import {
  artists,
  albums,
  blocked,
  addArtist,
  removeArtist,
  addAlbum,
  removeAlbum,
  blockArtist,
  blockAlbum,
  unblockArtist,
  unblockAlbum,
} from './store.ts';
import './search-sheet.ts';

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
  static override styles = css`
    :host {
      display: block;
    }

    md-tabs {
      width: 100%;
    }

    md-list {
      padding: 0;
    }

    md-list-item {
      --md-list-item-leading-space: 16px;
      --md-list-item-trailing-space: 8px;
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
  `;

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  @state()
  private _tab: LibraryTab = 'artists';

  @state()
  private _searchOpen = false;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  override render() {
    const artistList = artists.get();
    const albumList = albums.get();
    const blockedSets = blocked.get();

    const showAddButton = this._tab !== 'blocked';

    return html`
      <ui-top-bar heading="Library">
        ${showAddButton
          ? html`
              <md-icon-button
                aria-label="Add ${this._tab === 'artists' ? 'artist' : 'album'}"
                @click="${this._onAddClick}"
              >
                <md-icon>add</md-icon>
              </md-icon-button>
            `
          : ''}
      </ui-top-bar>

      <md-tabs @change="${this._onTabChange}">
        <md-primary-tab ?active="${this._tab === 'artists'}">Artists</md-primary-tab>
        <md-primary-tab ?active="${this._tab === 'albums'}">Albums</md-primary-tab>
        <md-primary-tab ?active="${this._tab === 'blocked'}">Blocked</md-primary-tab>
      </md-tabs>

      ${this._tab === 'artists'
        ? this._renderArtistsTab(artistList)
        : this._tab === 'albums'
          ? this._renderAlbumsTab(albumList)
          : this._renderBlockedTab(blockedSets)}

      <library-search-sheet
        .open="${this._searchOpen}"
        .type="${this._tab === 'albums' ? 'album' : 'artist'}"
        @close="${this._onSearchClose}"
        @added="${this._onAdded}"
      ></library-search-sheet>
    `;
  }

  // -----------------------------------------------------------------------
  // Tab renderers
  // -----------------------------------------------------------------------

  private _renderArtistsTab(list: string[]) {
    if (list.length === 0) {
      return html`
        <div class="empty-state">No artists added yet</div>
      `;
    }

    return html`
      <md-list>
        ${list.map(
          (name) => html`
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
    `;
  }

  private _renderAlbumsTab(list: string[]) {
    if (list.length === 0) {
      return html`
        <div class="empty-state">No albums added yet</div>
      `;
    }

    return html`
      <md-list>
        ${list.map(
          (name) => html`
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
                (name) => html`
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
        : ''}
      ${blockedSets.albums.length > 0
        ? html`
            <div class="section-header">Blocked Albums</div>
            <md-list>
              ${blockedSets.albums.map(
                (name) => html`
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

  private _onAddClick(): void {
    this._searchOpen = true;
  }

  private _onSearchClose(): void {
    this._searchOpen = false;
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
