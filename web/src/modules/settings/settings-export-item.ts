import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/list/list-item.js';
import '@material/web/icon/icon.js';
import { t } from '../../i18n/index.ts';
import { exportSettings } from './store.ts';

@customElement('settings-export-item')
export class SettingsExportItem extends SignalWatcher(LitElement) {
  override render() {
    return html`
      <md-list-item type="button" @click="${this._onExport}">
        <span slot="headline">${t('settings.export')}</span>
        <md-icon slot="end">upload</md-icon>
      </md-list-item>
    `;
  }

  private _onExport(): void {
    const blob = new Blob([exportSettings()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tidal-playlist-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'settings-export-item': SettingsExportItem;
  }
}
