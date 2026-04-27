import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import { isAuthenticated } from './store.ts';
import { pushView } from '../../app-shell.ts';

const name = 'auth-guard';

/** Guards slotted content behind auth; redirects to login view when unauthenticated. */
@customElement(name)
export class AuthGuard extends SignalWatcher(LitElement) {
  protected override willUpdate(): void {
    if (!isAuthenticated.get()) {
      // Schedule microtask to avoid triggering navigation as a side effect during render
      Promise.resolve().then(() => pushView('login'));
    }
  }

  override render() {
    if (!isAuthenticated.get()) {
      return html``;
    }
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [name]: AuthGuard;
  }
}
