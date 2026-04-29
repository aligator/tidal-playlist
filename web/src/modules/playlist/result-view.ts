import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/icon/icon.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/text-button.js';
import '@material/web/dialog/dialog.js';
import '@material/web/progress/circular-progress.js';
import '../../components/ui-top-bar.ts';
import { showSnackbar } from '../../components/ui-snackbar.ts';
import { popView } from '../../app-shell.ts';
import { blockArtist, unblockArtist, blockAlbum, unblockAlbum } from '../library/store.ts';
import { settings } from '../settings/store.ts';
import { result, savePlaylist } from './store.ts';
import type { SelectedSong } from '../../types.ts';

// ---------------------------------------------------------------------------
// Element
// ---------------------------------------------------------------------------

const name = 'result-view';

/** Full-page result screen showing built tracks with block and save actions. */
@customElement(name)
export class ResultView extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: block;
    }

    md-list {
      padding: 0;
    }

    md-list-item {
      --md-list-item-leading-space: 16px;
      --md-list-item-trailing-space: 8px;
    }

    .track-count {
      padding: 12px 16px 4px;
      font-size: 0.875rem;
      color: var(--md-sys-color-on-surface-variant);
    }

    .action-row {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      padding: 16px;
      gap: 8px;
    }

    .save-error {
      font-size: 0.875rem;
      color: var(--md-sys-color-error);
      padding: 0 4px;
    }

    .save-btn-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .save-btn-row md-filled-button {
      flex: 1;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      gap: 16px;
      text-align: center;
      font-size: 0.9375rem;
      color: var(--md-sys-color-on-surface-variant);
    }

    .block-buttons {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
  `;

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  @state()
  private _saveState: 'idle' | 'saving' | 'error' = 'idle';

  @state()
  private _saveError = '';

  @state()
  private _confirmOpen = false;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  override render() {
    const tracks = result.get();
    const s = settings.get();

    return html`
      <ui-top-bar heading="Result" back @back="${this._onBack}"></ui-top-bar>

      ${tracks.length === 0
        ? this._renderEmptyState()
        : html`
            <div class="track-count">${tracks.length} track${tracks.length === 1 ? '' : 's'}</div>

            <md-list>
              ${tracks.map((song) => this._renderTrack(song))}
            </md-list>

            <div class="action-row">
              ${this._saveState === 'error'
                ? html`<div class="save-error">${this._saveError}</div>`
                : ''}
              <div class="save-btn-row">
                <md-filled-button
                  ?disabled="${this._saveState === 'saving'}"
                  @click="${this._onSaveClick}"
                >
                  ${this._saveState === 'saving'
                    ? html`<md-circular-progress indeterminate slot="icon"></md-circular-progress>
                        Saving…`
                    : 'Save to TIDAL'}
                </md-filled-button>
                ${this._saveState === 'error'
                  ? html`
                      <md-text-button @click="${this._onSaveClick}">Retry</md-text-button>
                    `
                  : ''}
              </div>

              <md-dialog ?open="${this._confirmOpen}" @closed="${() => { this._confirmOpen = false; }}">
                <div slot="headline">Save playlist?</div>
                <div slot="content">
                  This will replace any existing TIDAL playlist named
                  "<strong>${s.playlistName}</strong>".
                </div>
                <div slot="actions">
                  <md-text-button @click="${() => { this._confirmOpen = false; }}">Cancel</md-text-button>
                  <md-filled-button @click="${this._onSaveConfirmed}">Save</md-filled-button>
                </div>
              </md-dialog>
            </div>
          `}
    `;
  }

  // -----------------------------------------------------------------------
  // Track row renderer
  // -----------------------------------------------------------------------

  private _renderTrack(song: SelectedSong) {
    const headline = song.trackTitle;
    const supporting = song.artistName;

    return html`
      <md-list-item>
        <span slot="headline">${headline}</span>
        <span slot="supporting-text">${supporting}</span>
        <div slot="end" class="block-buttons">
          <md-icon-button
            aria-label="Block artist ${song.artistName}"
            title="Block artist"
            @click="${() => this._onBlockArtist(song)}"
          >
            <md-icon>person_off</md-icon>
          </md-icon-button>
          <md-icon-button
            aria-label="Block album ${song.albumTitle}"
            title="Block album"
            @click="${() => this._onBlockAlbum(song)}"
          >
            <md-icon>album</md-icon>
          </md-icon-button>
        </div>
      </md-list-item>
    `;
  }

  // -----------------------------------------------------------------------
  // Empty state renderer
  // -----------------------------------------------------------------------

  private _renderEmptyState() {
    return html`
      <div class="empty-state">
        <span>No tracks found.</span>
        <span>Try adding more sources or adjusting settings.</span>
        <md-text-button @click="${this._onBack}">Go back</md-text-button>
      </div>
    `;
  }

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  private _onBack(): void {
    popView();
  }

  private _onBlockArtist(song: SelectedSong): void {
    blockArtist(song.artistName);
    showSnackbar(`Added "${song.artistName}" to Blocked`, 'info', {
      duration: 5000,
      action: {
        label: 'Undo',
        callback: () => unblockArtist(song.artistName),
      },
    });
  }

  private _onBlockAlbum(song: SelectedSong): void {
    blockAlbum(song.albumTitle);
    showSnackbar(`Added "${song.albumTitle}" to Blocked`, 'info', {
      duration: 5000,
      action: {
        label: 'Undo',
        callback: () => unblockAlbum(song.albumTitle),
      },
    });
  }

  private _onSaveClick(): void {
    this._confirmOpen = true;
  }

  private _onSaveConfirmed(): void {
    this._confirmOpen = false;
    const s = settings.get();
    this._saveState = 'saving';
    this._saveError = '';

    savePlaylist(s.playlistName, s.playlistDescription)
      .then(() => {
        this._saveState = 'idle';
        showSnackbar('Playlist saved to TIDAL!', 'success');
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this._saveState = 'error';
        this._saveError = message;
      });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: ResultView;
  }
}
