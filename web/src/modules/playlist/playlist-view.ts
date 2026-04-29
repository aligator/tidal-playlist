import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/progress/linear-progress.js';
import '@material/web/chips/chip-set.js';
import '@material/web/chips/filter-chip.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/slider/slider.js';
import '@material/web/switch/switch.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/text-button.js';
import '@material/web/textfield/filled-text-field.js';
import '@material/web/progress/circular-progress.js';
import '@material/web/icon/icon.js';
import '../../components/ui-top-bar.ts';
import '../impressum/impressum-modal.ts';
import { showSnackbar } from '../../components/ui-snackbar.ts';
import { viewStack, pushView } from '../../app-shell.ts';
import { settings, updateSettings } from '../settings/store.ts';
import { buildPlaylist, buildStatus, buildError, poolSourceCount, hasPoolSources } from './store.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COUNTRY_CODES = ['AT', 'AU', 'BE', 'CA', 'CH', 'DE', 'DK', 'ES', 'FI', 'FR', 'GB', 'IE', 'IT', 'NL', 'NO', 'NZ', 'PL', 'PT', 'SE', 'US'];
const TRACK_COUNT_OPTIONS = [10, 20, 30, 50, 100];
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

// ---------------------------------------------------------------------------
// Element
// ---------------------------------------------------------------------------

const name = 'playlist-view';

