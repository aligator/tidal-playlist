import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { StyledElement } from '../../styled-element.ts';
import '@material/web/dialog/dialog.js';
import '@material/web/button/text-button.js';

@customElement('impressum-modal')
export class ImpressumModal extends StyledElement {
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
    .impressum-button {
      padding: 0.5rem 0.85rem;
      cursor: pointer;
    }
    .impressum-button:hover {
      background: #f3f4f6;
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
      <button
        class="impressum-button"
        @click="${() => void this.openModal()}"
      >
        Impressum
      </button>

      <md-dialog ?open="${this.open}" @closed="${() => this.closeModal()}">
        <div slot="headline">Impressum</div>
        <div slot="content">
          ${this.loading
            ? html`<p>Lädt...</p>`
            : this.error
              ? html`<p>${this.error}</p>`
              : html`
                  <div class="impressum-body">
                    <p><strong>${this.name}</strong></p>
                    ${addressLines.map((line) => html`<p>${line}</p>`)}
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
