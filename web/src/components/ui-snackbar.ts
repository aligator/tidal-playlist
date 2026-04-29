import { css, html, LitElement } from 'lit';
import type { PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';

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

    .action-btn {
      border: none;
      background: transparent;
      color: var(--md-sys-color-inverse-primary);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      padding: 8px;
      border-radius: 4px;
      white-space: nowrap;
      flex-shrink: 0;
      transition: background 150ms ease;
    }

    .action-btn:hover {
      background: color-mix(in srgb, var(--md-sys-color-inverse-primary) 8%, transparent);
    }

    .dismiss-btn {
      border: none;
      background: transparent;
      color: var(--md-sys-color-inverse-on-surface);
      font-size: 1.125rem;
      line-height: 1;
      cursor: pointer;
      padding: 8px;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 150ms ease;
    }

    .dismiss-btn:hover {
      background: color-mix(in srgb, var(--md-sys-color-inverse-on-surface) 8%, transparent);
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
            <button class="action-btn" @click="${this._onAction}">
              ${this._current.action.label}
            </button>
          `
          : ''}
        <button class="dismiss-btn" aria-label="Dismiss" @click="${this._dismiss}">
          ×
        </button>
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
