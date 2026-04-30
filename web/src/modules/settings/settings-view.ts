import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import '@material/web/list/list.js';
import '@material/web/divider/divider.js';
import '../../components/ui-top-bar.ts';
import { listStyles } from '../../styles/list.ts';
import '../impressum/impressum-modal.ts';
import './settings-country-select.ts';
import './settings-export-item.ts';
import './settings-import-item.ts';
import '../auth/settings-logout-item.ts';

const name = 'settings-view';

@customElement(name)
export class SettingsView extends LitElement {
  static override styles = [
    listStyles,
    css`
      :host {
        display: block;
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

      .impressum-row {
        display: block;
      }

      @media (min-width: 768px) {
        .impressum-row {
          display: none;
        }
      }
    `,
  ];

  override render() {
    return html`
      <ui-top-bar heading="Settings" logo></ui-top-bar>

      <div class="section-header">Playlist</div>
      <settings-country-select></settings-country-select>

      <md-list>
        <div class="section-header">Config</div>
        <settings-export-item></settings-export-item>
        <settings-import-item></settings-import-item>

        <md-divider></md-divider>

        <div class="section-header">Account</div>
        <settings-logout-item></settings-logout-item>

        <div class="impressum-row">
          <md-divider></md-divider>
          <impressum-modal list-item></impressum-modal>
        </div>
      </md-list>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: SettingsView;
  }
}
