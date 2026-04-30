import { css, html, LitElement } from 'lit';
import type { PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/icon/icon.js';
import '@material/web/progress/circular-progress.js';
import '../../components/ui-bottom-sheet.ts';
import '../../components/ui-icon-label-button.ts';
import { listStyles } from '../../styles/list.ts';
import { showSnackbar } from '../../components/ui-snackbar.ts';
import { settings } from '../settings/store.ts';
import { TidalApi } from '../tidal/api.ts';
import { blockAlbum, blockArtist, blocked, unblockAlbum, unblockArtist } from './store.ts';
import type { PlaylistSummary, SelectedSong } from '../../types.ts';

type Phase = 'playlists' | 'tracks';

const name = 'playlist-import-sheet';

/** Bottom sheet: browse TIDAL playlists, then block artists/albums from tracks. */
@customElement(name)
export class PlaylistImportSheet extends SignalWatcher(LitElement) {
  static override styles = [listStyles, css`
    .sheet-header {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0 8px 8px;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
    }

    .sheet-header h2 {
      flex: 1;
      margin: 0;
      font-size: 1rem;
      font-weight: 500;
      color: var(--md-sys-color-on-surface);
      padding-left: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .center {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      gap: 12px;
      color: var(--md-sys-color-on-surface-variant);
      font-size: 0.9375rem;
      text-align: center;
    }

    .track-meta {
      font-size: 0.8125rem;
      color: var(--md-sys-color-on-surface-variant);
    }

    .block-btns {
      display: flex;
      gap: 2px;
    }
  `];

  @property({ type: Boolean })
  open = false;

  @state()
  private _phase: Phase = 'playlists';
  @state()
  private _loading = false;
  @state()
  private _error: string | null = null;
  @state()
  private _playlists: PlaylistSummary[] = [];
  @state()
  private _selectedPlaylist: PlaylistSummary | null = null;
  @state()
  private _tracks: SelectedSong[] = [];

  protected override updated(changed: PropertyValues): void {
    if (changed.has('open') && this.open) {
      this._phase = 'playlists';
      this._selectedPlaylist = null;
      this._tracks = [];
      this._error = null;
      void this._loadPlaylists();
    }
  }

  override render() {
    const blockedState = blocked.get();
    const title = this._phase === 'tracks' && this._selectedPlaylist
      ? this._selectedPlaylist.name
      : 'Your playlists';

    return html`
      <ui-bottom-sheet .open="${this.open}" @close="${this._onClose}">
        <div class="sheet-header">
          ${this._phase === 'tracks'
            ? html`
              <md-icon-button aria-label="Back to playlists" @click="${this._onBack}">
                <md-icon>arrow_back</md-icon>
              </md-icon-button>
            `
            : ''}
          <h2>${title}</h2>
        </div>

        ${this._loading
          ? html`
            <div class="center"><md-circular-progress indeterminate></md-circular-progress></div>
          `
          : this._error
          ? html`
            <div class="center">${this._error}</div>
          `
          : this._phase === 'playlists'
          ? this._renderPlaylists()
          : this._renderTracks(blockedState)}
      </ui-bottom-sheet>
    `;
  }

  private _renderPlaylists() {
    if (this._playlists.length === 0) {
      return html`
        <div class="center">No playlists found.</div>
      `;
    }
    return html`
      <md-list>
        ${this._playlists.map(
          (p) =>
            html`
              <md-list-item type="button" @click="${() => this._onPlaylistClick(p)}">
                <span slot="headline">${p.name}</span>
                <md-icon slot="end">chevron_right</md-icon>
              </md-list-item>
            `,
        )}
      </md-list>
    `;
  }

  private _renderTracks(blockedState: { artists: string[]; albums: string[] }) {
    if (this._tracks.length === 0) {
      return html`
        <div class="center">No tracks in this playlist.</div>
      `;
    }

    const blockedArtists = new Set(blockedState.artists.map((a) => a.toLowerCase()));
    const blockedAlbums = new Set(blockedState.albums.map((a) => a.toLowerCase()));

    return html`
      <md-list>
        ${this._tracks.map((song) => {
          const artistBlocked = song.artistName
            ? blockedArtists.has(song.artistName.toLowerCase())
            : false;
          const albumBlocked = song.albumTitle
            ? blockedAlbums.has(song.albumTitle.toLowerCase())
            : false;
          const hasActions = song.artistName || song.albumTitle;

          return html`
            <md-list-item>
              <span slot="headline">${song.trackTitle}</span>
              <span slot="supporting-text" class="track-meta">
                ${song.artistName || ''}${song.artistName && song.albumTitle
                  ? ' · '
                  : ''}${song.albumTitle || ''}
              </span>
              ${hasActions
                ? html`
                  <div slot="end" class="block-btns">
                    ${song.artistName
                      ? html`
                        <ui-icon-label-button
                          icon="${artistBlocked ? 'person_off' : 'person_remove'}"
                          label="${artistBlocked ? 'Unblock' : 'Artist'}"
                          ?error="${artistBlocked}"
                          aria-label="${artistBlocked ? 'Unblock' : 'Block'} artist ${song.artistName}"
                          @click="${() => this._onToggleArtist(song.artistName, artistBlocked)}"
                        ></ui-icon-label-button>
                      `
                      : ''} ${song.albumTitle
                      ? html`
                        <ui-icon-label-button
                          icon="${albumBlocked ? 'check_circle' : 'block'}"
                          label="${albumBlocked ? 'Unblock' : 'Album'}"
                          ?error="${albumBlocked}"
                          aria-label="${albumBlocked ? 'Unblock' : 'Block'} album ${song.albumTitle}"
                          @click="${() => this._onToggleAlbum(song.albumTitle, albumBlocked)}"
                        ></ui-icon-label-button>
                      `
                      : ''}
                  </div>
                `
                : ''}
            </md-list-item>
          `;
        })}
      </md-list>
    `;
  }

  private async _loadPlaylists(): Promise<void> {
    this._loading = true;
    this._error = null;
    try {
      const api = new TidalApi(settings.get());
      this._playlists = await api.userPlaylists();
    } catch {
      this._error = 'Failed to load playlists.';
    } finally {
      this._loading = false;
    }
  }

  private async _onPlaylistClick(playlist: PlaylistSummary): Promise<void> {
    this._selectedPlaylist = playlist;
    this._loading = true;
    this._error = null;
    try {
      const api = new TidalApi(settings.get());
      this._tracks = await api.getPlaylistTracks(playlist.id);
      this._phase = 'tracks';
    } catch {
      this._error = 'Failed to load tracks.';
      this._selectedPlaylist = null;
    } finally {
      this._loading = false;
    }
  }

  private _onBack(): void {
    this._phase = 'playlists';
    this._selectedPlaylist = null;
    this._tracks = [];
    this._error = null;
  }

  private _onClose(): void {
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private _onToggleArtist(artistName: string, currentlyBlocked: boolean): void {
    if (currentlyBlocked) {
      unblockArtist(artistName);
      showSnackbar(`Unblocked artist "${artistName}"`, 'info', {
        duration: 5000,
        action: { label: 'Undo', callback: () => blockArtist(artistName) },
      });
    } else {
      blockArtist(artistName);
      showSnackbar(`Blocked artist "${artistName}"`, 'success', {
        duration: 5000,
        action: { label: 'Undo', callback: () => unblockArtist(artistName) },
      });
    }
  }

  private _onToggleAlbum(albumTitle: string, currentlyBlocked: boolean): void {
    if (currentlyBlocked) {
      unblockAlbum(albumTitle);
      showSnackbar(`Unblocked album "${albumTitle}"`, 'info', {
        duration: 5000,
        action: { label: 'Undo', callback: () => blockAlbum(albumTitle) },
      });
    } else {
      blockAlbum(albumTitle);
      showSnackbar(`Blocked album "${albumTitle}"`, 'success', {
        duration: 5000,
        action: { label: 'Undo', callback: () => unblockAlbum(albumTitle) },
      });
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: PlaylistImportSheet;
  }
}
