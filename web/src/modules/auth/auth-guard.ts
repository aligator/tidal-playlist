import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { StyledElement } from '../../styled-element.ts';
import { type ApiTokenResponse, finishLogin, startLogin } from '../tidal/auth.ts';

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

  private async runGuard() {
    this.status = AuthGuardStatus.CHECKING;
    this.errorMessage = '';

    try {
      const token = await finishLogin();
      if (token) {
        this.onAuthenticated(token);
        return;
      }

      this.status = AuthGuardStatus.NEEDS_LOGIN;
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
      this.status = AuthGuardStatus.ERROR;
    }
  }

  private onAuthenticated(token: ApiTokenResponse) {
    this.status = AuthGuardStatus.AUTHENTICATED;
    this.dispatchEvent(
      new CustomEvent<ApiTokenResponse>('auth-token', {
        detail: token,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleRetry = () => {
    void this.runGuard();
  };

  private handleLogin = async () => {
    try {
      await startLogin();
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
