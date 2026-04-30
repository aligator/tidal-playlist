import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/progress/linear-progress.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/text-button.js';
import { showSnackbar } from '../../components/ui-snackbar.ts';
import { t } from '../../i18n/index.ts';
import { settings } from '../settings/store.ts';
import {
  buildError,
  buildPlaylist,
  buildProgress,
  buildStatus,
  hasPoolSources,
  savePlaylist,
  saveProgress,
} from './store.ts';
import './playlist-save-dialog.ts';

@customElement('playlist-action-bar')
export class PlaylistActionBar extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: var(--md-sys-color-background);
      border-top: 1px solid var(--md-sys-color-outline-variant);
      padding: 12px 16px;
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
  `;

  @state()
  private _confirmOpen = false;
  @state()
  private _saveError = '';
  @state()
  private _saveState: 'idle' | 'error' = 'idle';

  override render() {
    const status = buildStatus.get();
    const isBuilding = status === 'building';
    const isDone = status === 'done';
    const pct = buildProgress.get() ?? 0;
    const savePct = saveProgress.get();
    const isSaving = savePct !== null;
    const hasSources = hasPoolSources.get();
    const lastError = buildError.get();
    const { playlistName } = settings.get();

    return html`
      ${isBuilding
        ? html`
          <div class="progress-row">
            <md-linear-progress .value="${pct / 100}"></md-linear-progress>
            <span class="progress-pct">${pct}%</span>
          </div>
          <div class="building-label">${t('playlist.building', { name: playlistName })}</div>
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
              ${isSaving ? t('playlist.saving') : t('playlist.save')}
            </md-filled-button>
            ${this._saveState === 'error'
              ? html`
                <md-text-button @click="${this._onSaveClick}">${t('playlist.retry')}</md-text-button>
              `
              : ''}
          </div>
        `
        : html`
          <div class="btn-row">
            <md-filled-button ?disabled="${!hasSources}" @click="${this._onBuild}">
              ${t('playlist.build')}
            </md-filled-button>
          </div>
          ${!hasSources
            ? html`
              <div class="hint">${t('playlist.hint.addFirst')}</div>
            `
            : ''} ${status === 'error' && lastError
            ? html`
              <div class="error-text">${lastError}</div>
              ${lastError.toLowerCase().includes('no tracks')
                ? html`
                  <div class="hint">${t('playlist.hint.rateLimit')}</div>
                `
                : ''}
            `
            : ''}
        `}

      <playlist-save-dialog
        ?open="${this._confirmOpen}"
        @closed="${() => {
          this._confirmOpen = false;
        }}"
        @confirmed="${this._onSaveConfirmed}"
      ></playlist-save-dialog>
    `;
  }

  private _onBuild(): void {
    buildPlaylist().catch((err: unknown) => {
      showSnackbar(err instanceof Error ? err.message : String(err), 'error');
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
      .then(() => showSnackbar(t('playlist.saved'), 'success'))
      .catch((err: unknown) => {
        this._saveState = 'error';
        this._saveError = err instanceof Error ? err.message : String(err);
      });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'playlist-action-bar': PlaylistActionBar;
  }
}
