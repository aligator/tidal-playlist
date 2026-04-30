import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/list/list-item.js';
import '@material/web/icon/icon.js';
import { t } from '../../i18n/index.ts';
import { logout } from './store.ts';

@customElement('settings-logout-item')
export class SettingsLogoutItem extends SignalWatcher(LitElement) {
  override render() {
    return html`
      <md-list-item type="button" @click="${logout}">
        <md-icon slot="start">logout</md-icon>
        <span slot="headline">${t('settings.logout')}</span>
      </md-list-item>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'settings-logout-item': SettingsLogoutItem;
  }
}
