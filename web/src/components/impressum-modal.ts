export class ImpressumModal extends HTMLElement {
  connectedCallback(): void {
    this.checkAvailability();
  }

  private async checkAvailability(): Promise<void> {
    try {
      const res = await fetch('/api/impressum/available');
      const data = (await res.json()) as { available: boolean };

      if (!data.available) {
        this.hideButton();
        return;
      }

      this.render();
      this.setupListeners();
    } catch (error) {
      console.error('Failed to check impressum availability:', error);
      this.hideButton();
    }
  }

  private hideButton(): void {
    const btn = document.querySelector('#impressum-link');
    if (btn) {
      btn.style.display = 'none';
    }
  }

  private render(): void {
    this.innerHTML = `
      <dialog id="impressum-dialog">
        <div class="impressum-content">
          <h2>Impressum</h2>
          <div id="impressum-body" class="impressum-body"></div>
          <button class="impressum-close">Schließen</button>
        </div>
      </dialog>
    `;
  }

  private setupListeners(): void {
    const dialog = this.querySelector<HTMLDialogElement>('#impressum-dialog');
    const closeBtn = this.querySelector<HTMLButtonElement>('.impressum-close');
    const impressumBtn = document.querySelector<HTMLButtonElement>('#impressum-link');

    if (impressumBtn && dialog) {
      impressumBtn.addEventListener('click', () => {
        this.loadAndShowImpressum(dialog);
      });
    }

    if (closeBtn && dialog) {
      closeBtn.addEventListener('click', () => {
        dialog.close();
      });
    }

    if (dialog) {
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
          dialog.close();
        }
      });
    }
  }

  private async loadAndShowImpressum(dialog: HTMLDialogElement): Promise<void> {
    try {
      const res = await fetch('/api/impressum');
      if (!res.ok) {
        const bodyEl = this.querySelector('#impressum-body');
        if (bodyEl) bodyEl.innerHTML = '<p>Impressum nicht verfügbar</p>';
        return;
      }

      const data = (await res.json()) as {
        name: string;
        address: string;
        email: string;
      };
      const bodyEl = this.querySelector('#impressum-body');
      if (bodyEl) {
        bodyEl.innerHTML = `
          <p><strong>${data.name}</strong></p>
          <p>${data.address.replace(/\n/g, '<br>')}</p>
          <p><a href="mailto:${data.email}">${data.email}</a></p>
        `;
      }
      dialog.showModal();
    } catch (error) {
      console.error('Failed to load impressum:', error);
      const bodyEl = this.querySelector('#impressum-body');
      if (bodyEl) bodyEl.innerHTML = '<p>Fehler beim Laden des Impressums</p>';
    }
  }
}

customElements.define('impressum-modal', ImpressumModal);
