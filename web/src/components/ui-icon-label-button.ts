import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '@material/web/ripple/ripple.js';
import '@material/web/focus/md-focus-ring.js';
import '@material/web/icon/icon.js';

/**
 * Icon-above-label button. Vertical layout not supported by any md-* component,
 * but uses md-ripple + md-focus-ring for Material-compliant interaction.
 *
 * Variants:
 *   default — small inline action (44px min-width, 8px radius)
 *   nav     — nav-rail tab size (56px min-height, 16px radius)
 */
@customElement('ui-icon-label-button')
export class UiIconLabelButton extends LitElement {
  @property() icon = '';
  @property() label = '';
  @property({ type: Boolean }) error = false;
  @property({ type: Boolean }) nav = false;
  @property({ type: Boolean }) selected = false;

  static override styles = css`
    :host {
      display: inline-flex;
    }

    button {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 8px;
      color: var(--md-sys-color-on-surface-variant);
      font-family: inherit;
      font-size: 0.625rem;
      letter-spacing: 0.02em;
      min-width: 44px;
      -webkit-tap-highlight-color: transparent;
      outline: none;
    }

    :host([error]) button {
      color: var(--md-sys-color-error);
    }

    :host([nav]) button {
      gap: 4px;
      padding: 12px 8px;
      border-radius: 16px;
      min-height: 56px;
      min-width: fit-content;
    }

    :host([nav][selected]) button {
      background: var(--md-sys-color-secondary-container);
      color: var(--md-sys-color-on-secondary-container);
    }

    md-ripple {
      border-radius: inherit;
    }

    md-focus-ring {
      --md-focus-ring-shape: 8px;
    }

    :host([nav]) md-focus-ring {
      --md-focus-ring-shape: 16px;
    }
  `;

  override render() {
    return html`
      <button>
        <md-ripple></md-ripple>
        <md-focus-ring inward></md-focus-ring>
        <md-icon>${this.icon}</md-icon>
        <span>${this.label}</span>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-icon-label-button': UiIconLabelButton;
  }
}
