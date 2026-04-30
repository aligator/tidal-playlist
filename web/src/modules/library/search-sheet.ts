import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '../../components/ui-search-sheet.ts';
import { showSnackbar } from '../../components/ui-snackbar.ts';
import { settings } from '../settings/store.ts';
import { TidalApi } from '../tidal/api.ts';
import { addAlbum, addArtist } from './store.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchResult = {
  id: string;
  name: string;
  subName?: string;
};

// ---------------------------------------------------------------------------
// Element
// ---------------------------------------------------------------------------

const name = 'library-search-sheet';

/** Bottom sheet that searches TIDAL and adds an artist or album to the library. */
@customElement(name)
export class LibrarySearchSheet extends LitElement {
  /** Controls sheet visibility. */
  @property({ type: Boolean })
  open = false;

  /** Whether to search artists or albums. */
  @property({ type: String })
  type: 'artist' | 'album' = 'artist';

  @state()
  private _loading = false;

  @state()
  private _results: SearchResult[] = [];

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  override render() {
    const placeholder = this.type === 'artist' ? 'Search artists…' : 'Search albums…';

    return html`
      <ui-search-sheet
        .open="${this.open}"
        .placeholder="${placeholder}"
        .loading="${this._loading}"
        @search="${this._onSearch}"
        @close="${this._onClose}"
      >
        <md-list>
          ${this._results.map(
            (result) =>
              html`
                <md-list-item
                  type="button"
                  @click="${() => this._onItemClick(result)}"
                >
                  <span slot="headline">${result.name}</span>
                  ${result.subName
                    ? html`
                      <span slot="supporting-text">${result.subName}</span>
                    `
                    : ''}
                </md-list-item>
              `,
          )}
        </md-list>
      </ui-search-sheet>
    `;
  }

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  private _onSearch(event: Event): void {
    const e = event as CustomEvent<{ query: string }>;
    const query = e.detail?.query?.trim() ?? '';
    if (!query) {
      this._results = [];
      return;
    }
    void this._runSearch(query);
  }

  private _onClose(): void {
    this.open = false;
    this._results = [];
    this._loading = false;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private _onItemClick(result: SearchResult): void {
    if (this.type === 'artist') {
      addArtist(result.name);
    } else {
      addAlbum(result.name);
    }

    this.dispatchEvent(
      new CustomEvent<{ name: string }>('added', {
        detail: { name: result.name },
        bubbles: true,
        composed: true,
      }),
    );

    this.open = false;
    this._results = [];
  }

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  private async _runSearch(query: string): Promise<void> {
    this._loading = true;
    this._results = [];

    try {
      const api = new TidalApi(settings.get());

      if (this.type === 'artist') {
        const rows = await api.searchArtists(query);
        this._results = rows.map((r) => ({ id: r.id, name: r.name }));
      } else {
        const rows = await api.searchAlbums(query);
        this._results = rows.map((r) => ({
          id: r.id,
          name: r.title,
          subName: r.artistName || undefined,
        }));
      }
    } catch {
      showSnackbar('Search failed', 'error');
      this._results = [];
    } finally {
      this._loading = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: LibrarySearchSheet;
  }
}
