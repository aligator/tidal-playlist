import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '@material/web/icon/icon.js';

const name = 'ui-top-bar';

/** Sticky 56 px app bar with optional back button and trailing action slot. */
@customElement(name)
export class UiTopBar extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: 10;
      width: 100%;
      box-sizing: border-box;
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
    }

    .bar {
      display: flex;
      align-items: center;
      height: 56px;
      padding: 0 8px;
      gap: 4px;
    }

    .back-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border: none;
      background: transparent;
      color: var(--md-sys-color-on-surface);
      cursor: pointer;
      border-radius: 50%;
      font-size: 20px;
      flex-shrink: 0;
      transition: background 150ms ease;
    }

    .back-btn:hover {
      background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
    }

    .back-btn:active {
      background: color-mix(in srgb, var(--md-sys-color-on-surface) 12%, transparent);
    }

    .heading {
      flex: 1;
      font-size: 1.125rem;
      font-weight: 500;
      letter-spacing: 0.0125em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 0 4px;
    }

    .trailing {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
  `;

  /** Title displayed in the bar. */
  @property({ type: String })
  heading = '';

  /** When true, a ← back button is shown on the left. */
  @property({ type: Boolean })
  back = false;

  override render() {
    return html`
      <div class="bar">
        ${this.back
          ? html`
              <button
                class="back-btn"
                aria-label="Go back"
                @click="${this._onBack}"
              >
                <md-icon>arrow_back</md-icon>
              </button>
            `
          : ''}
        <span class="heading">${this.heading}</span>
        <div class="trailing">
          <slot></slot>
        </div>
      </div>
    `;
  }

  private _onBack(): void {
    this.dispatchEvent(new CustomEvent('back', { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: UiTopBar;
  }
}
