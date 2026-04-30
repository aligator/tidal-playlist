import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/switch/switch.js';
import '@material/web/textfield/filled-text-field.js';
import '@material/web/button/text-button.js';
import '@material/web/list/list-item.js';
import '@material/web/icon/icon.js';
import { listStyles } from '../../styles/list.ts';
import { t } from '../../i18n/index.ts';
import { viewStack } from '../../app-shell.ts';
import { settings, updateSettings } from '../settings/store.ts';

const TRACK_COUNT_OPTIONS = [10, 20, 30, 50, 100, 200, 500, 1000];

@customElement('playlist-config-panel')
export class PlaylistConfigPanel extends SignalWatcher(LitElement) {
  static override styles = [
    listStyles,
    css`
      :host {
        display: block;
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

      .pool-card {
        background: var(--md-sys-color-surface-container);
        border-radius: 12px;
        overflow: hidden;
      }

      .pool-card md-list-item {
        --md-list-item-container-color: transparent;
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
    `,
  ];

  @state()
  private _descriptionVisible = false;

  override render() {
    const s = settings.get();
    return html`
      <!-- Pool -->
      <div class="section">
        <div class="section-label">${t('playlist.config.pool')}</div>
        <div class="pool-card">
          <md-list-item type="button" @click="${this._onManageLibrary}">
            <span slot="headline">${t('playlist.config.manageLibrary')}</span>
            <md-icon slot="end">arrow_forward</md-icon>
          </md-list-item>
        </div>
      </div>

      <!-- Settings -->
      <div class="section">
        <div class="section-label">${t('playlist.config.settings')}</div>
        <div class="field-row">
          <span class="field-label">${t('playlist.config.tracks')}</span>
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
        <div class="switch-row">
          <span class="switch-label">${t('playlist.config.shuffle')}</span>
          <md-switch ?selected="${s.shufflePlaylist}" @change="${this
            ._onShuffleChange}"></md-switch>
        </div>
      </div>

      <!-- Playlist name / description -->
      <div class="section">
        <div class="section-label">${t('playlist.config.playlist')}</div>
        <md-filled-text-field
          label="${t('playlist.config.name')}"
          .value="${s.playlistName}"
          @input="${this._onNameInput}"
        ></md-filled-text-field>
        ${this._descriptionVisible
          ? html`
            <md-filled-text-field
              label="${t('playlist.config.description')}"
              type="textarea"
              rows="3"
              .value="${s.playlistDescription}"
              @input="${this._onDescriptionInput}"
            ></md-filled-text-field>
          `
          : html`
            <md-text-button @click="${this._onToggleDescription}">
              <md-icon slot="icon">add</md-icon>
              ${t('playlist.config.addDescription')}
            </md-text-button>
          `}
      </div>
    `;
  }

  private _onManageLibrary(): void {
    viewStack.set(['library']);
  }

  private _onCountChange(event: Event): void {
    const select = event.target as HTMLElement & { value?: string };
    const parsed = Number(select.value ?? '');
    if (Number.isInteger(parsed) && parsed > 0) {
      updateSettings({ count: parsed });
    }
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
}

declare global {
  interface HTMLElementTagNameMap {
    'playlist-config-panel': PlaylistConfigPanel;
  }
}
