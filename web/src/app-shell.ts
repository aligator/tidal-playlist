import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { computed, signal, SignalWatcher } from '@lit-labs/signals';
import { isAuthenticated } from './modules/auth/store.ts';
import '@material/web/labs/navigationbar/navigation-bar.js';
import '@material/web/labs/navigationtab/navigation-tab.js';
import './modules/impressum/impressum-modal.ts';
import { t, type TranslationKey } from './i18n/index.ts';

// ---------------------------------------------------------------------------
// Signal-based view router (module-level, exported for other modules to use)
// ---------------------------------------------------------------------------

export const viewStack = signal<string[]>(['login']);

export const currentView = computed(() => {
  const stack = viewStack.get();
  return stack[stack.length - 1];
});

export function pushView(view: string): void {
  viewStack.set([...viewStack.get(), view]);
}

export function popView(): void {
  const stack = viewStack.get();
  if (stack.length > 1) {
    viewStack.set(stack.slice(0, -1));
  }
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const MAIN_VIEWS = ['playlist', 'library', 'settings'] as const;
type MainView = (typeof MAIN_VIEWS)[number];

interface NavTab {
  view: MainView;
  labelKey: TranslationKey;
  icon: string;
}

const NAV_TABS: NavTab[] = [
  { view: 'playlist', labelKey: 'nav.playlist', icon: 'queue_music' },
  { view: 'library', labelKey: 'nav.library', icon: 'library_music' },
  { view: 'settings', labelKey: 'nav.settings', icon: 'settings' },
];

// ---------------------------------------------------------------------------
// <app-shell> element
// ---------------------------------------------------------------------------

const name = 'app-shell';

@customElement(name)
export class AppShell extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      background: var(--md-sys-color-background);
      color: var(--md-sys-color-on-background);
    }

    /* ------------------------------------------------------------------ */
    /* Layout                                                               */
    /* ------------------------------------------------------------------ */

    .shell {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .content {
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }

    /* ------------------------------------------------------------------ */
    /* Bottom nav (mobile default)                                          */
    /* ------------------------------------------------------------------ */

    md-navigation-bar {
      flex-shrink: 0;
    }

    /* ------------------------------------------------------------------ */
    /* Side nav rail (desktop ≥ 768 px) — CSS only, no JS matchMedia       */
    /* ------------------------------------------------------------------ */

    /* Hidden on mobile; @media below overrides to flex on desktop */
    .side-nav {
      display: none;
    }

    @media (min-width: 768px) {
      .shell {
        flex-direction: row;
      }

      .side-nav {
        display: flex;
        flex-direction: column;
        width: 90px;
        min-height: 100dvh;
        background: var(--md-sys-color-surface);
        border-right: 1px solid var(--md-sys-color-outline-variant);
        flex-shrink: 0;
        padding-top: 12px;
      }

      .side-nav-tab {
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
        transition: background 150ms ease, color 150ms ease;
      }

      .side-nav-tab:hover {
        background: color-mix(
          in srgb,
          var(--md-sys-color-on-surface-variant) 8%,
          transparent
        );
      }

      .side-nav-tab[aria-selected="true"] {
        background: var(--md-sys-color-secondary-container);
        color: var(--md-sys-color-on-secondary-container);
      }

      .side-nav-tab .nav-icon {
        font-family: "Material Symbols Outlined", sans-serif;
        font-size: 24px;
        line-height: 1;
        font-style: normal;
      }

      .content {
        padding: 0;
      }

      /* Hide mobile bottom nav on desktop */
      md-navigation-bar {
        display: none;
      }
    }

    /* ------------------------------------------------------------------ */
    /* Placeholder views                                                    */
    /* ------------------------------------------------------------------ */

    .view-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      border-radius: 12px;
      background: var(--md-sys-color-surface-variant);
      color: var(--md-sys-color-on-surface-variant);
      font-size: 1.25rem;
      font-weight: 500;
      letter-spacing: 0.01em;
    }
  `;

  override render() {
    const view = currentView.get();
    // Active tab index: only the 3 main views affect the indicator
    const activeIndex = MAIN_VIEWS.indexOf(view as MainView);
    const showNav = view !== 'login' && view !== 'result';

    return html`
      <div class="shell">
        <!-- Side nav rail — visible at ≥ 768 px via CSS @media -->
        ${showNav
          ? html`
            <nav class="side-nav" role="navigation" aria-label="Main navigation">
              ${NAV_TABS.map(
                (tab) => {
                  const label = t(tab.labelKey);
                  return html`
                    <button
                      class="side-nav-tab"
                      role="tab"
                      aria-selected="${view === tab.view ? 'true' : 'false'}"
                      aria-label="${label}"
                      @click="${() => this._onTabClick(tab.view)}"
                    >
                      <span class="nav-icon" aria-hidden="true">${tab.icon}</span>
                      <span>${label}</span>
                    </button>
                  `;
                },
              )}
              <div style="flex:1"></div>
              <impressum-modal></impressum-modal>
            </nav>
          `
          : ''}

        <!-- Main content -->
        <main class="content">
          ${this._renderView(view)}
        </main>
      </div>

      <!-- Bottom navigation bar — visible on mobile via CSS, hidden on login -->
      ${showNav
        ? html`
          <md-navigation-bar
            .activeIndex="${activeIndex >= 0 ? activeIndex : 0}"
            @navigation-bar-activated="${this._onNavBarActivated}"
          >
            ${NAV_TABS.map(
              (tab) => {
                const label = t(tab.labelKey);
                return html`
                  <md-navigation-tab
                    .label="${label}"
                    .active="${view === tab.view}"
                  >
                    <md-icon slot="active-icon">${tab.icon}</md-icon>
                    <md-icon slot="inactive-icon">${tab.icon}</md-icon>
                  </md-navigation-tab>
                `;
              },
            )}
          </md-navigation-bar>
        `
        : ''}
    `;
  }

  private _renderView(view: string) {
    if (view === 'login') {
      return html`
        <login-page></login-page>
      `;
    }

    if (!isAuthenticated.get()) {
      return html`

      `;
    }

    if (view === 'settings') {
      return html`
        <settings-view></settings-view>
      `;
    }

    if (view === 'library') {
      return html`
        <library-view></library-view>
      `;
    }

    if (view === 'playlist') {
      return html`
        <playlist-view></playlist-view>
      `;
    }

    if (view === 'result') {
      return html`
        <result-view></result-view>
      `;
    }

    return html`
      <div class="view-placeholder">Unknown View: ${view}</div>
    `;
  }

  private _onTabClick(view: MainView): void {
    viewStack.set([view]);
  }

  private _onNavBarActivated(event: Event): void {
    if (!(event instanceof CustomEvent)) {
      return;
    }
    const detail = (event as CustomEvent).detail as { activeIndex?: number };
    const tab = NAV_TABS[detail.activeIndex ?? 0];
    if (tab) {
      viewStack.set([tab.view]);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: AppShell;
  }
}
