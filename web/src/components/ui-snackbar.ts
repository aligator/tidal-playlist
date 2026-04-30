import { css, html, LitElement } from 'lit';
import type { PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@material/web/button/text-button.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/icon/icon.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SnackbarType = 'success' | 'error' | 'info';

export interface SnackbarAction {
  label: string;
  callback: () => void;
}

export interface SnackbarItem {
  message: string;
  type: SnackbarType;
  /** Duration in ms. 0 = persist until dismissed. Default: 3000 for success/info, 0 for error. */
  duration?: number;
  action?: SnackbarAction;
}

// ---------------------------------------------------------------------------
// Element
// ---------------------------------------------------------------------------

const name = 'ui-snackbar';

/** Singleton queue-based toast. Call UiSnackbar.show() from anywhere. */
@customElement(name)
export class UiSnackbar extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: fixed;
      bottom: 88px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      width: min(400px, calc(100vw - 32px));
      pointer-events: none;
    }

    .snackbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 8px 14px 16px;
      border-radius: 4px;
      background: var(--md-sys-color-inverse-surface);
      color: var(--md-sys-color-inverse-on-surface);
      box-shadow:
        0 3px 5px -1px rgba(0, 0, 0, 0.2),
        0 6px 10px 0 rgba(0, 0, 0, 0.14),
        0 1px 18px 0 rgba(0, 0, 0, 0.12);
      pointer-events: auto;
      transform: translateY(100%);
      opacity: 0;
      transition: transform 250ms cubic-bezier(0.2, 0, 0, 1), opacity 250ms ease;
    }

    .snackbar.visible {
      transform: translateY(0);
      opacity: 1;
    }

    .message {
      flex: 1;
      font-size: 0.875rem;
      font-weight: 400;
      line-height: 1.4;
    }

    md-text-button {
      --md-text-button-label-text-color: var(--md-sys-color-inverse-primary);
      --md-text-button-hover-label-text-color: var(--md-sys-color-inverse-primary);
      --md-text-button-focus-label-text-color: var(--md-sys-color-inverse-primary);
      --md-text-button-pressed-label-text-color: var(--md-sys-color-inverse-primary);
      --md-text-button-hover-state-layer-color: var(--md-sys-color-inverse-primary);
      --md-text-button-focus-state-layer-color: var(--md-sys-color-inverse-primary);
      --md-text-button-pressed-state-layer-color: var(--md-sys-color-inverse-primary);
      flex-shrink: 0;
    }

    md-icon-button {
      --md-icon-button-icon-color: var(--md-sys-color-inverse-on-surface);
      --md-icon-button-hover-icon-color: var(--md-sys-color-inverse-on-surface);
      --md-icon-button-focus-icon-color: var(--md-sys-color-inverse-on-surface);
      --md-icon-button-pressed-icon-color: var(--md-sys-color-inverse-on-surface);
      --md-icon-button-hover-state-layer-color: var(--md-sys-color-inverse-on-surface);
      --md-icon-button-focus-state-layer-color: var(--md-sys-color-inverse-on-surface);
      --md-icon-button-pressed-state-layer-color: var(--md-sys-color-inverse-on-surface);
      flex-shrink: 0;
    }
  `;

  // -----------------------------------------------------------------------
  // Static singleton + queue API
  // -----------------------------------------------------------------------

  static instance: UiSnackbar | null = null;

  private static _queue: SnackbarItem[] = [];

  /**
   * Show a snackbar message. Can be called before any `<ui-snackbar>` exists
   * in the DOM — the element will be appended to `document.body` automatically.
   */
  static show(
    message: string,
    type: SnackbarType,
    options?: Partial<Omit<SnackbarItem, 'message' | 'type'>>,
  ): void {
    // Drop duplicate: skip if same message already queued or currently shown
    const alreadyQueued = UiSnackbar._queue.some((i) => i.message === message);
    if (alreadyQueued) {
      return;
    }
    if (UiSnackbar.instance?._current?.message === message) {
      return;
    }

    const item: SnackbarItem = {
      message,
      type,
      duration: options?.duration !== undefined ? options.duration : type === 'error' ? 0 : 3000,
      action: options?.action,
    };

    UiSnackbar._queue.push(item);

    // Ensure an instance exists in the DOM
    if (!UiSnackbar.instance) {
      const el = document.createElement(name) as UiSnackbar;
      document.body.appendChild(el);
      // instance is set in connectedCallback
    } else {
      // If not already showing something, start the queue
      if (!UiSnackbar.instance._current) {
        UiSnackbar.instance._showNext();
      }
    }
  }

  // -----------------------------------------------------------------------
  // Instance state
  // -----------------------------------------------------------------------

  @state()
  private _current: SnackbarItem | null = null;

  @state()
  private _visible = false;

  private _dismissTimer: ReturnType<typeof setTimeout> | null = null;

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  override connectedCallback(): void {
    super.connectedCallback();
    UiSnackbar.instance = this;
    // If items were queued before we connected, start showing them
    if (UiSnackbar._queue.length > 0 && !this._current) {
      this._showNext();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (UiSnackbar.instance === this) {
      UiSnackbar.instance = null;
    }
    this._clearTimer();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('_current') && this._current) {
      // Trigger enter animation on next frame
      requestAnimationFrame(() => {
        this._visible = true;
      });
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  override render() {
    if (!this._current) {
      return html`

      `;
    }

    return html`
      <div class="snackbar ${this._visible ? 'visible' : ''}" role="status" aria-live="polite">
        <span class="message">${this._current.message}</span>
        ${this._current.action
          ? html`
            <md-text-button @click="${this._onAction}">
              ${this._current.action.label}
            </md-text-button>
          `
          : ''}
        <md-icon-button aria-label="Dismiss" @click="${this._dismiss}">
          <md-icon>close</md-icon>
        </md-icon-button>
      </div>
    `;
  }

  // -----------------------------------------------------------------------
  // Queue management
  // -----------------------------------------------------------------------

  private _showNext(): void {
    const next = UiSnackbar._queue.shift();
    if (!next) {
      this._current = null;
      this._visible = false;
      return;
    }

    this._visible = false;
    this._current = next;

    // Schedule auto-dismiss if duration > 0
    const duration = next.duration ?? (next.type === 'error' ? 0 : 3000);
    if (duration > 0) {
      this._clearTimer();
      this._dismissTimer = setTimeout(() => this._dismiss(), duration);
    }
  }

  private _dismiss(): void {
    this._clearTimer();
    this._visible = false;

    setTimeout(() => {
      this._current = null;
      this._showNext();
    }, 260);
  }

  private _onAction(): void {
    const cb = this._current?.action?.callback;
    if (cb) {
      cb();
    }
    this._dismiss();
  }

  private _clearTimer(): void {
    if (this._dismissTimer !== null) {
      clearTimeout(this._dismissTimer);
      this._dismissTimer = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience function
// ---------------------------------------------------------------------------

export function showSnackbar(
  message: string,
  type: SnackbarType,
  options?: Partial<Omit<SnackbarItem, 'message' | 'type'>>,
): void {
  UiSnackbar.show(message, type, options);
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: UiSnackbar;
  }
}
