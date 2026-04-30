import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import { settings, updateSettings } from './store.ts';

const COUNTRY_CODES = [
  'AT',
  'AU',
  'BE',
  'CA',
  'CH',
  'DE',
  'DK',
  'ES',
  'FI',
  'FR',
  'GB',
  'IE',
  'IT',
  'NL',
  'NO',
  'NZ',
  'PL',
  'PT',
  'SE',
  'US',
];
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

@customElement('settings-country-select')
export class SettingsCountrySelect extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
    }

    .label {
      font-size: 0.9375rem;
      color: var(--md-sys-color-on-surface);
      min-width: 80px;
      flex-shrink: 0;
    }

    md-outlined-select {
      flex: 1;
    }
  `;

  override render() {
    const s = settings.get();
    return html`
      <span class="label">Country</span>
      <md-outlined-select .value="${s.countryCode}" @change="${this._onChange}">
        ${COUNTRY_CODES.map(
          (code) =>
            html`
              <md-select-option .value="${code}" ?selected="${s.countryCode === code}">
                <div slot="headline">${code} — ${countryNames.of(code)}</div>
              </md-select-option>
            `,
        )}
      </md-outlined-select>
    `;
  }

  private _onChange(event: Event): void {
    const select = event.target as HTMLElement & { value?: string };
    const value = select.value ?? '';
    if (value) updateSettings({ countryCode: value });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'settings-country-select': SettingsCountrySelect;
  }
}
