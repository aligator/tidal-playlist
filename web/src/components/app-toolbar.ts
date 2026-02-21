import { ShadowComponent } from './shadow-component.ts';

type ToolbarEventName =
  | 'save-settings'
  | 'export-config'
  | 'import-config'
  | 'login'
  | 'logout'
  | 'fetch'
  | 'save-playlist';

export class AppToolbar extends ShadowComponent {
  private busy = false;
  private canSavePlaylist = false;

  connectedCallback(): void {
    this.render();
    this.bind();
    this.setStatus('Not authenticated');
    this.applyButtonState();
  }

  private render(): void {
    this.renderShadow(
      `
      <div class="toolbar">
        <button id="save-settings">Save</button>
        <button id="export-config">Export Config</button>
        <button id="import-config">Import Config</button>
        <input id="import-config-file" type="file" accept="application/json,.json" hidden />
        <button id="login">Login</button>
        <button id="logout">Logout</button>
        <button id="fetch">Fetch Tracks</button>
        <button id="save-playlist" disabled>Save Playlist</button>
        <span id="status" class="status">Not authenticated</span>
      </div>
    `,
      `
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
      `,
    );
  }

  private bind(): void {
    this.requireElement<HTMLButtonElement>('#save-settings').addEventListener(
      'click',
      () => {
        this.emit('save-settings');
      },
    );
    this.requireElement<HTMLButtonElement>('#export-config').addEventListener(
      'click',
      () => {
        this.emit('export-config');
      },
    );
    this.requireElement<HTMLButtonElement>('#import-config').addEventListener(
      'click',
      () => {
        this.requireElement<HTMLInputElement>('#import-config-file').click();
      },
    );

    this.requireElement<HTMLInputElement>('#import-config-file').addEventListener(
      'change',
      (event: Event) => {
        const input = event.target as HTMLInputElement | null;
        const file = input?.files?.[0] ?? null;
        if (file) {
          this.dispatchEvent(
            new CustomEvent<{ file: File }>('import-config', {
              bubbles: true,
              detail: { file },
            }),
          );
        }
        if (input) {
          input.value = '';
        }
      },
    );

    this.requireElement<HTMLButtonElement>('#login').addEventListener(
      'click',
      () => {
        this.emit('login');
      },
    );
    this.requireElement<HTMLButtonElement>('#logout').addEventListener(
      'click',
      () => {
        this.emit('logout');
      },
    );
    this.requireElement<HTMLButtonElement>('#fetch').addEventListener(
      'click',
      () => {
        this.emit('fetch');
      },
    );
    this.requireElement<HTMLButtonElement>('#save-playlist').addEventListener(
      'click',
      () => {
        this.emit('save-playlist');
      },
    );
  }

  private emit(name: ToolbarEventName): void {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true }));
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
    this.applyButtonState();
  }

  setCanSavePlaylist(canSavePlaylist: boolean): void {
    this.canSavePlaylist = canSavePlaylist;
    this.applyButtonState();
  }

  setStatus(text: string): void {
    this.requireElement<HTMLElement>('#status').textContent = text;
  }

  private applyButtonState(): void {
    this.requireElement<HTMLButtonElement>('#save-settings').disabled = this.busy;
    this.requireElement<HTMLButtonElement>('#export-config').disabled = this.busy;
    this.requireElement<HTMLButtonElement>('#import-config').disabled = this.busy;
    this.requireElement<HTMLButtonElement>('#login').disabled = this.busy;
    this.requireElement<HTMLButtonElement>('#fetch').disabled = this.busy;
    this.requireElement<HTMLButtonElement>('#save-playlist').disabled = this.busy ||
      !this.canSavePlaylist;
  }
}

customElements.define('app-toolbar', AppToolbar);
