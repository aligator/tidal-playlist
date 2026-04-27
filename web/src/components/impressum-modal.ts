import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { StyledElement } from '../styled-element.ts';

// TODO: why is this not a domain-level module? impressum is also a domain...
// maybe better a basic modal component thats used by it...

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
    dialog {
      border-radius: 8px;
      border: 1px solid var(--line, #d9dde3);
      padding: 0;
      max-width: 480px;
      width: 90%;
    }
    dialog::backdrop {
      background: rgb(0 0 0 / 40%);
    }
    .impressum-content {
      padding: 1.5rem;
    }
    .impressum-content h2 {
      margin: 0 0 1rem 0;
    }
    .impressum-body p {
      margin: 0.4rem 0;
    }
    .impressum-close {
      margin-top: 1rem;
      padding: 0.5rem 0.85rem;
      cursor: pointer;
    }
    .impressum-close:hover {
      background: #f3f4f6;
    }
    a {
      color: var(--link, #2563eb);
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    void this.checkAvailability();
  }

  override updated(): void {
    const dialog = this.shadowRoot?.querySelector('dialog') as HTMLDialogElement | null;
    if (!dialog) return;
    if (this.open && !dialog.open) {
      dialog.showModal();
    } else if (!this.open && dialog.open) {
      dialog.close();
    }
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

  private onDialogClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      this.closeModal();
    }
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

      <dialog @click="${(e: MouseEvent) => this.onDialogClick(e)}">
        <div class="impressum-content">
          <h2>Impressum</h2>

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

          <button
            class="impressum-close"
            @click="${() => this.closeModal()}"
          >
            Schließen
          </button>
        </div>
      </dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'impressum-modal': ImpressumModal;
  }
}
