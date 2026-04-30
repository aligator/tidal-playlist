import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '@material/web/button/text-button.js';
import '@material/web/icon/icon.js';
import '../../components/ui-top-bar.ts';
import '../../components/ui-icon-label-button.ts';
import { listStyles } from '../../styles/list.ts';
import { showSnackbar } from '../../components/ui-snackbar.ts';
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

      .block-btns {
        display: flex;
        gap: 2px;
      }

      .result-toggle-row {
        display: flex;
        align-items: center;
        border-top: 1px solid var(--md-sys-color-outline-variant);
      }

      .config-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 16px;
        border: none;
        background: none;
        width: 100%;
        cursor: pointer;
        font-family: inherit;
        color: var(--md-sys-color-on-surface-variant);
        font-size: 0.75rem;
        font-weight: 500;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .config-toggle:hover {
        background: color-mix(in srgb, var(--md-sys-color-on-surface) 6%, transparent);
      }

      .config-toggle md-icon {
        font-size: 18px;
        transition: transform 200ms ease;
      }

      .config-toggle md-icon.rotated {
        transform: rotate(180deg);
      }

      .config-body {
        overflow: hidden;
        display: grid;
        grid-template-rows: 1fr;
        transition: grid-template-rows 220ms ease;
      }

      .config-body.collapsed {
        grid-template-rows: 0fr;
      }

      .config-body > .config-inner {
        overflow: hidden;
      }
    `,
  ];

  @state()
  private _configOpen = true;
  @state()
  private _tracksOpen = true;

  private _prevBuildStatus: string | null = null;

  protected override updated(changed: PropertyValues): void {
    void changed;
    const status = buildStatus.get();
    if (this._prevBuildStatus === 'building' && status === 'done') {
      this._configOpen = false;
      this._tracksOpen = true;
    }
    this._prevBuildStatus = status;
  }

  override render() {
    const status = buildStatus.get();
    const isDone = status === 'done';
    const tracks = result.get();

    return html`
      <ui-top-bar heading="Tidal Playlist" logo></ui-top-bar>

      <div class="scrollable">
        <button class="config-toggle" @click="${this._onToggleConfig}">
          <span>Settings</span>
          <md-icon class="${this._configOpen ? '' : 'rotated'}">expand_less</md-icon>
        </button>

        <div class="config-body ${this._configOpen ? '' : 'collapsed'}">
          <div class="config-inner">
            <playlist-config-panel></playlist-config-panel>
          </div>
        </div>

        ${isDone && tracks.length > 0
          ? html`
            <div class="result-toggle-row">
              <button class="config-toggle" style="flex:1" @click="${this._onToggleTracks}">
                <span>${tracks.length} track${tracks.length === 1 ? '' : 's'}</span>
                <md-icon class="${this._tracksOpen ? '' : 'rotated'}">expand_less</md-icon>
              </button>
              <md-text-button @click="${this._onNew}">
                <md-icon slot="icon">refresh</md-icon>
                New
              </md-text-button>
            </div>
            <div class="config-body ${this._tracksOpen ? '' : 'collapsed'}">
              <div class="config-inner">
                <md-list>
                  ${tracks.map((song) => this._renderTrack(song))}
                </md-list>
              </div>
            </div>
          `
          : ''}
      </div>

      <playlist-action-bar></playlist-action-bar>
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
            label="Artist"
            aria-label="Block artist ${song.artistName}"
            @click="${() => this._onBlockArtist(song)}"
          ></ui-icon-label-button>
          <ui-icon-label-button
            icon="album"
            label="Album"
            aria-label="Block album ${song.albumTitle}"
            @click="${() => this._onBlockAlbum(song)}"
          ></ui-icon-label-button>
        </div>
      </md-list-item>
    `;
  }

  private _onNew(): void {
    resetBuild();
    this._configOpen = true;
  }

  private _onToggleConfig(): void {
    this._configOpen = true;
    this._tracksOpen = false;
  }

  private _onToggleTracks(): void {
    this._tracksOpen = true;
    this._configOpen = false;
  }

  private _onBlockArtist(song: SelectedSong): void {
    blockArtist(song.artistName);
    showSnackbar(`Added "${song.artistName}" to Blocked`, 'info', {
      duration: 5000,
      action: { label: 'Undo', callback: () => unblockArtist(song.artistName) },
    });
  }

  private _onBlockAlbum(song: SelectedSong): void {
    blockAlbum(song.albumTitle);
    showSnackbar(`Added "${song.albumTitle}" to Blocked`, 'info', {
      duration: 5000,
      action: { label: 'Undo', callback: () => unblockAlbum(song.albumTitle) },
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: PlaylistView;
  }
}
