import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '@material/web/button/text-button.js';
import '@material/web/icon/icon.js';
import '../../components/ui-top-bar.ts';
import '../../components/ui-icon-label-button.ts';
import { listStyles } from '../../styles/list.ts';
import { showSnackbar } from '../../components/ui-snackbar.ts';
import { t } from '../../i18n/index.ts';
import { blockAlbum, blockArtist, unblockAlbum, unblockArtist } from '../library/store.ts';
import type { SelectedSong } from '../../types.ts';
import { buildStatus, resetBuild, result } from './store.ts';
import './playlist-config-panel.ts';
import './playlist-action-bar.ts';

const name = 'playlist-view';

@customElement(name)
export class PlaylistView extends SignalWatcher(LitElement) {
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

      .building-page {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 64px 24px;
        gap: 16px;
        color: var(--md-sys-color-on-surface-variant);
        font-size: 0.9375rem;
      }

      .result-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 16px 4px 16px;
        border-bottom: 1px solid var(--md-sys-color-outline-variant);
      }

      .result-count {
        font-size: 0.875rem;
        color: var(--md-sys-color-on-surface-variant);
      }

      .block-btns {
        display: flex;
        gap: 2px;
      }
    `,
  ];

  override render() {
    const status = buildStatus.get();

    return html`
      <ui-top-bar heading="${t('playlist.heading')}" logo></ui-top-bar>

      <div class="scrollable">
        ${status === 'building'
          ? this._renderBuilding()
          : status === 'done'
          ? this._renderResult()
          : this._renderConfig()}
      </div>

      <playlist-action-bar></playlist-action-bar>
    `;
  }

  private _renderConfig() {
    return html`<playlist-config-panel></playlist-config-panel>`;
  }

  private _renderBuilding() {
    return html`
      <div class="building-page">
        <md-icon style="font-size:48px;color:var(--md-sys-color-primary)">hourglass_top</md-icon>
        <span>${t('playlist.buildingPage')}</span>
      </div>
    `;
  }

  private _renderResult() {
    const tracks = result.get();
    return html`
      <div class="result-header">
        <span class="result-count">
          ${tracks.length} ${tracks.length === 1 ? t('playlist.track') : t('playlist.tracks')}
        </span>
        <md-text-button @click="${this._onNew}">
          <md-icon slot="icon">refresh</md-icon>
          ${t('playlist.new')}
        </md-text-button>
      </div>
      <md-list>
        ${tracks.map((song) => this._renderTrack(song))}
      </md-list>
    `;
  }

  private _renderTrack(song: SelectedSong) {
    return html`
      <md-list-item>
        <span slot="headline">${song.trackTitle}</span>
        <span slot="supporting-text">${song.artistName}</span>
        <div slot="end" class="block-btns">
          <ui-icon-label-button
            icon="person_remove"
            label="${t('block.artist')}"
            aria-label="Block artist ${song.artistName}"
            @click="${() => this._onBlockArtist(song)}"
          ></ui-icon-label-button>
          <ui-icon-label-button
            icon="album"
            label="${t('block.album')}"
            aria-label="Block album ${song.albumTitle}"
            @click="${() => this._onBlockAlbum(song)}"
          ></ui-icon-label-button>
        </div>
      </md-list-item>
    `;
  }

  private _onNew(): void {
    resetBuild();
  }

  private _onBlockArtist(song: SelectedSong): void {
    blockArtist(song.artistId, { label: song.artistName, subLabel: '' });
    showSnackbar(t('block.addedToBlocked', { name: song.artistName }), 'info', {
      duration: 5000,
      action: { label: t('block.undo'), callback: () => unblockArtist(song.artistId) },
    });
  }

  private _onBlockAlbum(song: SelectedSong): void {
    blockAlbum(song.albumId, { label: song.albumTitle, subLabel: song.artistName });
    showSnackbar(t('block.addedToBlocked', { name: song.albumTitle }), 'info', {
      duration: 5000,
      action: { label: t('block.undo'), callback: () => unblockAlbum(song.albumId) },
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: PlaylistView;
  }
}
