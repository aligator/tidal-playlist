import { setAuthenticated } from './store.ts';
import { getClientId, getStoredRefreshToken, initSdk, setCredentials } from './sdk.ts';
import { loadRuntimeConfig } from '../tidal/settings.ts';
import { SCOPES } from '../tidal/shared.ts';

type ApiTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

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
  if (new URL(authorizeUrl).origin !== 'https://login.tidal.com') {
    throw new Error('Unexpected authorize URL origin');
  }
  globalThis.location.href = authorizeUrl;
}

export async function finishLogin(): Promise<boolean> {
  const { code, state, error, errorDescription } = getCallbackParams();

  if (error) throw new Error(errorDescription ?? error);
  if (!code || !state) {
    return false;
  }

  const res = await fetch('/api/auth/token', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, state }),
  });

  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  const token = (await res.json()) as ApiTokenResponse;

  // clean callback query from URL
  globalThis.history.replaceState({}, '', '/');

  // Ensure SDK is initialised (idempotent if startup already ran).
  let clientId = getClientId();
  if (!clientId) {
    const config = await loadRuntimeConfig();
    clientId = config.clientId;
    await initSdk(clientId);
  }

  const grantedScopes = token.scope ? token.scope.split(' ') : [...SCOPES];
  await setCredentials({
    accessToken: {
      clientId,
      token: token.access_token,
      expires: Date.now() + token.expires_in * 1000,
      requestedScopes: [...SCOPES],
      grantedScopes,
    },
    refreshToken: token.refresh_token,
  });

  setAuthenticated(true);
  return true;
}

export async function refreshAccessToken(): Promise<void> {
  const token = getStoredRefreshToken();
  if (!token) throw new Error('No refresh token stored');

  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: token }),
  });

  if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
  const newToken = (await res.json()) as ApiTokenResponse;

  let clientId = getClientId();
  if (!clientId) {
    const config = await loadRuntimeConfig();
    clientId = config.clientId;
    await initSdk(clientId);
  }

  const grantedScopes = newToken.scope ? newToken.scope.split(' ') : [...SCOPES];
  await setCredentials({
    accessToken: {
      clientId,
      token: newToken.access_token,
      expires: Date.now() + newToken.expires_in * 1000,
      requestedScopes: [...SCOPES],
      grantedScopes,
    },
    refreshToken: newToken.refresh_token ?? token,
  });

  setAuthenticated(true);
}
