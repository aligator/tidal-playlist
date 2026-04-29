import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';

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
              <md-icon-button aria-label="Go back" @click="${this._onBack}">
                <md-icon>arrow_back</md-icon>
              </md-icon-button>
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
