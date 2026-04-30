import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@material/web/list/list.js';
import '@material/web/divider/divider.js';
import '@material/web/dialog/dialog.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/text-button.js';
import '../../components/ui-top-bar.ts';
import { listStyles } from '../../styles/list.ts';
import '../impressum/impressum-modal.ts';
import './settings-country-select.ts';
import './settings-export-item.ts';
import './settings-import-item.ts';
import type { SettingsImportItem } from './settings-import-item.ts';
import '../auth/settings-logout-item.ts';

const name = 'settings-view';

@customElement(name)
export class SettingsView extends LitElement {
  static override styles = [
    listStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }

      .scrollable {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
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

  @state()
  private _importPending: unknown = null;

  override render() {
    return html`
      <ui-top-bar heading="Settings" logo></ui-top-bar>

      <div class="scrollable">
        <div class="section-header">Playlist</div>
        <settings-country-select></settings-country-select>

        <md-list @import-ready="${this._onImportReady}">
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
      </div>

      <md-dialog ?open="${this._importPending !== null}" @closed="${this._onCancel}">
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

  private _onImportReady(event: Event): void {
    const e = event as CustomEvent<{ pending: unknown }>;
    this._importPending = e.detail.pending;
  }

  private _onCancel(): void {
    this._importPending = null;
  }

  private _onConfirm(): void {
    const pending = this._importPending;
    this._importPending = null;
    const importItem = this.shadowRoot?.querySelector('settings-import-item') as SettingsImportItem | null;
    if (importItem) {
      void importItem.runImport(pending);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: SettingsView;
  }
}
