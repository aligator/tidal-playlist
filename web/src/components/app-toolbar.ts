import { css, html, nothing } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { StyledElement } from '../styled-element.ts';

@customElement('app-toolbar')
export class AppToolbar extends StyledElement {
  @state()
  private busy = false;
  @state()
  private canSavePlaylist = false;
  @state()
  private statusText = 'Not authenticated';

  @query('#import-config-file')
  private fileInputEl!: HTMLInputElement;

  static override localStyles = css`
    .toolbar {
      margin-top: 1rem;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    button {
      padding: 0.5rem 0.85rem;
      cursor: pointer;
    }
    button:hover {
      background: #f3f4f6;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .status {
      margin-left: 0.25rem;
      color: var(--ok, #1f7a3f);
    }
  `;

  override render() {
    return html`
      <div class="toolbar">
        <button
          ?disabled="${this.busy}"
          @click="${() => this._emit('login')}"
        >
          Login
        </button>

        <button
          ?disabled="${this.busy}"
          @click="${() => this._emit('logout')}"
        >
          Logout
        </button>

        <button
          ?disabled="${this.busy}"
          @click="${() => this._emit('fetch')}"
        >
          Fetch Tracks
        </button>

        <button
          ?disabled="${this.busy || !this.canSavePlaylist}"
          @click="${() => this._emit('save-playlist')}"
        >
          Save Playlist
        </button>

        <button
          ?disabled="${this.busy}"
          @click="${() => this._emit('export-config')}"
        >
          Export Config
        </button>

        <button
          ?disabled="${this.busy}"
          @click="${() => this._onImportClick()}"
        >
          Import Config
        </button>

        <input
          id="import-config-file"
          type="file"
          accept="application/json, .json"
          hidden
          @change="${(e: Event) => this._onFileChange(e)}"
        />

        <br />

        <span class="status">${this.statusText}</span>
      </div>
    `;
  }

  // ---------- public API ----------

  setBusy(busy: boolean): void {
    this.busy = busy;
  }

  setStatus(text: string): void {
    this.statusText = text;
  }

  setCanSavePlaylist(can: boolean): void {
    this.canSavePlaylist = can;
  }

  // ---------- private ----------

  private _emit(name: string): void {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
  }

  private _onImportClick(): void {
    this.fileInputEl.click();
  }

  private _onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    if (file) {
      this.dispatchEvent(
        new CustomEvent<{ file: File }>('import-config', {
          bubbles: true,
          composed: true,
          detail: { file },
        }),
      );
    }
    if (input) {
      input.value = '';
    }
  }
}

// silence TS "nothing imported but unused" — nothing is used in Lit templates
// via the template engine; kept in import for consistency with other components
void nothing;

declare global {
  interface HTMLElementTagNameMap {
    'app-toolbar': AppToolbar;
  }
}
