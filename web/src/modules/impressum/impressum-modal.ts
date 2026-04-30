import { css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { StyledElement } from '../../styled-element.ts';
import '@material/web/dialog/dialog.js';
import '@material/web/button/text-button.js';
import '@material/web/list/list-item.js';
import '@material/web/icon/icon.js';

@customElement('impressum-modal')
export class ImpressumModal extends StyledElement {
  /** When true, renders as an md-list-item instead of a nav-tab button. */
  @property({ type: Boolean, attribute: 'list-item' })
  listItem = false;

  @state()
  private available = false;
  @state()
  private open = false;
  @state()
  private name = '';
  @state()
  private address = '';
  @state()
  private email = '';
  @state()
  private loading = false;
  @state()
  private error = '';

  static override localStyles = css`
    /* nav-tab style (desktop side nav) */
    .impressum-button {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 12px 8px;
      cursor: pointer;
      border: none;
      background: transparent;
      color: var(--md-sys-color-on-surface-variant);
      font-size: 12px;
      font-family: inherit;
      border-radius: 16px;
      margin: 4px 8px;
      min-height: 56px;
      width: fit-content;
      transition: background 150ms ease, color 150ms ease;
    }
    .impressum-button:hover {
      background: color-mix(
        in srgb,
        var(--md-sys-color-on-surface-variant) 8%,
        transparent
      );
    }
    .impressum-icon {
      font-family: "Material Symbols Outlined", sans-serif;
      font-size: 24px;
      line-height: 1;
      font-style: normal;
    }
    /* list-item style (mobile settings) */
    md-list-item {
      --md-list-item-leading-space: 16px;
      --md-list-item-trailing-space: 8px;
    }
    .impressum-body p {
      margin: 0.4rem 0;
    }
    a {
      color: var(--md-sys-color-primary);
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    void this.checkAvailability();
  }

  private async checkAvailability(): Promise<void> {
    try {
      const res = await fetch('/api/impressum/available');
      const data = (await res.json()) as { available: boolean };
      this.available = data.available;
    } catch {
      this.available = false;
    }
  }

  private async openModal(): Promise<void> {
    this.loading = true;
    this.error = '';
    this.open = true;
    try {
      const res = await fetch('/api/impressum');
      if (!res.ok) {
        this.error = 'Impressum nicht verfügbar';
        return;
      }
      const data = (await res.json()) as {
        name: string;
        address: string;
        email: string;
      };
      this.name = data.name;
      this.address = data.address;
      this.email = data.email;
    } catch {
      this.error = 'Fehler beim Laden des Impressums';
    } finally {
      this.loading = false;
    }
  }

  private closeModal(): void {
    this.open = false;
  }

  override render() {
    if (!this.available) {
      return nothing;
    }

    const addressLines = this.address.split('\n');

    return html`
      ${this.listItem
        ? html`
          <md-list-item type="button" @click="${() => void this.openModal()}">
            <md-icon slot="start">info</md-icon>
            <span slot="headline">Impressum</span>
          </md-list-item>
        `
        : html`
          <button
            class="impressum-button"
            @click="${() => void this.openModal()}"
          >
            <span class="impressum-icon" aria-hidden="true">info</span>
            <span>Impressum</span>
          </button>
        `}

      <md-dialog ?open="${this.open}" @closed="${() => this.closeModal()}">
        <div slot="headline">Impressum</div>
        <div slot="content">
          ${this.loading
            ? html`
              <p>Lädt...</p>
            `
            : this.error
            ? html`
              <p>${this.error}</p>
            `
            : html`
              <div class="impressum-body">
                <p><strong>${this.name}</strong></p>
                ${addressLines.map((line) =>
                  html`
                    <p>${line}</p>
                  `
                )}
                <p>
                  <a href="mailto:${this.email}">${this.email}</a>
                </p>
              </div>
            `}
        </div>
        <div slot="actions">
          <md-text-button @click="${() => this.closeModal()}">Schließen</md-text-button>
        </div>
      </md-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'impressum-modal': ImpressumModal;
  }
}
