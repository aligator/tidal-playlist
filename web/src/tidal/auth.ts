import {
  credentialsProvider as sdkCredentialsProvider,
  init as initSdkAuth,
  logout as sdkLogout,
  setCredentials as sdkSetCredentials,
} from '@tidal-music/auth';
import type { Credentials } from '@tidal-music/common';
import type { AppSettings, OAuthConfig } from '../types.ts';
import {
  AUTH_URL,
  PKCE_KEY,
  SCOPES,
  TOKEN_KEY,
  asString,
  parseJwtExpiry,
  randomString,
  readJson,
  sha256Base64Url,
  writeJson,
} from './shared.ts';
import type { JsonObject, PkceState, TokenState } from './shared.ts';

export class TidalAuth {
  private oauth: OAuthConfig;
  private authInitPromise: Promise<void> | null = null;
  private authInitClientId = '';

  constructor(settings: AppSettings, oauth: OAuthConfig) {
    void settings;
    this.oauth = oauth;
  }

  updateSettings(settings: AppSettings): void {
    void settings;
  }

  updateOAuth(oauth: OAuthConfig): void {
    this.oauth = oauth;
    this.authInitPromise = null;
    this.authInitClientId = '';
    void this.ensureSdkInitialized();
  }

  isLoggedIn(): boolean {
    const token = readJson<TokenState | null>(TOKEN_KEY, null);
    return Boolean(token?.access_token && token.expires_at > this.unixNow() + 30);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PKCE_KEY);
    sdkLogout();
  }

  async beginLogin(): Promise<void> {
    const verifier = randomString(96);
    const challenge = await sha256Base64Url(verifier);
    const state = randomString(32);
    writeJson<PkceState>(PKCE_KEY, { verifier, state });

    const u = new URL(AUTH_URL);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('client_id', this.oauth.clientId);
    u.searchParams.set('redirect_uri', this.oauth.redirectUri);
    u.searchParams.set('scope', SCOPES.join(' '));
    u.searchParams.set('code_challenge', challenge);
    u.searchParams.set('code_challenge_method', 'S256');
    u.searchParams.set('state', state);

    globalThis.location.href = u.toString();
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

    const pkce = readJson<PkceState | null>(PKCE_KEY, null);
    if (!pkce?.verifier || !pkce?.state || pkce.state !== state) {
      throw new Error('Invalid state or missing PKCE verifier.');
    }

    const payload = await this.postBackendToken('/api/auth/token', {
      code,
      codeVerifier: pkce.verifier,
    });
    const tokenState = this.toTokenState(payload);

    await this.persistTokenState(tokenState);

    localStorage.removeItem(PKCE_KEY);
    u.searchParams.delete('code');
    u.searchParams.delete('state');
    u.searchParams.delete('error');
    globalThis.history.replaceState({}, document.title, u.toString());
    return true;
  }

  async getAccessToken(): Promise<string> {
    await this.ensureSdkInitialized();

    const sdkToken = await this.getSdkTokenSafe();
    if (sdkToken) {
      return sdkToken;
    }

    const token = readJson<TokenState | null>(TOKEN_KEY, null);
    if (!token?.access_token) {
      throw new Error('Not authenticated.');
    }
    if (!token.refresh_token) {
      throw new Error('Token expired and no refresh token available. Login again.');
    }

    const payload = await this.postBackendToken('/api/auth/refresh', {
      refreshToken: token.refresh_token,
    });

    const mergedToken = this.toTokenState(payload, token);
    await this.persistTokenState(mergedToken);

    const refreshedSdkToken = await this.getSdkTokenSafe();
    if (!refreshedSdkToken) {
      throw new Error('Authentication failed to provide an access token.');
    }
    return refreshedSdkToken;
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
    writeJson<TokenState>(TOKEN_KEY, tokenState);
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
    const grantedScopes = scopeString
      ? scopeString.split(/\s+/).filter(Boolean)
      : [...SCOPES];

    const userIdRaw = tokenState.user_id;
    const userId =
      typeof userIdRaw === 'number' || typeof userIdRaw === 'string'
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
    path: '/api/auth/token' | '/api/auth/refresh',
    body: Record<string, unknown>,
  ): Promise<JsonObject> {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    const payload = (await res.json().catch(() => ({}))) as JsonObject;
    if (!res.ok) {
      const defaultMessage = path === '/api/auth/token'
        ? `Token endpoint failed (${res.status})`
        : `Refresh failed (${res.status})`;
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

  private unixNow(): number {
    return Math.floor(Date.now() / 1000);
  }
}
