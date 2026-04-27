import { signal, computed } from '@lit-labs/signals';
import { pushView } from '../../app-shell.ts';

export type ApiTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

/** Module-level auth state: the current token and derived authenticated flag. */
export const authentication = signal<ApiTokenResponse | null>(null);

export const isAuthenticated = computed(() => authentication.get() !== null);

export async function logout(): Promise<void> {
  authentication.set(null);
}

/** Nullifies the auth signal and navigates to login; call on token expiry or 401 responses. */
export function handleAuthFailure(): void {
  authentication.set(null);
  pushView('login');
}
