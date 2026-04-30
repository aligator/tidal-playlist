import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/progress/linear-progress.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/slider/slider.js';
import '@material/web/switch/switch.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/text-button.js';
import '@material/web/textfield/filled-text-field.js';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/icon/icon.js';
import '@material/web/dialog/dialog.js';
import '../../components/ui-top-bar.ts';
import { showSnackbar } from '../../components/ui-snackbar.ts';
import { viewStack } from '../../app-shell.ts';
import { settings, updateSettings } from '../settings/store.ts';
import { blockAlbum, blockArtist, unblockAlbum, unblockArtist } from '../library/store.ts';
import type { SelectedSong } from '../../types.ts';
import {
  buildError,
  buildPlaylist,
  buildProgress,
  buildStatus,
  hasPoolSources,
  resetBuild,
  result,
  savePlaylist,
  saveProgress,
} from './store.ts';

const TRACK_COUNT_OPTIONS = [10, 20, 30, 50, 100, 200, 500, 1000];

const name = 'playlist-view';

/** Full-page playlist builder: config, inline result list, unified sticky action bar. */
@customElement(name)
export class PlaylistView extends SignalWatcher(LitElement) {
  static override styles = css`
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

    /* ---- Config ---- */

    .section {
      padding: 16px 16px 8px;
    }

    .section-label {
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--md-sys-color-on-surface-variant);
      margin-bottom: 8px;
    }

    .pool-card {
      background: var(--md-sys-color-surface-container);
      border-radius: 12px;
      overflow: hidden;
    }

    .pool-manage-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 16px;
      width: 100%;
      border: none;
      background: transparent;
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      color: var(--md-sys-color-on-surface);
      border-radius: 0;
    }

    .pool-manage-row:hover {
      background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
    }

    .pool-manage-title {
      font-size: 0.9375rem;
      margin-bottom: 1px;
    }

    .pool-manage-sub {
      font-size: 0.8125rem;
      color: var(--md-sys-color-on-surface-variant);
    }

    .pool-manage-row md-icon {
      color: var(--md-sys-color-on-surface-variant);
      flex-shrink: 0;
    }

    .field-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
    }

    .field-label {
      font-size: 0.9375rem;
      color: var(--md-sys-color-on-surface);
      min-width: 80px;
      flex-shrink: 0;
    }

    md-outlined-select {
      flex: 1;
    }

    .slider-section {
      padding: 8px 0;
    }

    .slider-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--md-sys-color-on-surface-variant);
      margin-bottom: 4px;
    }

    md-slider {
      width: 100%;
    }

    .switch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
    }

    .switch-label {
      font-size: 0.9375rem;
      color: var(--md-sys-color-on-surface);
    }

    md-filled-text-field {
      width: 100%;
      margin-bottom: 8px;
    }

    /* ---- Result list ---- */

    .result-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 8px 4px 16px;
      border-top: 1px solid var(--md-sys-color-outline-variant);
    }

    .result-count {
      font-size: 0.875rem;
      color: var(--md-sys-color-on-surface-variant);
    }

    md-list {
      padding: 0;
    }

    md-list-item {
      --md-list-item-leading-space: 16px;
      --md-list-item-trailing-space: 8px;
    }

    .block-btns {
      display: flex;
      gap: 2px;
    }

    .block-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 8px;
      color: var(--md-sys-color-on-surface-variant);
      font-family: inherit;
      font-size: 0.625rem;
      letter-spacing: 0.02em;
      min-width: 44px;
    }

    .block-btn:hover {
      background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
    }

    /* ---- Action bar — always at bottom, never scrolls ---- */

    .action-bar {
      flex-shrink: 0;
      background: var(--md-sys-color-background);
      border-top: 1px solid var(--md-sys-color-outline-variant);
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .btn-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .btn-row md-filled-button {
      flex: 1;
    }

    .progress-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .progress-row md-linear-progress {
      flex: 1;
    }

    .progress-pct {
      font-size: 0.875rem;
      font-variant-numeric: tabular-nums;
      color: var(--md-sys-color-on-surface-variant);
      min-width: 3ch;
      text-align: right;
    }

    .building-label {
      font-size: 0.875rem;
      color: var(--md-sys-color-on-surface-variant);
    }

    .hint {
      font-size: 0.875rem;
      color: var(--md-sys-color-on-surface-variant);
    }

    .error-text {
      font-size: 0.875rem;
      color: var(--md-sys-color-error);
    }

    .result-toggle-row {
      display: flex;
      align-items: center;
      border-top: 1px solid var(--md-sys-color-outline-variant);
    }

    .config-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px 8px 16px;
      border: none;
      background: none;
      width: 100%;
      cursor: pointer;
      font-family: inherit;
      color: var(--md-sys-color-on-surface-variant);
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .config-toggle:hover {
      background: color-mix(in srgb, var(--md-sys-color-on-surface) 6%, transparent);
    }

    .config-toggle md-icon {
      font-size: 18px;
      transition: transform 200ms ease;
    }

    .config-toggle md-icon.rotated {
      transform: rotate(180deg);
    }

    .config-body {
      overflow: hidden;
      display: grid;
      grid-template-rows: 1fr;
      transition: grid-template-rows 220ms ease;
    }

    .config-body.collapsed {
      grid-template-rows: 0fr;
    }

    .config-body > .config-inner {
      overflow: hidden;
    }
  `;

