import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import '@material/web/list/list-item.js';
import '@material/web/icon/icon.js';
import { logout } from './store.ts';

@customElement('settings-logout-item')
export class SettingsLogoutItem extends LitElement {
  override render() {
    return html`
      <md-list-item type="button" @click="${logout}">
        <md-icon slot="start">logout</md-icon>
        <span slot="headline">Logout</span>
      </md-list-item>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'settings-logout-item': SettingsLogoutItem;
  }
}
