import { LitElement, html, css } from 'lit';
import type { PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';

const name = 'ui-bottom-sheet';

/** Slide-up overlay with backdrop, swipe-to-dismiss, and a default content slot. */
@customElement(name)
export class UiBottomSheet extends LitElement {
  static override styles = css`
    :host {
      display: contents;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      background: var(--md-sys-color-scrim, #000);
      opacity: 0;
      z-index: 200;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 300ms ease, visibility 300ms ease;
    }

    .backdrop.open {
      opacity: 0.32;
      visibility: visible;
      pointer-events: auto;
    }

    .sheet {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 201;
      background: var(--md-sys-color-surface);
      border-radius: 28px 28px 0 0;
      transform: translateY(100%);
      transition: transform 300ms cubic-bezier(0.2, 0, 0, 1);
      /* Prevent content from overflowing the rounded corners */
      overflow: hidden;
    }

    .sheet.open {
      transform: translateY(0);
    }

    .drag-handle {
      display: flex;
      justify-content: center;
      padding: 12px 0 8px;
      cursor: grab;
    }

    .drag-handle::after {
      content: '';
      display: block;
      width: 32px;
      height: 4px;
      border-radius: 2px;
      background: var(--md-sys-color-on-surface-variant, #49454f);
      opacity: 0.4;
    }

    .content {
      overflow-y: auto;
    }
  `;

  /** Controls sheet visibility. Reflected as attribute. */
  @property({ type: Boolean, reflect: true })
  open = false;

  // -----------------------------------------------------------------------
  // Touch / swipe state
  // -----------------------------------------------------------------------

  private _touchStartY = 0;
  private _touchCurrentY = 0;
  private _sheetEl: HTMLElement | null = null;

  override firstUpdated(): void {
    this._sheetEl = this.shadowRoot!.querySelector('.sheet') as HTMLElement;
  }

  override render() {
    return html`
      <div
        class="backdrop ${this.open ? 'open' : ''}"
        @click="${this._onBackdropClick}"
      ></div>
      <div
        class="sheet ${this.open ? 'open' : ''}"
        @touchstart="${this._onTouchStart}"
        @touchmove="${this._onTouchMove}"
        @touchend="${this._onTouchEnd}"
      >
        <div class="drag-handle" aria-hidden="true"></div>
        <div class="content">
          <slot></slot>
        </div>
      </div>
    `;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // Nothing extra needed — open/closed handled purely by CSS class
    if (changed.has('open') && !this.open && this._sheetEl) {
      // Reset any inline transform set during swipe
      this._sheetEl.style.transform = '';
      this._sheetEl.style.transition = '';
    }
  }

  // -----------------------------------------------------------------------
  // Backdrop
  // -----------------------------------------------------------------------

  private _onBackdropClick(): void {
    this._close();
  }

  // -----------------------------------------------------------------------
  // Swipe-to-dismiss
  // -----------------------------------------------------------------------

  private _onTouchStart(e: TouchEvent): void {
    this._touchStartY = e.touches[0].clientY;
    this._touchCurrentY = this._touchStartY;
    if (this._sheetEl) {
      // Disable CSS transition so the sheet tracks the finger directly
      this._sheetEl.style.transition = 'none';
    }
  }

  private _onTouchMove(e: TouchEvent): void {
    this._touchCurrentY = e.touches[0].clientY;
    const delta = this._touchCurrentY - this._touchStartY;
    if (delta > 0 && this._sheetEl) {
      // Only allow dragging downward
      this._sheetEl.style.transform = `translateY(${delta}px)`;
    }
  }

  private _onTouchEnd(): void {
    const delta = this._touchCurrentY - this._touchStartY;
    if (this._sheetEl) {
      // Restore CSS transition before animating back or away
      this._sheetEl.style.transition = '';
    }
    if (delta > 80) {
      this._close();
    } else {
      // Snap back to fully open
      if (this._sheetEl) {
        this._sheetEl.style.transform = '';
      }
    }
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private _close(): void {
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: UiBottomSheet;
  }
}
