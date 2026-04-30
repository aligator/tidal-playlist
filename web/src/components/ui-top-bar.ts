import { css, html, LitElement, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';

const name = 'ui-top-bar';

const appLogo = svg`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="32" height="32">
    <rect x="24" y="24" width="208" height="208" rx="48" fill="#0B1220" />
    <rect x="64" y="76" width="128" height="20" rx="10" fill="#334155" />
    <rect x="64" y="112" width="96" height="20" rx="10" fill="#334155" />
    <rect x="64" y="148" width="112" height="20" rx="10" fill="#334155" />
    <path
      d="M152 118c0-14 18-20 28-8 10-12 28-6 28 8
             0 18-28 34-28 34s-28-16-28-34z"
      fill="#EF4444"
    />
  </svg>
`;

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

    .logo {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      padding: 0 4px;
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

  /** When true, shows the app logo before the heading. */
  @property({ type: Boolean })
  logo = false;

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
        ${this.logo ? html`<div class="logo">${appLogo}</div>` : ''}
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
