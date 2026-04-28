import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '@material/web/divider/divider.js';
import '@material/web/dialog/dialog.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/icon/icon.js';
import '@material/web/button/text-button.js';
import '@material/web/button/filled-button.js';
import '../../components/ui-top-bar.ts';
import { logout } from '../auth/store.ts';
import { pushView } from '../../app-shell.ts';
import { showSnackbar } from '../../components/ui-snackbar.ts';
import { importSettings, exportSettings } from './store.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DialogMode = 'none' | 'import-confirm' | 'impressum';

// ---------------------------------------------------------------------------
// Element
// ---------------------------------------------------------------------------

const name = 'settings-view';

/** Full-page settings screen with export/import, account logout, and optional impressum. */
@customElement(name)
export class SettingsView extends SignalWatcher(LitElement) {
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

    .trailing-btn {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .section-header {
      padding: 12px 16px 4px;
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--md-sys-color-on-surface-variant);
    }

    md-divider {
      margin: 4px 0;
    }

    .impressum-body {
      white-space: pre-wrap;
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--md-sys-color-on-surface);
      padding: 8px 0;
    }

    .dialog-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 8px 16px 16px;
    }

    /* Hidden file input */
    input[type='file'] {
      display: none;
    }
  `;

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  @state()
  private _dialogMode: DialogMode = 'none';

  @state()
  private _pendingImportJson: unknown = null;

  @state()
  private _impressumText = '';

  @state()
  private _impressumAvailable: boolean | null = null;

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  override connectedCallback(): void {
    super.connectedCallback();
    void this._checkImpressum();
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  override render() {
    return html`
      <ui-top-bar heading="Settings"></ui-top-bar>

      <md-list>
        <!-- Export / Import -->
        <md-list-item
          type="button"
          headline="Export config"
          @click="${this._onExport}"
        >
          <div slot="end" class="trailing-btn">
            <md-icon-button aria-label="Export config" tabindex="-1">
              <md-icon>upload</md-icon>
            </md-icon-button>
          </div>
        </md-list-item>

        <md-list-item
          type="button"
          headline="Import config"
          @click="${this._onImportClick}"
        >
          <div slot="end" class="trailing-btn">
            <md-icon-button aria-label="Import config" tabindex="-1">
              <md-icon>download</md-icon>
            </md-icon-button>
          </div>
        </md-list-item>

        <md-divider></md-divider>

        <!-- Account -->
        <div class="section-header">Account</div>
        <md-list-item
          type="button"
          headline="Logged in"
          @click="${this._onLogout}"
        >
          <div slot="end" class="trailing-btn">
            <md-text-button tabindex="-1">Logout</md-text-button>
          </div>
        </md-list-item>

        ${this._impressumAvailable
          ? html`
              <md-divider></md-divider>
              <md-list-item
                type="button"
                headline="Impressum"
                @click="${this._onImpressumClick}"
              >
                <div slot="end" class="trailing-btn">
                  <md-icon-button aria-label="Show Impressum" tabindex="-1">
                    <md-icon>chevron_right</md-icon>
                  </md-icon-button>
                </div>
              </md-list-item>
            `
          : ''}
      </md-list>

      <!-- Hidden file input for import -->
      <input
        type="file"
        accept=".json"
        id="file-input"
        @change="${this._onFileSelected}"
      />

      <!-- Import confirmation dialog -->
      <md-dialog ?open="${this._dialogMode === 'import-confirm'}">
        <div slot="headline">Replace current settings?</div>
        <div slot="content">
          This will overwrite all current settings with the imported file. This cannot be undone.
        </div>
        <div slot="actions">
          <md-text-button @click="${this._onImportCancel}">Cancel</md-text-button>
          <md-filled-button @click="${this._onImportConfirm}">Replace</md-filled-button>
        </div>
      </md-dialog>

      <!-- Impressum dialog -->
      <md-dialog ?open="${this._dialogMode === 'impressum'}">
        <div slot="headline">Impressum</div>
        <div slot="content">
          <div class="impressum-body">${this._impressumText}</div>
        </div>
        <div slot="actions">
          <md-text-button @click="${this._closeDialog}">Close</md-text-button>
        </div>
      </md-dialog>
    `;
  }

  // -----------------------------------------------------------------------
  // Export
  // -----------------------------------------------------------------------

  private _onExport(): void {
    const blob = new Blob([exportSettings()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tidal-playlist-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // -----------------------------------------------------------------------
  // Import
  // -----------------------------------------------------------------------

  private _onImportClick(): void {
    const input = this.shadowRoot?.getElementById('file-input') as HTMLInputElement | null;
    if (input) {
      input.value = '';
      input.click();
    }
  }

  private _onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(reader.result as string);
        this._pendingImportJson = parsed;
        this._dialogMode = 'import-confirm';
      } catch {
        showSnackbar('Invalid JSON file.', 'error');
      }
    };
    reader.readAsText(file);
  }

  private _onImportCancel(): void {
    this._pendingImportJson = null;
    this._dialogMode = 'none';
  }

  private _onImportConfirm(): void {
    const success = importSettings(this._pendingImportJson);
    this._pendingImportJson = null;
    this._dialogMode = 'none';
    if (success) {
      showSnackbar('Settings imported.', 'success');
    } else {
      showSnackbar('Invalid settings file. Import failed.', 'error');
    }
  }

  // -----------------------------------------------------------------------
  // Logout
  // -----------------------------------------------------------------------

  private _onLogout(): void {
    void logout().then(() => {
      pushView('login');
    });
  }

  // -----------------------------------------------------------------------
  // Impressum
  // -----------------------------------------------------------------------

  private async _checkImpressum(): Promise<void> {
    try {
      const res = await fetch('/api/impressum/available');
      this._impressumAvailable = res.ok;
    } catch {
      this._impressumAvailable = false;
    }
  }

  private async _onImpressumClick(): Promise<void> {
    if (this._impressumText) {
      this._dialogMode = 'impressum';
      return;
    }

    try {
      const res = await fetch('/api/impressum');
      if (!res.ok) {
        showSnackbar('Could not load Impressum.', 'error');
        return;
      }
      this._impressumText = await res.text();
      this._dialogMode = 'impressum';
    } catch {
      showSnackbar('Could not load Impressum.', 'error');
    }
  }

  private _closeDialog(): void {
    this._dialogMode = 'none';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: SettingsView;
  }
}