  @state()
  private _descriptionVisible = false;
  @state()
  private _confirmOpen = false;
  @state()
  private _saveError = '';
  @state()
  private _saveState: 'idle' | 'error' = 'idle';
  @state()
  private _configOpen = true;
  @state()
  private _tracksOpen = true;

  private _prevBuildStatus: string | null = null;

  protected override updated(changed: PropertyValues): void {
    void changed;
    const status = buildStatus.get();
    if (this._prevBuildStatus === 'building' && status === 'done') {
      this._configOpen = false;
      this._tracksOpen = true;
    }
    this._prevBuildStatus = status;
  }

  override render() {
    const s = settings.get();
    const status = buildStatus.get();
    const isBuilding = status === 'building';
    const isDone = status === 'done';
    const pct = buildProgress.get() ?? 0;
    const savePct = saveProgress.get();
    const isSaving = savePct !== null;
    const tracks = result.get();
    const hasSources = hasPoolSources.get();
    const lastError = buildError.get();

    return html`
      <ui-top-bar heading="Tidal Playlist"></ui-top-bar>

      <div class="scrollable">
        <!-- Collapsible config -->
        <button class="config-toggle" @click="${this._onToggleConfig}">
          <span>Settings</span>
          <md-icon class="${this._configOpen ? '' : 'rotated'}">expand_less</md-icon>
        </button>

        <div class="config-body ${this._configOpen ? '' : 'collapsed'}">
          <div class="config-inner">
            <!-- Pool -->
            <div class="section">
              <div class="section-label">Pool</div>
              <div class="pool-card">
                <button class="pool-manage-row" @click="${this._onManageLibrary}">
                  <div class="pool-manage-title">Manage Library</div>
                  <md-icon>arrow_forward</md-icon>
                </button>
              </div>
            </div>

            <!-- Settings -->
            <div class="section">
              <div class="section-label">Settings</div>
              <div class="field-row">
                <span class="field-label">Tracks</span>
                <md-outlined-select .value="${String(s.count)}" @change="${this._onCountChange}">
                  ${TRACK_COUNT_OPTIONS.map(
                    (n) =>
                      html`
                        <md-select-option .value="${String(n)}" ?selected="${s.count === n}">
                          <div slot="headline">${n}</div>
                        </md-select-option>
                      `,
                  )}
                </md-outlined-select>
              </div>
              <div class="slider-section">
                <div class="slider-labels">
                  <span>More artists</span>
                  <span>More albums</span>
                </div>
                <md-slider
                  min="0"
                  max="100"
                  .value="${Math.round(s.albumPoolWeight * 100)}"
                  @change="${this._onSliderChange}"
                ></md-slider>
              </div>
              <div class="switch-row">
                <span class="switch-label">Shuffle</span>
                <md-switch ?selected="${s.shufflePlaylist}" @change="${this
                  ._onShuffleChange}"></md-switch>
              </div>
            </div>

            <!-- Playlist name -->
            <div class="section">
              <div class="section-label">Playlist</div>
              <md-filled-text-field
                label="Playlist name"
                .value="${s.playlistName}"
                @input="${this._onNameInput}"
              ></md-filled-text-field>
              ${this._descriptionVisible
                ? html`
                  <md-filled-text-field
                    label="Description"
                    type="textarea"
                    rows="3"
                    .value="${s.playlistDescription}"
                    @input="${this._onDescriptionInput}"
                  ></md-filled-text-field>
                `
                : html`
                  <md-text-button @click="${this._onToggleDescription}">
                    <md-icon slot="icon">add</md-icon>
                    Add description
                  </md-text-button>
                `}
            </div>
          </div>
          <!-- end .config-inner -->
        </div>
        <!-- end .config-body -->

        <!-- Result list (collapsible) -->
        ${isDone && tracks.length > 0
          ? html`
            <div class="result-toggle-row">
              <button class="config-toggle" style="flex:1" @click="${this._onToggleTracks}">
                <span>${tracks.length} track${tracks.length === 1 ? '' : 's'}</span>
                <md-icon class="${this._tracksOpen ? '' : 'rotated'}">expand_less</md-icon>
              </button>
              <md-text-button @click="${this._onRebuild}">
                <md-icon slot="icon">refresh</md-icon>
                New
              </md-text-button>
            </div>
            <div class="config-body ${this._tracksOpen ? '' : 'collapsed'}">
              <div class="config-inner">
                <md-list>
                  ${tracks.map((song) => this._renderTrack(song))}
                </md-list>
              </div>
            </div>
          `
          : ''}
      </div><!-- end .scrollable -->

      <!-- Action bar — flex-shrink: 0, never scrolls -->
      <div class="action-bar">
        ${isBuilding
          ? html`
            <div class="progress-row">
              <md-linear-progress .value="${pct / 100}"></md-linear-progress>
              <span class="progress-pct">${pct}%</span>
            </div>
            <div class="building-label">Building "${s.playlistName}"…</div>
          `
          : isDone
          ? html`
            ${isSaving
              ? html`
                <div class="progress-row">
                  <md-linear-progress .value="${(savePct ?? 0) / 100}"></md-linear-progress>
                  <span class="progress-pct">${savePct}%</span>
                </div>
              `
              : ''} ${this._saveState === 'error'
              ? html`
                <div class="error-text">${this._saveError}</div>
              `
              : ''}
            <div class="btn-row">
              <md-filled-button ?disabled="${isSaving}" @click="${this._onSaveClick}">
                ${isSaving ? 'Saving…' : 'Save to TIDAL'}
              </md-filled-button>
              ${this._saveState === 'error'
                ? html`
                  <md-text-button @click="${this._onSaveClick}">Retry</md-text-button>
                `
                : ''}
            </div>
          `
          : html`
            <div class="btn-row">
              <md-filled-button ?disabled="${!hasSources}" @click="${this._onBuild}">
                Build Playlist
              </md-filled-button>
            </div>
            ${!hasSources
              ? html`
                <div class="hint">Add artists or albums to Library first.</div>
              `
              : ''} ${status === 'error' && lastError
              ? html`
                <div class="error-text">${lastError}</div>
                ${lastError.toLowerCase().includes('no tracks')
                  ? html`
                    <div class="hint">TIDAL may be rate limiting requests — wait a moment, then try again.</div>
                  `
                  : ''}
              `
              : ''}
          `}
      </div>

      <!-- Save confirm dialog -->
      ${isDone
        ? html`
          <md-dialog ?open="${this._confirmOpen}" @closed="${() => {
            this._confirmOpen = false;
          }}">
            <div slot="headline">Save playlist?</div>
            <div slot="content">
              This will replace any existing TIDAL playlist named "<strong>${s
                .playlistName}</strong>".
            </div>
            <div slot="actions">
              <md-text-button @click="${() => {
                this._confirmOpen = false;
              }}">Cancel</md-text-button>
              <md-filled-button @click="${this._onSaveConfirmed}">Save</md-filled-button>
            </div>
          </md-dialog>
        `
        : ''}
    `;
  }

  private _renderTrack(song: SelectedSong) {
    return html`
      <md-list-item>
        <span slot="headline">${song.trackTitle}</span>
        <span slot="supporting-text">${song.artistName}</span>
        <div slot="end" class="block-btns">
          <button
            class="block-btn"
            aria-label="Block artist ${song.artistName}"
            @click="${() => this._onBlockArtist(song)}"
          >
            <md-icon>person_remove</md-icon>
            <span>Artist</span>
          </button>
          <button
            class="block-btn"
            aria-label="Block album ${song.albumTitle}"
            @click="${() => this._onBlockAlbum(song)}"
          >
            <md-icon>album</md-icon>
            <span>Album</span>
          </button>
        </div>
      </md-list-item>
    `;
  }

  private _onToggleConfig(): void {
    this._configOpen = !this._configOpen;
  }

  private _onToggleTracks(): void {
    this._tracksOpen = !this._tracksOpen;
  }

  private _onManageLibrary(): void {
    viewStack.set(['library']);
  }

  private _onCountChange(event: Event): void {
    const select = event.target as HTMLElement & { value?: string };
    const parsed = Number(select.value ?? '');
    if (Number.isInteger(parsed) && parsed > 0) updateSettings({ count: parsed });
  }

  private _onSliderChange(event: Event): void {
    const slider = event.target as HTMLElement & { value?: number };
    updateSettings({ albumPoolWeight: (slider.value ?? 0) / 100 });
  }

  private _onShuffleChange(event: Event): void {
    const sw = event.target as HTMLElement & { selected?: boolean };
    updateSettings({ shufflePlaylist: sw.selected ?? false });
  }

  private _onNameInput(event: Event): void {
    const field = event.target as HTMLElement & { value?: string };
    updateSettings({ playlistName: field.value ?? '' });
  }

  private _onDescriptionInput(event: Event): void {
    const field = event.target as HTMLElement & { value?: string };
    updateSettings({ playlistDescription: field.value ?? '' });
  }

  private _onToggleDescription(): void {
    this._descriptionVisible = !this._descriptionVisible;
  }

  private _onBuild(): void {
    buildPlaylist().catch((err: unknown) => {
      showSnackbar(err instanceof Error ? err.message : String(err), 'error');
    });
  }

  private _onRebuild(): void {
    resetBuild();
  }

  private _onBlockArtist(song: SelectedSong): void {
    blockArtist(song.artistName);
    showSnackbar(`Added "${song.artistName}" to Blocked`, 'info', {
      duration: 5000,
      action: { label: 'Undo', callback: () => unblockArtist(song.artistName) },
    });
  }

  private _onBlockAlbum(song: SelectedSong): void {
    blockAlbum(song.albumTitle);
    showSnackbar(`Added "${song.albumTitle}" to Blocked`, 'info', {
      duration: 5000,
      action: { label: 'Undo', callback: () => unblockAlbum(song.albumTitle) },
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
      .then(() => showSnackbar('Playlist saved to TIDAL!', 'success'))
      .catch((err: unknown) => {
        this._saveState = 'error';
        this._saveError = err instanceof Error ? err.message : String(err);
      });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: PlaylistView;
  }
}
