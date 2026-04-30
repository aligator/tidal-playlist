import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/text-button.js';
import '@material/web/progress/linear-progress.js';
import './playlist-save-dialog.ts';
import '../../components/ui-top-bar.ts';
import '../../components/ui-icon-label-button.ts';
import { listStyles } from '../../styles/list.ts';
import { showSnackbar } from '../../components/ui-snackbar.ts';
import { popView } from '../../app-shell.ts';
import { blockAlbum, blockArtist, unblockAlbum, unblockArtist } from '../library/store.ts';
import { settings } from '../settings/store.ts';
import { result, savePlaylist, saveProgress } from './store.ts';
import type { SelectedSong } from '../../types.ts';

// ---------------------------------------------------------------------------
// Element
// ---------------------------------------------------------------------------

const name = 'result-view';

/** Full-page result screen showing built tracks with block and save actions. */
@customElement(name)
export class ResultView extends SignalWatcher(LitElement) {
  static override styles = [
    listStyles,
    css`
      :host {
        display: block;
      }

      .track-count {
        padding: 12px 16px 4px;
        font-size: 0.875rem;
        color: var(--md-sys-color-on-surface-variant);
      }

      .action-row {
        position: sticky;
        bottom: 0;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        padding: 16px;
        gap: 8px;
        background: var(--md-sys-color-background);
        border-top: 1px solid var(--md-sys-color-outline-variant);
        z-index: 1;
      }

      .save-progress {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.875rem;
        color: var(--md-sys-color-on-surface-variant);
      }

      .save-progress md-linear-progress {
        flex: 1;
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

      .block-btns {
        display: flex;
        gap: 2px;
      }
    `,
  ];

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  @state()
  private _saveState: 'idle' | 'error' = 'idle';

  @state()
  private _saveError = '';

  @state()
  private _confirmOpen = false;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  override render() {
    const tracks = result.get();
    const pct = saveProgress.get();
    const isSaving = pct !== null;

    return html`
      <ui-top-bar heading="Result" back @back="${this._onBack}"></ui-top-bar>

      ${tracks.length === 0 ? this._renderEmptyState() : html`
        <div class="track-count">${tracks.length} track${tracks.length === 1 ? '' : 's'}</div>
        <md-list>
          ${tracks.map((song) => this._renderTrack(song))}
        </md-list>

        <div class="action-row">
          ${isSaving
            ? html`
              <div class="save-progress">
                <md-linear-progress .value="${(pct ?? 0) / 100}"></md-linear-progress>
                <span>${pct}%</span>
              </div>
            `
            : ''} ${this._saveState === 'error'
            ? html`
              <div class="save-error">${this._saveError}</div>
            `
            : ''}
          <div class="save-btn-row">
            <md-filled-button
              ?disabled="${isSaving}"
              @click="${this._onSaveClick}"
            >
              ${isSaving ? 'Saving…' : 'Save to TIDAL'}
            </md-filled-button>
            ${this._saveState === 'error'
              ? html`
                <md-text-button @click="${this._onSaveClick}">Retry</md-text-button>
              `
              : ''}
          </div>

          <playlist-save-dialog
            ?open="${this._confirmOpen}"
            @closed="${() => {
              this._confirmOpen = false;
            }}"
            @confirmed="${this._onSaveConfirmed}"
          ></playlist-save-dialog>
        </div>
      `}
    `;
  }

  // -----------------------------------------------------------------------
  // Track row renderer
  // -----------------------------------------------------------------------

  private _renderTrack(song: SelectedSong) {
    return html`
      <md-list-item>
        <span slot="headline">${song.trackTitle}</span>
        <span slot="supporting-text">${song.artistName}</span>
        <div slot="end" class="block-btns">
          <ui-icon-label-button
            icon="person_remove"
            label="Artist"
            aria-label="Block artist ${song.artistName}"
            @click="${() => this._onBlockArtist(song)}"
          ></ui-icon-label-button>
          <ui-icon-label-button
            icon="album"
            label="Album"
            aria-label="Block album ${song.albumTitle}"
            @click="${() => this._onBlockAlbum(song)}"
          ></ui-icon-label-button>
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
    this._saveState = 'idle';
    this._saveError = '';

    savePlaylist(s.playlistName, s.playlistDescription)
      .then(() => {
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
