import { LitElement, html, css } from 'lit';
import type { PropertyValues } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import './ui-bottom-sheet.ts';
import '@material/web/textfield/filled-text-field.js';
import '@material/web/progress/circular-progress.js';

const name = 'ui-search-sheet';

/** Bottom sheet with debounced search input and a slot for results. */
@customElement(name)
export class UiSearchSheet extends LitElement {
  static override styles = css`
    :host {
      display: contents;
    }

    .sheet-inner {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 0 16px 24px;
      box-sizing: border-box;
    }

    .search-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0 12px;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
      margin-bottom: 8px;
    }

    md-filled-text-field {
      flex: 1;
    }

    md-circular-progress {
      --md-circular-progress-size: 24px;
      flex-shrink: 0;
    }

    .results {
      flex: 1;
      overflow-y: auto;
    }
  `;

  /** Controls sheet visibility. */
  @property({ type: Boolean })
  open = false;

  /** Placeholder text for the search input. */
  @property({ type: String })
  placeholder = 'Search…';

  /** When true, shows a circular progress indicator. */
  @property({ type: Boolean })
  loading = false;

  @query('md-filled-text-field')
  private _fieldEl?: HTMLElement & { value: string; focus(): void };

  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);

    if (changed.has('open')) {
      if (this.open) {
        requestAnimationFrame(() => {
          this._fieldEl?.focus();
        });
      } else {
        if (this._fieldEl) {
          this._fieldEl.value = '';
        }
        this._clearDebounce();
      }
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  override render() {
    return html`
      <ui-bottom-sheet
        .open="${this.open}"
        @close="${this._onSheetClose}"
      >
        <div class="sheet-inner">
          <div class="search-row">
            <md-filled-text-field
              type="search"
              .label="${this.placeholder}"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              @input="${this._onInput}"
            ></md-filled-text-field>
            ${this.loading
              ? html`<md-circular-progress indeterminate></md-circular-progress>`
              : ''}
          </div>
          <div class="results">
            <slot></slot>
          </div>
        </div>
      </ui-bottom-sheet>
    `;
  }

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  private _onInput(e: Event): void {
    const query = (e.target as HTMLElement & { value: string }).value;
    this._clearDebounce();
    this._debounceTimer = setTimeout(() => {
      this.dispatchEvent(
        new CustomEvent<{ query: string }>('search', {
          detail: { query },
          bubbles: true,
          composed: true,
        }),
      );
    }, 300);
  }

  private _onSheetClose(): void {
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private _clearDebounce(): void {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: UiSearchSheet;
  }
}
