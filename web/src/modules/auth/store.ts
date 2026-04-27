import { signal, computed } from '@lit-labs/signals';

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
