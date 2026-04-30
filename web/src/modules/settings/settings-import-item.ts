import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@material/web/list/list-item.js';
import '@material/web/icon/icon.js';
import '@material/web/dialog/dialog.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/text-button.js';
import { showSnackbar } from '../../components/ui-snackbar.ts';
import { importSettings } from './store.ts';

@customElement('settings-import-item')
export class SettingsImportItem extends LitElement {
  static override styles = css`
    input[type="file"] {
      display: none;
    }
  `;

  @state()
  private _open = false;
  @state()
  private _pending: unknown = null;

  override render() {
    return html`
      <md-list-item type="button" @click="${this._onImportClick}">
        <span slot="headline">Import config</span>
        <md-icon slot="end">download</md-icon>
      </md-list-item>

      <input type="file" accept=".json" @change="${this._onFileSelected}" />

      <md-dialog ?open="${this._open}" @closed="${this._onCancel}">
        <div slot="headline">Replace current settings?</div>
        <div slot="content">
          This will overwrite all current settings with the imported file. This cannot be undone.
        </div>
        <div slot="actions">
          <md-text-button @click="${this._onCancel}">Cancel</md-text-button>
          <md-filled-button @click="${this._onConfirm}">Replace</md-filled-button>
        </div>
      </md-dialog>
    `;
  }

  private _onImportClick(): void {
    const input = this.shadowRoot?.querySelector('input[type="file"]') as HTMLInputElement | null;
    if (input) {
      input.value = '';
      input.click();
    }
  }

  private _onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        this._pending = JSON.parse(reader.result as string);
        this._open = true;
      } catch {
        showSnackbar('Invalid JSON file.', 'error');
      }
    };
    reader.readAsText(file);
  }

  private _onCancel(): void {
    this._pending = null;
    this._open = false;
  }

  private _onConfirm(): void {
    const success = importSettings(this._pending);
    this._pending = null;
    this._open = false;
    if (success) {
      showSnackbar('Settings imported.', 'success');
    } else {
      showSnackbar('Invalid settings file. Import failed.', 'error');
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'settings-import-item': SettingsImportItem;
  }
}
