import { ShadowComponent } from './shadow-component.ts';

export type SelectedSongRow = {
  trackId: string;
  trackTitle: string;
  artistId: string;
  artistName: string;
  albumId: string;
  albumTitle: string;
};

export class SelectedSongsPanel extends ShadowComponent {
  private $songs!: HTMLTableSectionElement;
  private $empty!: HTMLParagraphElement;

  connectedCallback(): void {
    this.renderShadow(
      `
      <section class="panel">
        <p class="title">Selected songs</p>
        <p id="empty">No songs selected yet.</p>
        <div class="table-wrap" id="table-wrap" hidden>
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
            <tbody id="songs"></tbody>
          </table>
        </div>
      </section>
    `,
      `
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
      `,
    );

    this.$songs = this.requireElement<HTMLTableSectionElement>('#songs');
    this.$empty = this.requireElement<HTMLParagraphElement>('#empty');

    this.root.addEventListener('click', (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const button = target.closest('.action-btn');
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const action = button.dataset.action;
      const id = button.dataset.id ?? '';
      const label = button.dataset.label ?? '';
      const subLabel = button.dataset.subLabel ?? '';

      if (!id) {
        return;
      }

      if (action === 'artist') {
        this.dispatchEvent(
          new CustomEvent<{ id: string; label: string }>('add-artist-blacklist', {
            bubbles: true,
            detail: { id, label },
          }),
        );
      } else if (action === 'album') {
        this.dispatchEvent(
          new CustomEvent<{ id: string; label: string; subLabel: string }>(
            'add-album-blacklist',
            {
              bubbles: true,
              detail: { id, label, subLabel },
            },
          ),
        );
      }
    });
  }

  setSongs(songs: SelectedSongRow[]): void {
    const tableWrap = this.requireElement<HTMLElement>('#table-wrap');
    this.$songs.innerHTML = '';

    if (songs.length === 0) {
      tableWrap.hidden = true;
      this.$empty.hidden = false;
      return;
    }

    for (let index = 0; index < songs.length; index += 1) {
      const rowData = songs[index];
      const row = document.createElement('tr');
      const nr = document.createElement('td');
      const track = document.createElement('td');
      const artist = document.createElement('td');
      const album = document.createElement('td');
      const actions = document.createElement('td');
      const actionWrap = document.createElement('div');
      const artistBtn = document.createElement('button');
      const albumBtn = document.createElement('button');

      nr.textContent = String(index + 1);
      track.textContent = rowData.trackTitle || '-';
      artist.textContent = rowData.artistName || '-';
      album.textContent = rowData.albumTitle || '-';

      actionWrap.className = 'actions';
      artistBtn.type = 'button';
      artistBtn.className = 'action-btn';
      artistBtn.textContent = 'Artist';
      artistBtn.dataset.action = 'artist';
      artistBtn.dataset.id = rowData.artistId || '';
      artistBtn.dataset.label = rowData.artistName || rowData.artistId || '';
      if (!rowData.artistId) {
        artistBtn.disabled = true;
      }

      albumBtn.type = 'button';
      albumBtn.className = 'action-btn';
      albumBtn.textContent = 'Album';
      albumBtn.dataset.action = 'album';
      albumBtn.dataset.id = rowData.albumId || '';
      albumBtn.dataset.label = rowData.albumTitle || rowData.albumId || '';
      albumBtn.dataset.subLabel = rowData.artistName || '';
      if (!rowData.albumId) {
        albumBtn.disabled = true;
      }

      actionWrap.append(artistBtn, albumBtn);
      actions.append(actionWrap);
      row.append(nr, track, artist, album, actions);
      this.$songs.append(row);
    }

    this.$empty.hidden = true;
    tableWrap.hidden = false;
  }

  clear(): void {
    this.setSongs([]);
  }
}

customElements.define('selected-songs-panel', SelectedSongsPanel);
