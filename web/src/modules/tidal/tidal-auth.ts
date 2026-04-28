import {
  credentialsProvider as sdkCredentialsProvider,
  init as initSdkAuth,
  logout as sdkLogout,
  setCredentials as sdkSetCredentials,
} from '@tidal-music/auth';
import type { Credentials } from '@tidal-music/common';
import type { OAuthConfig } from '../../types.ts';
import { asString, parseJwtExpiry, readJson, SCOPES, TOKEN_KEY, writeJson } from './shared.ts';
import type { JsonObject, TokenState } from './shared.ts';

export class TidalAuth {
  private oauth: OAuthConfig;
  private authInitPromise: Promise<void> | null = null;
  private authInitClientId = '';

  constructor(oauth: OAuthConfig) {
    this.oauth = oauth;
  }

  updateOAuth(oauth: OAuthConfig): void {
    this.oauth = oauth;
    this.authInitPromise = null;
    this.authInitClientId = '';
    void this.ensureSdkInitialized();
  }

  isLoggedIn(): boolean {
    const token = readJson<TokenState | null>(TOKEN_KEY, null, sessionStorage);
    return Boolean(token?.access_token);
  }

  logout(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sdkLogout();
  }

  async beginLogin(): Promise<void> {
    const res = await fetch('/api/auth/start', { method: 'GET' });
    const payload = (await res.json().catch(() => ({}))) as JsonObject;
    if (!res.ok) {
      throw new Error(asString(payload.error) || `Login start failed (${res.status})`);
    }
    const authorizeUrl = asString(payload.authorizeUrl);
    if (!authorizeUrl) {
      throw new Error('Login start failed: missing authorize URL.');
    }
    if (new URL(authorizeUrl).origin !== 'https://login.tidal.com') {
      throw new Error('Unexpected authorize URL origin');
    }
    globalThis.location.href = authorizeUrl;
  }

  async finishLoginFromUrl(): Promise<boolean> {
    const u = new URL(globalThis.location.href);
    const code = u.searchParams.get('code');
    const state = u.searchParams.get('state');
    const oauthError = u.searchParams.get('error');

    if (oauthError) {
      throw new Error(`OAuth error: ${oauthError}`);
    }
    if (!code) {
      return false;
    }

    if (!state) {
      throw new Error('Invalid OAuth callback state.');
    }

    const payload = await this.postBackendToken('/api/auth/token', {
      code,
      state,
    });
    const tokenState = this.toTokenState(payload);

    await this.persistTokenState(tokenState);

    u.searchParams.delete('code');
    u.searchParams.delete('state');
    u.searchParams.delete('error');
    globalThis.history.replaceState({}, document.title, u.toString());
    return true;
  }

  async getAccessToken(): Promise<string> {
    await this.ensureSdkInitialized();

    let sdkToken = await this.getSdkTokenSafe();
    if (sdkToken) {
      return sdkToken;
    }

    const token = readJson<TokenState | null>(TOKEN_KEY, null, sessionStorage);
    if (token?.access_token) {
      await this.migrateTokenToSdk(token);
      sdkToken = await this.getSdkTokenSafe();
      if (sdkToken) {
        return sdkToken;
      }
    }
    throw new Error('Not authenticated. Login again.');
  }

  private async getSdkTokenSafe(): Promise<string | null> {
    try {
      const sdkCredentials = await sdkCredentialsProvider.getCredentials();
      return sdkCredentials.token ?? null;
    } catch {
      return null;
    }
  }

  private async persistTokenState(tokenState: TokenState): Promise<void> {
    writeJson<TokenState>(TOKEN_KEY, tokenState, sessionStorage);
    await this.migrateTokenToSdk(tokenState);
  }

  private credentialsStorageKey(): string {
    return `tidal_web_auth_${this.oauth.clientId}`;
  }

  private ensureSdkInitialized(): Promise<void> {
    const clientId = this.oauth.clientId.trim();
    if (!clientId) {
      throw new Error('OAuth runtime config is missing client id.');
    }

    if (this.authInitPromise && this.authInitClientId === clientId) {
      return this.authInitPromise;
    }

    this.authInitClientId = clientId;
    this.authInitPromise = initSdkAuth({
      clientId,
      credentialsStorageKey: this.credentialsStorageKey(),
      scopes: [...SCOPES],
    });
    return this.authInitPromise;
  }

  private toSdkCredentials(tokenState: TokenState): Credentials {
    const scopeString = asString(tokenState.scope, SCOPES.join(' ')).trim();
    const grantedScopes = scopeString ? scopeString.split(/\s+/).filter(Boolean) : [...SCOPES];

    const userIdRaw = tokenState.user_id;
    const userId = typeof userIdRaw === 'number' || typeof userIdRaw === 'string'
      ? String(userIdRaw)
      : undefined;

    return {
      clientId: this.oauth.clientId,
      requestedScopes: [...SCOPES],
      grantedScopes,
      token: tokenState.access_token,
      expires: tokenState.expires_at * 1000,
      userId,
    };
  }

  private async migrateTokenToSdk(tokenState: TokenState): Promise<void> {
    await this.ensureSdkInitialized();
    await sdkSetCredentials({
      accessToken: this.toSdkCredentials(tokenState),
      refreshToken: tokenState.refresh_token,
    });
  }

  private async postBackendToken(
    path: '/api/auth/token',
    body: Record<string, unknown>,
  ): Promise<JsonObject> {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    const payload = (await res.json().catch(() => ({}))) as JsonObject;
    if (!res.ok) {
      const defaultMessage = `Token endpoint failed (${res.status})`;
      throw new Error(asString(payload.error) || defaultMessage);
    }
    return payload;
  }

  private toTokenState(payload: JsonObject, previous?: TokenState): TokenState {
    const accessToken = asString(payload.access_token, previous?.access_token);
    if (!accessToken) {
      throw new Error('Token response missing access token.');
    }

    const refreshToken = asString(payload.refresh_token, previous?.refresh_token);
    const expiresIn = Number(payload.expires_in ?? previous?.expires_in ?? 3600);

    return {
      ...(previous ?? {}),
      ...payload,
      access_token: accessToken,
      refresh_token: refreshToken || undefined,
      expires_in: expiresIn,
      expires_at: parseJwtExpiry(accessToken, payload.expires_in ?? expiresIn),
    };
  }
}
