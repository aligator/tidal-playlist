import { computed, signal } from '@lit-labs/signals';
import { logout as sdkLogout } from './sdk.ts';
import { pushView } from '../../app-shell.ts';

/** True once SDK credentials confirmed valid; false until checked or after logout. */
export const authentication = signal<boolean>(false);

export const isAuthenticated = computed(() => authentication.get());

export function setAuthenticated(value: boolean): void {
  authentication.set(value);
}

export function logout(): void {
  sdkLogout();
  authentication.set(false);
  pushView('login');
}

/** Nullifies auth state and navigates to login; call on token expiry or 401 responses. */
export function handleAuthFailure(): void {
  authentication.set(false);
  pushView('login');
}
