import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/dialog/dialog.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/text-button.js';
import { t } from '../../i18n/index.ts';
import { settings } from '../settings/store.ts';

@customElement('playlist-save-dialog')
export class PlaylistSaveDialog extends SignalWatcher(LitElement) {
  @property({ type: Boolean })
  open = false;

  override render() {
    const { playlistName } = settings.get();
    const [before, after] = t('playlist.save.content').split('{name}');
    return html`
      <md-dialog ?open="${this.open}" @closed="${this._onClosed}">
        <div slot="headline">${t('playlist.save.headline')}</div>
        <div slot="content">
          ${before}<strong>${playlistName}</strong>${after ?? ''}
        </div>
        <div slot="actions">
          <md-text-button @click="${this._onClosed}">${t('playlist.save.cancel')}</md-text-button>
          <md-filled-button @click="${this._onConfirmed}">${t('playlist.save.confirm')}</md-filled-button>
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
