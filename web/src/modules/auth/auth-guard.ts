import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { StyledElement } from '../../styled-element.ts';
import { TidalAuth } from '../tidal/tidal-auth.ts';
import { loadRuntimeConfig } from '../tidal/settings.ts';

const name = 'auth-guard';

enum AuthGuardStatus {
  CHECKING,
  NEEDS_LOGIN,
  AUTHENTICATED,
  ERROR,
}

@customElement(name)
export class AuthGuard extends StyledElement {
  static override localStyles = css`
  `;

  @state()
  private status: AuthGuardStatus = AuthGuardStatus.CHECKING;

  @state()
  private errorMessage = '';

  private tidalAuth: TidalAuth | null = null;

  override connectedCallback() {
    super.connectedCallback();
    void this.runGuard();
  }

  override render() {
    if (this.status === AuthGuardStatus.AUTHENTICATED) {
      return html`
        <slot></slot>
      `;
    }

    if (this.status === AuthGuardStatus.CHECKING) {
      return html`
        <section class="auth-guard auth-guard__panel">
          <p>Checking authentication...</p>
        </section>
      `;
    }

    if (this.status === AuthGuardStatus.ERROR) {
      return html`
        <section class="auth-guard auth-guard__panel">
          <p class="auth-guard__error">Authentication failed: ${this.errorMessage}</p>
          <div>
            <button class="btn" @click="${this.handleRetry}">Retry</button>
            <button class="btn btn-primary" @click="${this.handleLogin}">Login with TIDAL</button>
          </div>
        </section>
      `;
    }

    return html`
      <section class="auth-guard auth-guard__panel">
        <p>You need to sign in before using the app.</p>
        <div>
          <button class="btn btn-primary" @click="${this.handleLogin}">Login with TIDAL</button>
        </div>
      </section>
    `;
  }

  private async runGuard(): Promise<void> {
    this.status = AuthGuardStatus.CHECKING;
    this.errorMessage = '';

    try {
      const { clientId } = await loadRuntimeConfig();
      this.tidalAuth = new TidalAuth({ clientId });

      if (this.tidalAuth.isLoggedIn()) {
        this.onAuthenticated(this.tidalAuth);
        return;
      }

      const completed = await this.tidalAuth.finishLoginFromUrl();
      if (completed) {
        this.onAuthenticated(this.tidalAuth);
        return;
      }

      this.status = AuthGuardStatus.NEEDS_LOGIN;
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
      this.status = AuthGuardStatus.ERROR;
    }
  }

  private onAuthenticated(tidalAuth: TidalAuth): void {
    this.status = AuthGuardStatus.AUTHENTICATED;
    this.dispatchEvent(
      new CustomEvent<TidalAuth>('auth-ready', {
        detail: tidalAuth,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleRetry = (): void => {
    void this.runGuard();
  };

  private handleLogin = async (): Promise<void> => {
    try {
      if (!this.tidalAuth) {
        const { clientId } = await loadRuntimeConfig();
        this.tidalAuth = new TidalAuth({ clientId });
      }
      await this.tidalAuth.beginLogin();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
      this.status = AuthGuardStatus.ERROR;
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: AuthGuard;
  }
}
