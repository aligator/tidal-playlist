import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import { LOCALE_LABELS, SUPPORTED_LOCALES, t } from '../../i18n/index.ts';
import { settings, updateSettings } from './store.ts';

@customElement('settings-language-select')
export class SettingsLanguageSelect extends SignalWatcher(LitElement) {
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
      <span class="label">${t('settings.language')}</span>
      <md-outlined-select .value="${s.locale}" @change="${this._onChange}">
        ${SUPPORTED_LOCALES.map(
          (loc) =>
            html`
              <md-select-option .value="${loc}" ?selected="${s.locale === loc}">
                <div slot="headline">${LOCALE_LABELS[loc]}</div>
              </md-select-option>
            `,
        )}
      </md-outlined-select>
    `;
  }

  private _onChange(event: Event): void {
    const select = event.target as HTMLElement & { value?: string };
    const value = select.value ?? '';
    if (value) {
      updateSettings({ locale: value });
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'settings-language-select': SettingsLanguageSelect;
  }
}