/** Full-page playlist builder screen with pool, settings, name, and build action. */
@customElement(name)
export class PlaylistView extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: block;
    }

    md-linear-progress {
      width: 100%;
    }

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

    .pool-count {
      font-size: 0.875rem;
      color: var(--md-sys-color-on-surface-variant);
      padding: 4px 0 8px;
    }

    .empty-pool-hint {
      font-size: 0.875rem;
      color: var(--md-sys-color-on-surface-variant);
      padding: 4px 0 8px;
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

    .action-section {
      position: sticky;
      bottom: calc(80px + env(safe-area-inset-bottom));
      background: var(--md-sys-color-background);
      padding: 16px;
      z-index: 1;
    }

    @media (min-width: 768px) {
      .action-section {
        position: static;
      }
    }

    .build-btn-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .build-btn-row md-filled-button {
      flex: 1;
    }

    .disabled-hint {
      font-size: 0.875rem;
      color: var(--md-sys-color-on-surface-variant);
      padding: 8px 0 0;
    }

    .build-error {
      font-size: 0.875rem;
      color: var(--md-sys-color-error);
      padding: 8px 0 0;
    }
  `;

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  @state()
  private _descriptionVisible = false;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  override render() {
    const s = settings.get();
    const status = buildStatus.get();
    const isBuilding = status === 'building';
    const poolCounts = poolSourceCount.get();
    const hasSources = hasPoolSources.get();
    const lastError = buildError.get();

    return html`
      <ui-top-bar heading="Tidal Playlist"></ui-top-bar>

      <md-linear-progress
        ?indeterminate="${isBuilding}"
        style="opacity: ${isBuilding ? '1' : '0'};"
      ></md-linear-progress>

      <!-- Pool section -->
      <div class="section">
        <div class="section-label">Pool</div>

        <md-chip-set>
          <md-filter-chip
            label="Liked artists"
            ?selected="${s.includeLikedArtistsPool}"
            @click="${this._onToggleLikedArtists}"
          ></md-filter-chip>
          <md-filter-chip
            label="Liked albums"
            ?selected="${s.includeLikedAlbumsPool}"
            @click="${this._onToggleLikedAlbums}"
          ></md-filter-chip>
        </md-chip-set>

        ${hasSources
          ? html`
              <div class="pool-count">
                ${this._poolSummary(poolCounts)}
              </div>
            `
          : html`
              <div class="empty-pool-hint">
                Add sources in Library to build a playlist.
              </div>
            `}

        <md-text-button @click="${this._onManageLibrary}">
          Manage Library
          <md-icon slot="icon">arrow_forward</md-icon>
        </md-text-button>
      </div>

      <!-- Settings section -->
      <div class="section">
        <div class="section-label">Settings</div>

        <div class="field-row">
          <span class="field-label">Country</span>
          <md-outlined-select
            .value="${s.countryCode}"
            @change="${this._onCountryChange}"
          >
            ${COUNTRY_CODES.map(
              (code) => html`
                <md-select-option
                  .value="${code}"
                  ?selected="${s.countryCode === code}"
                >
                  <div slot="headline">${code} — ${countryNames.of(code)}</div>
                </md-select-option>
              `,
            )}
          </md-outlined-select>
        </div>

        <div class="field-row">
          <span class="field-label">Tracks</span>
          <md-outlined-select
            .value="${String(s.count)}"
            @change="${this._onCountChange}"
          >
            ${TRACK_COUNT_OPTIONS.map(
              (n) => html`
                <md-select-option
                  .value="${String(n)}"
                  ?selected="${s.count === n}"
                >
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
          <md-switch
            ?selected="${s.shufflePlaylist}"
            @change="${this._onShuffleChange}"
          ></md-switch>
        </div>
      </div>

      <!-- Name section -->
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

      <!-- Action section -->
      <div class="action-section">
        <div class="build-btn-row">
          <md-filled-button
            ?disabled="${!hasSources || isBuilding}"
            @click="${this._onBuild}"
          >
            ${isBuilding
              ? html`<md-circular-progress indeterminate slot="icon"></md-circular-progress>
                  Building…`
              : 'Build Playlist'}
          </md-filled-button>
        </div>

        ${!hasSources
          ? html`<div class="disabled-hint">Add artists or albums to Library first.</div>`
          : ''}

        ${status === 'error' && lastError
          ? html`<div class="build-error">${lastError}</div>`
          : ''}
      </div>

      <impressum-modal></impressum-modal>
    `;
  }

  // -----------------------------------------------------------------------
  // Pool summary
  // -----------------------------------------------------------------------

  private _poolSummary(p: { artistCount: number; albumCount: number; likedArtists: boolean; likedAlbums: boolean }): string {
    const parts: string[] = [];
    if (p.likedArtists) parts.push('Liked artists');
    if (p.artistCount > 0) parts.push(`${p.artistCount} artist${p.artistCount === 1 ? '' : 's'}`);
    if (p.likedAlbums) parts.push('Liked albums');
    if (p.albumCount > 0) parts.push(`${p.albumCount} album${p.albumCount === 1 ? '' : 's'}`);
    return parts.join(' · ');
  }

  // -----------------------------------------------------------------------
  // Pool handlers
  // -----------------------------------------------------------------------

  private _onToggleLikedArtists(): void {
    const s = settings.get();
    updateSettings({ includeLikedArtistsPool: !s.includeLikedArtistsPool });
  }

  private _onToggleLikedAlbums(): void {
    const s = settings.get();
    updateSettings({ includeLikedAlbumsPool: !s.includeLikedAlbumsPool });
  }

  private _onManageLibrary(): void {
    viewStack.set(['library']);
  }

  // -----------------------------------------------------------------------
  // Settings handlers
  // -----------------------------------------------------------------------

  private _onCountryChange(event: Event): void {
    const select = event.target as HTMLElement & { value?: string };
    const value = select.value ?? '';
    if (value) {
      updateSettings({ countryCode: value });
    }
  }

  private _onCountChange(event: Event): void {
    const select = event.target as HTMLElement & { value?: string };
    const parsed = Number(select.value ?? '');
    if (Number.isInteger(parsed) && parsed > 0) {
      updateSettings({ count: parsed });
    }
  }

  private _onSliderChange(event: Event): void {
    const slider = event.target as HTMLElement & { value?: number };
    const raw = slider.value ?? 0;
    updateSettings({ albumPoolWeight: raw / 100 });
  }

  private _onShuffleChange(event: Event): void {
    const sw = event.target as HTMLElement & { selected?: boolean };
    updateSettings({ shufflePlaylist: sw.selected ?? false });
  }

  // -----------------------------------------------------------------------
  // Name / description handlers
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Build handler
  // -----------------------------------------------------------------------

  private _onBuild(): void {
    buildPlaylist()
      .then(() => {
        pushView('result');
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        showSnackbar(message, 'error');
      });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: PlaylistView;
  }
}
