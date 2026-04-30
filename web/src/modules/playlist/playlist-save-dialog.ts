import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/dialog/dialog.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/text-button.js';
import { settings } from '../settings/store.ts';

@customElement('playlist-save-dialog')
export class PlaylistSaveDialog extends SignalWatcher(LitElement) {
  @property({ type: Boolean })
  open = false;

  override render() {
    const { playlistName } = settings.get();
    return html`
      <md-dialog ?open="${this.open}" @closed="${this._onClosed}">
        <div slot="headline">Save playlist?</div>
        <div slot="content">
          This will replace any existing TIDAL playlist named "<strong>${playlistName}</strong>".
        </div>
        <div slot="actions">
          <md-text-button @click="${this._onClosed}">Cancel</md-text-button>
          <md-filled-button @click="${this._onConfirmed}">Save</md-filled-button>
        </div>
      </md-dialog>
    `;
  }

  private _onClosed(): void {
    this.dispatchEvent(new CustomEvent('closed', { bubbles: false, composed: true }));
  }

  private _onConfirmed(): void {
    this.dispatchEvent(new CustomEvent('confirmed', { bubbles: false, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'playlist-save-dialog': PlaylistSaveDialog;
  }
}
