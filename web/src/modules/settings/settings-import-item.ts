import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/list/list-item.js';
import '@material/web/icon/icon.js';
import { showSnackbar } from '../../components/ui-snackbar.ts';
import { t } from '../../i18n/index.ts';
import { importSettings, settings } from './store.ts';
import { TidalApi } from '../tidal/api.ts';

@customElement('settings-import-item')
export class SettingsImportItem extends SignalWatcher(LitElement) {
  static override styles = css`
    input[type="file"] {
      display: none;
    }
  `;

  @state()
  private _loading = false;

  override render() {
    return html`
      <md-list-item type="button" @click="${this._onImportClick}" ?disabled="${this._loading}">
        <span slot="headline">${this._loading ? t('settings.importing') : t('settings.import')}</span>
        <md-icon slot="end">${this._loading ? 'hourglass_empty' : 'download'}</md-icon>
      </md-list-item>

      <input type="file" accept=".json" @change="${this._onFileSelected}" />
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
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        this.dispatchEvent(
          new CustomEvent<{ pending: unknown }>('import-ready', {
            detail: { pending: parsed },
            bubbles: true,
            composed: true,
          }),
        );
      } catch {
        showSnackbar(t('settings.import.error.json'), 'error');
      }
    };
    reader.readAsText(file);
  }

  async runImport(pending: unknown): Promise<void> {
    this._loading = true;
    try {
      const api = new TidalApi(settings.get());
      const success = await importSettings(pending, api);
      if (success) {
        showSnackbar(t('settings.import.success'), 'success');
      } else {
        showSnackbar(t('settings.import.error.invalid'), 'error');
      }
    } catch {
      showSnackbar(t('settings.import.error.connection'), 'error');
    } finally {
      this._loading = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'settings-import-item': SettingsImportItem;
  }
}
