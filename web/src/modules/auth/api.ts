import { authentication } from './store.ts';
import type { ApiTokenResponse } from './store.ts';

export type { ApiTokenResponse };

const CALLBACK_PATH = '/callback';

function getCallbackParams() {
  const url = new URL(globalThis.location.href);
  return {
    code: url.searchParams.get('code'),
    state: url.searchParams.get('state'),
    error: url.searchParams.get('error'),
    errorDescription: url.searchParams.get('error_description'),
  };
}

export async function startLogin(): Promise<void> {
  const res = await fetch('/api/auth/start', { credentials: 'include' });
  if (!res.ok) throw new Error(`auth start failed: ${res.status}`);
  const { authorizeUrl } = (await res.json()) as { authorizeUrl: string };
  globalThis.location.href = authorizeUrl;
}

export async function finishLogin(): Promise<ApiTokenResponse | null> {
  const { code, state, error, errorDescription } = getCallbackParams();

  if (error) throw new Error(errorDescription ?? error);
  if (!code || !state) {
    return null;
  }

  const res = await fetch('/api/auth/token', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code,
      state,
      redirectUri: `${globalThis.location.origin}${CALLBACK_PATH}`,
    }),
  });

  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  const token = (await res.json()) as ApiTokenResponse;

  // clean callback query from URL
  globalThis.history.replaceState({}, '', '/');

  authentication.set(token);
  return token;
}
