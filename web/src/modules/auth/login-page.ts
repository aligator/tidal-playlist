import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import '@material/web/button/filled-button.js';
import '@material/web/progress/circular-progress.js';
import { pushView } from '../../app-shell.ts';
import { showSnackbar } from '../../components/ui-snackbar.ts';
import { startLogin, finishLogin } from './api.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LoginState = 'idle' | 'connecting' | 'callback';

// ---------------------------------------------------------------------------
// Element
// ---------------------------------------------------------------------------

const name = 'login-page';

/** Full-screen login page that handles the initial connect tap and OAuth callback return. */
@customElement(name)
export class LoginPage extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100dvh;
      background: var(--md-sys-color-background);
      color: var(--md-sys-color-on-background);
    }

    .container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      padding: 32px 24px;
      width: 100%;
      max-width: 360px;
    }

    .title {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      margin: 0;
      text-align: center;
      color: var(--md-sys-color-on-background);
    }

    .subtitle {
      font-size: 1rem;
      font-weight: 400;
      margin: -16px 0 0;
      text-align: center;
      color: var(--md-sys-color-on-surface-variant);
    }

    md-filled-button {
      width: 100%;
    }

    .callback-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100dvh;
      width: 100%;
    }
  `;

  @state()
  private _loginState: LoginState = 'idle';

  override connectedCallback(): void {
    super.connectedCallback();
    void this._checkCallback();
  }

  private async _checkCallback(): Promise<void> {
    const url = new URL(globalThis.location.href);
    const hasCode = url.searchParams.has('code');
    const hasState = url.searchParams.has('state');

    if (!hasCode || !hasState) {
      return;
    }

    this._loginState = 'callback';
    try {
      const token = await finishLogin();
      if (token !== null) {
        pushView('playlist');
      } else {
        this._loginState = 'idle';
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showSnackbar(`Could not connect. ${msg}`, 'error');
      this._loginState = 'idle';
    }
  }

  private async _onConnectClick(): Promise<void> {
    this._loginState = 'connecting';
    try {
      await startLogin();
      // Browser redirects — no further action needed
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showSnackbar(`Could not connect. ${msg}`, 'error');
      this._loginState = 'idle';
    }
  }

  override render() {
    if (this._loginState === 'callback') {
      return html`
        <div class="callback-container">
          <md-circular-progress indeterminate></md-circular-progress>
        </div>
      `;
    }

    const connecting = this._loginState === 'connecting';

    return html`
      <div class="container">
        <h1 class="title">TIDAL Playlist</h1>
        <p class="subtitle">Build personalised playlists from your library</p>
        <md-filled-button
          ?disabled="${connecting}"
          @click="${this._onConnectClick}"
        >
          ${connecting ? 'Connecting…' : 'Connect TIDAL'}
        </md-filled-button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: LoginPage;
  }
}
