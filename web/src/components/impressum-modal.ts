import { ShadowComponent } from './shadow-component.ts';

type ImpressumData = {
  name: string;
  address: string;
  email: string;
};

export class ImpressumModal extends ShadowComponent {
  private impressumData: ImpressumData | null = null;

  connectedCallback(): void {
    this.loadImpressum();
    this.attachEventListeners();
  }

  private async loadImpressum(): Promise<void> {
    try {
      const response = await fetch('/api/impressum');
      if (response.ok) {
        this.impressumData = await response.json();
        this.render();
      }
    } catch (error) {
      console.error('Failed to load impressum:', error);
    }
  }