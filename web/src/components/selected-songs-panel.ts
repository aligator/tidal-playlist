import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { StyledElement } from '../styled-element.ts';
import type { SelectedSong } from '../types.ts';

@customElement('selected-songs-panel')
export class SelectedSongsPanel extends StyledElement {
  @state()
  private songs: SelectedSong[] = [];

  static override localStyles = css`
    .panel {
      margin-top: 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--line, #d9dde3);
      background: #fff;
      padding: 0.7rem;
    }
    .title {
      margin: 0 0 0.45rem 0;
      font-size: 0.92rem;
      color: var(--muted, #6b7280);
      font-weight: 600;
    }
    #empty {
      margin: 0;
      color: var(--muted, #6b7280);
    }
    .table-wrap {
      max-height: 220px;
      overflow: auto;
      border: 1px solid var(--line, #d9dde3);
      border-radius: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.92rem;
    }
    thead th {
      text-align: left;
      padding: 0.45rem 0.55rem;
      color: var(--muted, #6b7280);
      border-bottom: 1px solid var(--line, #d9dde3);
      background: #f8fafc;
    }
    tbody td {
      padding: 0.45rem 0.55rem;
      border-bottom: 1px solid var(--line, #d9dde3);
      vertical-align: top;
    }
    tbody tr:last-child td {
      border-bottom: none;
    }
    .col-nr {
      width: 3rem;
      color: var(--muted, #6b7280);
    }
    .col-actions {
      width: 13rem;
    }
    .actions {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
    }
    .action-btn {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 1.8rem;
      min-width: 4.4rem;
      font: inherit;
      font-weight: 600;
      border: 1px solid var(--line, #d9dde3);
      border-radius: 6px;
      background: #f8fafc;
      color: var(--text, #1f2937);
      padding: 0.2rem 0.55rem;
      box-shadow: 0 1px 0 rgb(15 23 42 / 8%);
      cursor: pointer;
    }
    .action-btn:hover:not(:disabled) {
      background: #eef2f7;
    }
    .action-btn:active:not(:disabled) {
      transform: translateY(1px);
      box-shadow: none;
    }
    .action-btn:focus-visible {
      outline: 2px solid var(--focus, #2563eb);
      outline-offset: 1px;
    }
    .action-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `;

  override render() {
    return html`
      <section class="panel">
        <p class="title">Selected songs</p>
        ${this.songs.length === 0
          ? html`
            <p id="empty">No songs selected yet.</p>
          `
          : html`
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th class="col-nr">#</th>
                    <th>Song</th>
                    <th>Artist</th>
                    <th>Album</th>
                    <th class="col-actions">Blacklist</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.songs.map((song, i) => this._renderRow(song, i))}
                </tbody>
              </table>
            </div>
          `}
      </section>
    `;
  }

  private _renderRow(song: SelectedSong, index: number) {
    return html`
      <tr>
        <td class="col-nr">${index + 1}</td>
        <td>${song.trackTitle || '-'}</td>
        <td>${song.artistName || '-'}</td>
        <td>${song.albumTitle || '-'}</td>
        <td class="col-actions">
          <div class="actions">
            <button
              type="button"
              class="action-btn"
              ?disabled="${!song.artistId}"
              @click="${() => this._onArtistBlacklist(song)}"
            >
              Artist
            </button>
            <button
              type="button"
              class="action-btn"
              ?disabled="${!song.albumId}"
              @click="${() => this._onAlbumBlacklist(song)}"
            >
              Album
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  // ---------- public API ----------

  setSongs(songs: SelectedSong[]): void {
    this.songs = songs;
  }

  clear(): void {
    this.songs = [];
  }

  // ---------- private ----------

  private _onArtistBlacklist(song: SelectedSong): void {
    this.dispatchEvent(
      new CustomEvent<{ id: string; label: string }>('add-artist-blacklist', {
        bubbles: true,
        composed: true,
        detail: {
          id: song.artistId,
          label: song.artistName || song.artistId,
        },
      }),
    );
  }

  private _onAlbumBlacklist(song: SelectedSong): void {
    this.dispatchEvent(
      new CustomEvent<{ id: string; label: string; subLabel: string }>(
        'add-album-blacklist',
        {
          bubbles: true,
          composed: true,
          detail: {
            id: song.albumId,
            label: song.albumTitle || song.albumId,
            subLabel: song.artistName || '',
          },
        },
      ),
    );
  }
}

// nothing imported for template consistency with other components
void nothing;

declare global {
  interface HTMLElementTagNameMap {
    'selected-songs-panel': SelectedSongsPanel;
  }
}
